/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as fs from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Connection } from '@salesforce/core';
import { CmlModel } from '../../../shared/types/types.js';
import { generateCsvForAssociations } from '../../../shared/utils/association.utils.js';
import {
  ParsedRuleDefinition,
  RuleRecord,
  RuleKeyEntry,
  fetchProductCodes,
  buildCmlModel,
} from '../../../shared/insurance-rule-converter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-bre-to-cml', 'cml.convert.underwriting-rules');

type UnderwritingRuleRecord = RuleRecord & {
  ApiName: string | null;
  DynamicRuleDefinition: string | null;
  Status: string | null;
  Sequence: number | null;
  RuleKey: string | null;
};

export type CmlConvertUnderwritingRulesResult = {
  cmlFile: string;
  associationsFile: string;
  ruleKeyMapping: RuleKeyEntry[];
};

export default class CmlConvertUnderwritingRules extends SfCommand<CmlConvertUnderwritingRulesResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'cml-api': Flags.string({
      summary: messages.getMessage('flags.cml-api.summary'),
      char: 'c',
      required: true,
    }),
    'workspace-dir': Flags.directory({
      summary: messages.getMessage('flags.workspace-dir.summary'),
      char: 'd',
      exists: true,
    }),
    'uw-file': Flags.file({
      summary: messages.getMessage('flags.uw-file.summary'),
      char: 'f',
      exists: true,
    }),
    'uw-ids': Flags.string({
      summary: messages.getMessage('flags.uw-ids.summary'),
      char: 's',
    }),
  };

  public async run(): Promise<CmlConvertUnderwritingRulesResult> {
    const { flags } = await this.parse(CmlConvertUnderwritingRules);

    const api = flags['cml-api'];
    const workspaceDir = flags['workspace-dir'] ?? '.';
    const targetOrg = flags['target-org'];
    const safeApi = api.replace(/[^a-zA-Z0-9_-]/g, '_');

    const records = await this.loadRecords(flags, targetOrg);
    if (records.length === 0) {
      this.log('No underwriting rules to convert.');
      return { cmlFile: '', associationsFile: '', ruleKeyMapping: [] };
    }

    const ruleDefs = this.parseRuleDefinitions(records);
    const productIdToCode = await this.resolveProductCodes(ruleDefs, targetOrg, flags);
    const { cmlModel, ruleKeyMapping } = buildCmlModel(ruleDefs, productIdToCode, 'UW', 'Underwriting eligibility');
    ruleKeyMapping.forEach((m) => this.log(`  -> ${m.name} => ${m.ruleKey}`));

    return this.writeOutputFiles(cmlModel, ruleKeyMapping, safeApi, workspaceDir, api);
  }

  private async loadRecords(
    flags: Record<string, unknown>,
    targetOrg: { getConnection: (v?: string) => Connection }
  ): Promise<UnderwritingRuleRecord[]> {
    const uwFile = flags['uw-file'] as string | undefined;
    if (uwFile) {
      this.log(`Reading underwriting rules from file: ${uwFile}`);
      const contents = await fs.readFile(uwFile, 'utf8');
      return JSON.parse(contents) as UnderwritingRuleRecord[];
    }

    this.log('Querying UnderwritingRule records from org...');
    const conn = targetOrg.getConnection(flags['api-version'] as string | undefined);
    const uwIds = flags['uw-ids'] as string | undefined;
    let soql =
      'SELECT Id, Name, ApiName, DynamicRuleDefinition, ProductPath, Status, Sequence, RuleKey FROM UnderwritingRule WHERE DynamicRuleDefinition != null';
    if (uwIds) {
      const idList = uwIds
        .split(',')
        .map((id) => `'${id.trim()}'`)
        .join(',');
      soql += ` AND Id IN (${idList})`;
    }
    const result = await conn.query<UnderwritingRuleRecord>(soql);
    this.log(`Found ${result.records.length} UnderwritingRule records with BRE rules`);
    return result.records;
  }

  private parseRuleDefinitions(
    records: UnderwritingRuleRecord[]
  ): Array<{ record: RuleRecord; ruleDef: ParsedRuleDefinition }> {
    const parsed: Array<{ record: RuleRecord; ruleDef: ParsedRuleDefinition }> = [];
    for (const record of records) {
      if (!record.DynamicRuleDefinition) {
        this.warn(`Skipping ${record.Name}: no DynamicRuleDefinition`);
        continue;
      }
      try {
        const raw = JSON.parse(record.DynamicRuleDefinition) as {
          apiName?: string;
          name?: string;
          status?: string;
          description?: string;
          productPath?: string;
          ruleCriteria?: unknown[];
        };
        parsed.push({
          record,
          ruleDef: {
            ...raw,
            name: raw.name ?? record.Name,
            apiName: raw.apiName ?? record.ApiName ?? record.Name,
            productPath: raw.productPath ?? record.ProductPath,
          } as ParsedRuleDefinition,
        });
      } catch {
        this.warn(`Failed to parse DynamicRuleDefinition for ${record.Name}`);
      }
    }
    this.log(`Parsed ${parsed.length} valid rule definitions`);
    return parsed;
  }

  private async resolveProductCodes(
    ruleDefs: Array<{ record: RuleRecord }>,
    targetOrg: { getConnection: (v?: string) => Connection },
    flags: Record<string, unknown>
  ): Promise<Map<string, string>> {
    const productIds = new Set<string>();
    for (const { record } of ruleDefs) {
      productIds.add(record.ProductPath.split('/')[0]);
    }
    try {
      const conn = targetOrg.getConnection(flags['api-version'] as string | undefined);
      return await fetchProductCodes(conn, productIds);
    } catch (e) {
      this.warn(`Could not fetch product codes: ${(e as Error).message}. Using product IDs instead.`);
      return new Map<string, string>();
    }
  }

  private async writeOutputFiles(
    cmlModel: CmlModel,
    ruleKeyMapping: RuleKeyEntry[],
    safeApi: string,
    workspaceDir: string,
    api: string
  ): Promise<CmlConvertUnderwritingRulesResult> {
    const cmlPath = `${workspaceDir}/${safeApi}.cml`;
    const associationsPath = `${workspaceDir}/${safeApi}_Associations.csv`;
    const mappingPath = `${workspaceDir}/${safeApi}_RuleKeyMapping.json`;

    await fs.writeFile(cmlPath, cmlModel.generateCml(), 'utf8');
    await fs.writeFile(associationsPath, generateCsvForAssociations(safeApi, cmlModel.associations), 'utf8');
    await fs.writeFile(mappingPath, JSON.stringify(ruleKeyMapping, null, 2), 'utf8');

    this.log(`\nCML written to: ${cmlPath}`);
    this.log(`Associations written to: ${associationsPath}`);
    this.log(`Rule key mapping written to: ${mappingPath}`);
    this.log(`\nConverted ${ruleKeyMapping.length} underwriting rules to CML`);
    this.log('\nNext steps:');
    this.log('  1. Review the generated .cml file');
    this.log(
      `  2. Import: sf cml import as-expression-set --cml-api ${api} --context-definition <CD_NAME> --target-org <org>`
    );
    this.log('  3. Update UnderwritingRule records with RuleKey from mapping file');

    return { cmlFile: cmlPath, associationsFile: associationsPath, ruleKeyMapping };
  }
}
