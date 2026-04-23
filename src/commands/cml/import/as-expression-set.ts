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
import { Messages } from '@salesforce/core';
import { parse as csvParse } from 'csv-parse/sync';
import { ExpressionSetConstraintObj, ExpressionSetConstraintObjCustom } from '../../../shared/types/types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-bre-to-cml', 'cml.import.as-expression-set');

export type CmlImportAsExpressionSetResult = {
  path: string;
};

export default class CmlImportAsExpressionSet extends SfCommand<CmlImportAsExpressionSetResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'context-definition': Flags.string({
      summary: messages.getMessage('flags.context-definition.summary'),
      char: 'x',
      required: true,
    }),
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
  };

  public async run(): Promise<CmlImportAsExpressionSetResult> {
    const { flags } = await this.parse(CmlImportAsExpressionSet);

    const cmlApiName = flags['cml-api'];
    const contextDefinitionName = flags['context-definition'];
    const targetOrg = flags['target-org'];
    const workspaceDir = flags['workspace-dir'];

    this.log(`Using Target Org: ${targetOrg.getUsername() ?? 'unknown'}`);
    this.log(`Using Context Definition: ${contextDefinitionName}`);
    this.log(`Using CML API: ${cmlApiName}`);
    this.log(`Using Workspace Directory: ${workspaceDir ?? 'not specified'}`);

    const conn = targetOrg.getConnection(flags['api-version']);

    const cmlFileName = `${cmlApiName}.cml`;
    const associationsFileName = `${cmlApiName}_Associations.csv`;
    const cmlFullPath = workspaceDir ? `${workspaceDir}/${cmlFileName}` : cmlFileName;
    const associationsFullPath = workspaceDir ? `${workspaceDir}/${associationsFileName}` : associationsFileName;

    const cmlContent = await fs.readFile(cmlFullPath, 'utf8');

    const contextDefinition = await conn
      .sobject('ContextDefinition')
      .findOne({ DeveloperName: contextDefinitionName }, ['Id', 'DeveloperName']);

    if (!contextDefinition?.Id) {
      this.error(`❌ Can't find '${contextDefinitionName}' context definition`);
    }

    this.log('📦 Create required expression set objects');

    const { Id: existingExpressionSetId } =
      (await conn.sobject('ExpressionSet').findOne({ ApiName: cmlApiName }, ['Id'])) ?? {};
    const { id: expressionSetId } = existingExpressionSetId
      ? { id: existingExpressionSetId }
      : await conn.sobject('ExpressionSet').create({
          ApiName: cmlApiName,
          Name: cmlApiName,
          UsageType: 'Constraint',
          ResourceInitializationType: 'Off',
          InterfaceSourceType: 'Constraint',
        });
    const { Id: expressionSetDefinitionId } =
      (await conn.sobject('ExpressionSetDefinition').findOne({ DeveloperName: cmlApiName }, ['Id'])) ?? {};
    const { Id: expressionSetDefinitionVersionId } =
      (await conn
        .sobject('ExpressionSetDefinitionVersion')
        .findOne({ ExpressionSetDefinitionId: expressionSetDefinitionId }, ['Id'])) ?? {};
    await conn
      .sobject('ExpressionSetDefinitionContextDefinition')
      .create({ ExpressionSetDefinitionId: expressionSetDefinitionId, ContextDefinitionId: contextDefinition?.Id });

    this.log('✅ Created expression set objects');

    this.log('📦 Update ExpressionSetDefinitionVersion with CML content');

    const base64CmlContent = Buffer.from(cmlContent, 'binary').toString('base64');
    await conn.requestPatch(`/sobjects/ExpressionSetDefinitionVersion/${expressionSetDefinitionVersionId!}`, {
      ConstraintModel: base64CmlContent,
    });

    this.log('✅ CML content uploaded');

    this.log('📦 Prepare CML associations');

    const associations = await this.readCsv<ExpressionSetConstraintObjCustom>(associationsFullPath);
    const typeAssociations = associations.filter((a) => a.ConstraintModelTagType === 'Type');
    const portAssociations = associations.filter((a) => a.ConstraintModelTagType === 'Port');

    const productNameToId = new Map<string, string>();
    const productIdsStr = typeAssociations
      .filter(({ $Product2ReferenceId }) => !!$Product2ReferenceId)
      .map(({ $Product2ReferenceId }) => `'${$Product2ReferenceId}'`)
      .join(',');
    if (productIdsStr?.length) {
      const productsSoql = `SELECT Id,Name FROM Product2 WHERE Name IN (${productIdsStr})`;
      const productsQuery = await conn.query(productsSoql, { autoFetch: true });
      productsQuery.records.forEach((r) => productNameToId.set(`${r.Name as string}`, `${r.Id as string}`));
    }

    const classNameToId = new Map<string, string>();
    const classIdsStr = typeAssociations
      .filter(({ $ProductClassificationName }) => !!$ProductClassificationName)
      .map(({ $ProductClassificationName }) => `'${$ProductClassificationName}'`)
      .join(',');
    if (classIdsStr?.length) {
      const classificationsSoql = `SELECT Id,Name FROM ProductClassification WHERE Name IN (${classIdsStr})`;
      const classificationsQuery = await conn.query(classificationsSoql, { autoFetch: true });
      classificationsQuery.records.forEach((r) => classNameToId.set(`${r.Name as string}`, `${r.Id as string}`));
    }

    const parentAndChildToPrcId = new Map<string, Map<string, string>>();
    const parentProductIds: string[] = [...productNameToId.values()];
    if (parentProductIds.length > 0) {
      const prcSoql = `SELECT Id, ParentProductId, ChildProductId, ChildProductClassificationId FROM ProductRelatedComponent WHERE ParentProductId IN (${parentProductIds
        .map((id) => `'${id}'`)
        .join(',')})`;
      (await conn.query(prcSoql, { autoFetch: true })).records.forEach((r) => {
        if (!parentAndChildToPrcId.has(r.ParentProductId as string)) {
          parentAndChildToPrcId.set(r.ParentProductId as string, new Map<string, string>());
        }
        const childToPrcId = parentAndChildToPrcId.get(r.ParentProductId as string);
        childToPrcId?.set(
          (r.ChildProductId as string) ?? (r.ChildProductClassificationId as string) ?? 'unexpected',
          (r.Id as string) ?? 'unexpected'
        );
      });
    }

    const newAssociations = [
      ...typeAssociations.map(
        (a) =>
          ({
            ExpressionSetId: expressionSetId,
            ConstraintModelTag: a.ConstraintModelTag,
            ConstraintModelTagType: 'Type',
            ReferenceObjectId: a.ReferenceObjectId.startsWith('01t')
              ? productNameToId.get(a.$Product2ReferenceId)
              : classNameToId.get(a.$ProductClassificationName),
          } as ExpressionSetConstraintObj)
      ),
      ...portAssociations.map((a) => {
        const [parentProductName, childProductName, childClassName] = a.$ProductRelatedComponentKey.split('||');
        const parentProductId = productNameToId.get(parentProductName) ?? 'unexpected';
        const childProductIdOrClassId =
          (childProductName ? productNameToId.get(childProductName) : classNameToId.get(childClassName)) ??
          'unexpected';
        const prcId = parentAndChildToPrcId.get(parentProductId)?.get(childProductIdOrClassId);
        return {
          ExpressionSetId: expressionSetId,
          ConstraintModelTag: a.ConstraintModelTag,
          ConstraintModelTagType: 'Port',
          ReferenceObjectId: prcId,
        } as ExpressionSetConstraintObj;
      }),
    ];

    const escoSoql = `SELECT Id, ExpressionSetId, ConstraintModelTag, ConstraintModelTagType, ReferenceObjectId FROM ExpressionSetConstraintObj WHERE ExpressionSetId = '${expressionSetId!}'`;
    const escos = (await conn.query(escoSoql, { autoFetch: true })).records.map(
      (esco) => esco as ExpressionSetConstraintObj
    );

    this.log('📦 Upload CML associations');
    const associationtsToInsert = newAssociations.filter(
      ({ ConstraintModelTag, ConstraintModelTagType, ReferenceObjectId }) =>
        !escos.some(
          (esco) =>
            ConstraintModelTag === esco.ConstraintModelTag &&
            ConstraintModelTagType === esco.ConstraintModelTagType &&
            ReferenceObjectId === esco.ReferenceObjectId
        )
    );
    const saveResults = await conn.sobject('ExpressionSetConstraintObj').create(associationtsToInsert);
    this.log('✅ Uploaded CML associations:');
    if (escos.length) {
      this.log(`  existing associations: ${escos.map(({ Id }) => Id).join(', ')}`);
    }
    if (saveResults.length) {
      this.log(`  new associations: ${saveResults.map((r) => r.id).join(', ')}`);
    }

    this.log('✅ Done');

    return {
      path: 'src/commands/cml/import/as-expression-set.ts',
    };
  }

  private async readCsv<T>(fullPath: string): Promise<T[]> {
    const fileContent = await fs.readFile(fullPath, 'utf8');
    if (!fileContent.trim()) {
      this.error(`❌ Error reading ${fullPath}: File ${fullPath} is empty`);
    }

    const records = csvParse(fileContent, { bom: true, columns: true, skipEmptyLines: true }) as unknown;
    if (!Array.isArray(records)) {
      this.error(`❌ Error reading ${fullPath}: Invalid CSV format in ${fullPath}`);
    }

    return records as T[];
  }
}
