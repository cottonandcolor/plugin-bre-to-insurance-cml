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
import { generateCsvForAssociations } from '../../../shared/utils/association.utils.js';
import { parseCmlFile, mergeCmlModels } from '../../../shared/cml-parser.js';
import { fetchExistingCmlFromOrg } from '../../../shared/cml-org-fetcher.js';
import {
  ParsedRuleDefinition,
  RuleRecord,
  RuleKeyEntry,
  fetchProductCodes,
  buildCmlModel,
} from '../../../shared/insurance-rule-converter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-bre-to-cml', 'cml.convert.surcharge-rules');

type ProductSurchargeRecord = RuleRecord & {
  RuleApiName: string | null;
  RuleDefinition: string | null;
  SequenceNumber: number | null;
  EffectiveFromDate: string | null;
  EffectiveToDate: string | null;
  IsProrationAllowed: boolean | null;
  IsRefundAllowed: boolean | null;
  IsActive: boolean | null;
  RuleEngineType: string | null;
};

type PerProductOutput = {
  productCode: string;
  cmlFile: string;
  associationsFile: string;
  mappingFile: string;
  ruleCount: number;
};

export type CmlConvertSurchargeRulesResult = {
  outputs: PerProductOutput[];
  ruleKeyMapping: RuleKeyEntry[];
  updatedRecords: number;
};

export default class CmlConvertSurchargeRules extends SfCommand<CmlConvertSurchargeRulesResult> {
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
    'surcharge-file': Flags.file({
      summary: messages.getMessage('flags.surcharge-file.summary'),
      char: 'f',
      exists: true,
    }),
    'surcharge-ids': Flags.string({
      summary: messages.getMessage('flags.surcharge-ids.summary'),
      char: 's',
    }),
    'auto-update': Flags.boolean({
      summary: messages.getMessage('flags.auto-update.summary'),
      char: 'u',
      default: false,
    }),
    'merge-from-org': Flags.boolean({
      summary: messages.getMessage('flags.merge-from-org.summary'),
      default: false,
    }),
  };

  public async run(): Promise<CmlConvertSurchargeRulesResult> {
    const { flags } = await this.parse(CmlConvertSurchargeRules);

    const workspaceDir = flags['workspace-dir'] ?? '.';
    const targetOrg = flags['target-org'];
    const autoUpdate = flags['auto-update'];
    const mergeFromOrg = flags['merge-from-org'] as boolean;

    const records = await this.loadRecords(flags, targetOrg);
    if (records.length === 0) {
      this.log('No surcharge rules to convert.');
      return { outputs: [], ruleKeyMapping: [], updatedRecords: 0 };
    }

    const ruleDefs = this.parseRuleDefinitions(records);
    const productIdToCode = await this.resolveProductCodes(ruleDefs, targetOrg, flags);

    // Group ruleDefs by root product ID
    const groupedByProduct = new Map<string, Array<{ record: RuleRecord; ruleDef: ParsedRuleDefinition }>>();
    for (const rd of ruleDefs) {
      const rootId = rd.record.ProductPath.split('/')[0];
      if (!groupedByProduct.has(rootId)) {
        groupedByProduct.set(rootId, []);
      }
      groupedByProduct.get(rootId)!.push(rd);
    }

    this.log(`\nGrouped into ${groupedByProduct.size} product(s):`);

    const allRuleKeyMapping: RuleKeyEntry[] = [];
    const outputs: PerProductOutput[] = [];
    const conn = targetOrg.getConnection(flags['api-version'] as string | undefined);

    for (const [rootProductId, productRuleDefs] of groupedByProduct) {
      const productCode = productIdToCode.get(rootProductId) ?? rootProductId;
      const safeProductCode = productCode.replace(/[^a-zA-Z0-9_-]/g, '_');
      this.log(`\n--- ${productCode} (${productRuleDefs.length} rules) ---`);

      let { cmlModel, ruleKeyMapping } = buildCmlModel(productRuleDefs, productIdToCode, 'SC', 'Surcharge eligibility');

      if (mergeFromOrg) {
        this.log(`  Looking up existing CML from org for product ${rootProductId}...`);
        const existing = await fetchExistingCmlFromOrg(conn, rootProductId);
        if (existing) {
          this.log(`  Found existing CML — merging`);
          const existingModel = parseCmlFile(existing.cml);
          cmlModel = mergeCmlModels(existingModel, cmlModel);
        } else {
          this.log(`  No existing CML found — generating new`);
        }
      }

      // Enrich mapping with metadata
      const recordById = new Map(records.map((r) => [r.Id, r]));
      for (const entry of ruleKeyMapping) {
        const rec = recordById.get(entry.recordId);
        if (rec) {
          entry.metadata = {
            sequenceNumber: rec.SequenceNumber,
            effectiveFromDate: rec.EffectiveFromDate,
            effectiveToDate: rec.EffectiveToDate,
            isProrationAllowed: rec.IsProrationAllowed,
            isRefundAllowed: rec.IsRefundAllowed,
            isActive: rec.IsActive,
            ruleEngineType: rec.RuleEngineType,
            productPath: rec.ProductPath,
          };
        }
      }

      ruleKeyMapping.forEach((m) => this.log(`  -> ${m.name} => ${m.ruleKey}`));

      // Write per-product files
      const cmlPath = `${workspaceDir}/${safeProductCode}.cml`;
      const associationsPath = `${workspaceDir}/${safeProductCode}_Associations.csv`;
      const mappingPath = `${workspaceDir}/${safeProductCode}_RuleKeyMapping.json`;

      await fs.writeFile(cmlPath, cmlModel.generateCml(), 'utf8');
      await fs.writeFile(associationsPath, generateCsvForAssociations(safeProductCode, cmlModel.associations), 'utf8');
      await fs.writeFile(mappingPath, JSON.stringify(ruleKeyMapping, null, 2), 'utf8');

      this.log(`  CML: ${cmlPath}`);
      this.log(`  Associations: ${associationsPath}`);
      this.log(`  Mapping: ${mappingPath}`);

      outputs.push({
        productCode,
        cmlFile: cmlPath,
        associationsFile: associationsPath,
        mappingFile: mappingPath,
        ruleCount: ruleKeyMapping.length,
      });
      allRuleKeyMapping.push(...ruleKeyMapping);
    }

    this.log(`\nConverted ${allRuleKeyMapping.length} rules across ${outputs.length} product(s)`);

    let updatedRecords = 0;
    if (autoUpdate) {
      this.log('\nUpdating ProductSurcharge records with RuleEngineType and RuleKey...');
      updatedRecords = await this.updateRecordsInOrg(conn, allRuleKeyMapping);
    }

    this.log('\nNext steps:');
    this.log('  1. Review the generated .cml files');
    for (const output of outputs) {
      this.log(
        `  2. Import ${output.productCode}: sf cml import as-expression-set --cml-api ${output.productCode} --context-definition <CD_NAME> --target-org <org>`
      );
    }

    return { outputs, ruleKeyMapping: allRuleKeyMapping, updatedRecords };
  }

  private async loadRecords(
    flags: Record<string, unknown>,
    targetOrg: { getConnection: (v?: string) => Connection }
  ): Promise<ProductSurchargeRecord[]> {
    const surchargeFile = flags['surcharge-file'] as string | undefined;
    if (surchargeFile) {
      this.log(`Reading surcharges from file: ${surchargeFile}`);
      const contents = await fs.readFile(surchargeFile, 'utf8');
      return JSON.parse(contents) as ProductSurchargeRecord[];
    }

    this.log('Querying ProductSurcharge records from org...');
    const conn = targetOrg.getConnection(flags['api-version'] as string | undefined);
    const surchargeIds = flags['surcharge-ids'] as string | undefined;
    let soql =
      'SELECT Id, Name, RuleApiName, RuleDefinition, ProductPath, SequenceNumber, EffectiveFromDate, EffectiveToDate, IsProrationAllowed, IsRefundAllowed, IsActive, RuleEngineType FROM ProductSurcharge WHERE RuleApiName != null';
    if (surchargeIds) {
      const idList = surchargeIds
        .split(',')
        .map((id) => `'${id.trim()}'`)
        .join(',');
      soql += ` AND Id IN (${idList})`;
    }
    const result = await conn.query<ProductSurchargeRecord>(soql);
    this.log(`Found ${result.records.length} ProductSurcharge records with BRE rules`);
    return result.records;
  }

  private parseRuleDefinitions(
    records: ProductSurchargeRecord[]
  ): Array<{ record: RuleRecord; ruleDef: ParsedRuleDefinition }> {
    const parsed: Array<{ record: RuleRecord; ruleDef: ParsedRuleDefinition }> = [];
    for (const record of records) {
      if (!record.RuleDefinition) {
        this.warn(`Skipping ${record.Name}: no RuleDefinition`);
        continue;
      }
      try {
        const raw = JSON.parse(record.RuleDefinition) as { ruleApiName?: string; ruleCriteria?: unknown[] };
        parsed.push({
          record,
          ruleDef: {
            ...raw,
            name: record.Name,
            apiName: raw.ruleApiName ?? record.Name,
            productPath: record.ProductPath,
          } as ParsedRuleDefinition,
        });
      } catch {
        this.warn(`Failed to parse RuleDefinition for ${record.Name}`);
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

  private async updateRecordsInOrg(conn: Connection, ruleKeyMapping: RuleKeyEntry[]): Promise<number> {
    const updates = ruleKeyMapping.map((m) => ({
      Id: m.recordId,
      RuleEngineType: 'ConstraintEngine',
      RuleKey: m.ruleKey,
    }));

    const results = await conn.sobject('ProductSurcharge').update(updates);
    const resultArray = Array.isArray(results) ? results : [results];
    let successCount = 0;
    for (const result of resultArray) {
      if (result.success) {
        successCount++;
      } else {
        const id = 'id' in result ? result.id : 'unknown';
        const errors = 'errors' in result ? JSON.stringify(result.errors) : 'unknown error';
        this.warn(`Failed to update ${id}: ${errors}`);
      }
    }
    this.log(`Updated ${successCount}/${ruleKeyMapping.length} ProductSurcharge records`);
    return successCount;
  }
}
