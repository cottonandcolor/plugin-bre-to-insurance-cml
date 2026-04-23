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
import { ConfiguratorRuleInput } from '../../../shared/models.js';
import { extractProductIds, groupByNonIntersectingProduct2 } from '../../../shared/grouping.js';
import { fetchProductsFromPcm, ProductWithIds, reduceProductsToRootLevelOnly } from '../../../shared/pcm-products.js';
import { BreRulesGenerator } from '../../../shared/bre-rules-generator.js';
import { PcmGenerator } from '../../../shared/pcm-generator.js';
import { BASE_LINE_ITEM_TYPE_NAME, CmlModel, CmlType } from '../../../shared/types/types.js';
import { PCMProduct } from '../../../shared/pcm-products.types.js';
import { generateCsvForAssociations } from '../../../shared/utils/association.utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-bre-to-cml', 'cml.convert.prod-cfg-rules');

export type CmlConvertProdCfgRulesResult = {
  path: string;
};

function newCmlModel(): CmlModel {
  const cmlModel = new CmlModel();

  const lineItemType = new CmlType(BASE_LINE_ITEM_TYPE_NAME, undefined, undefined);
  cmlModel.addType(lineItemType);

  return cmlModel;
}

export default class CmlConvertProdCfgRules extends SfCommand<CmlConvertProdCfgRulesResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'pcr-file': Flags.file({
      summary: messages.getMessage('flags.pcr-file.summary'),
      char: 'r',
      required: true,
      exists: true,
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
    'additional-products': Flags.string({
      summary: messages.getMessage('flags.additional-products.summary'),
      char: 'x',
      exists: true,
    }),
    'products-file': Flags.file({
      summary: messages.getMessage('flags.products-file.summary'),
      char: 'v',
      exists: true,
    }),
  };

  public async run(): Promise<CmlConvertProdCfgRulesResult> {
    const { flags } = await this.parse(CmlConvertProdCfgRules);

    const api = flags['cml-api'];
    const pcrFile = flags['pcr-file'];
    const workspaceDir = flags['workspace-dir'];
    const targetOrg = flags['target-org'];

    this.log(`Using CML API: ${api}`);
    this.log(`Using PCR File: ${pcrFile}`);
    this.log(`Using Workspace Directory: ${workspaceDir ?? 'not specified'}`);
    this.log(`Using Target Org: ${targetOrg.getUsername() ?? 'unknown'}`);

    const pcrFileContents = await fs.readFile(pcrFile, 'utf8');
    const pcrData = JSON.parse(pcrFileContents) as Array<{
      ApiName: string;
      Name: string;
      Description: string;
      Sequence: string;
      Status: string;
      EffectiveFromDate: string;
      EffectiveToDate?: string;
      ConfigurationRuleDefinition: string;
    }>;

    const rules: ConfiguratorRuleInput[] = [];

    for (const raw of pcrData) {
      try {
        const parsed = JSON.parse(raw.ConfigurationRuleDefinition) as ConfiguratorRuleInput;
        rules.push(parsed);
      } catch {
        this.warn(`❌ Failed to parse ConfigurationRuleDefinition for rule: ${raw.Name}`);
      }
    }

    try {
      this.log(`Parsed ${rules.length} valid configuration rules`);

      rules.sort((l, r) => (l.sequence ?? 0) - (r.sequence ?? 0));
      const groups = groupByNonIntersectingProduct2(rules);
      this.log(`Found ${groups.size} non-intersecting Product2 groups`);

      if (!api || typeof api !== 'string') {
        throw new Error(`Expected non-empty --cml-api string, got: ${api}`);
      }
      const safeApi = api.replace(/[^a-zA-Z0-9_-]/g, '_');

      const uniqProductIds: Set<string> = new Set();
      const additionalProductIds = flags['additional-products']?.split(',')?.map((p) => p.trim()) ?? [];
      rules
        .map(extractProductIds)
        .flatMap((set) => [...set])
        .forEach((p) => uniqProductIds.add(p));
      additionalProductIds.forEach((p) => uniqProductIds.add(p));

      let products: Map<string, PCMProduct>;
      const productsFile = flags['products-file'];
      if (productsFile) {
        const prods = JSON.parse(await fs.readFile(productsFile, 'utf8')) as { [k: string]: PCMProduct };
        products = new Map<string, PCMProduct>(Object.entries(prods));
      } else {
        const conn = targetOrg.getConnection(flags['api-version']);
        products = await fetchProductsFromPcm(conn, Array.from(uniqProductIds));
      }

      this.log('📦 Convert products and BRE rules to CML');

      /*
       * We need to reduce the products to have on top level only bundle products and simple products
       * that are not contained in any other bundle product structure.
       *
       * In example, we have products in map:
       * - Laptop Pro Bundle
       * - Laptop
       * - Printer Bundle
       * - "Some Product Not From Laptop Pro Bundle"
       *
       * We need to reduce it to:
       * - Laptop Pro Bundle
       * - "Some Product Not From Laptop Pro Bundle"
       */
      const rootLevelProducts = reduceProductsToRootLevelOnly(products);

      const isProductIdInProductWithIds = (productId: string, productWithIds: ProductWithIds): boolean =>
        productWithIds.productIds.includes(productId) ||
        productWithIds.productIds.some((pId) => pId.startsWith(productId) || productId.startsWith(pId));

      const findProductWithIdsByProductIds = (productIds: string[]): ProductWithIds[] => {
        const result = new Set<ProductWithIds>();
        for (const productId of productIds) {
          for (const productWithIds of rootLevelProducts.values()) {
            if (isProductIdInProductWithIds(productId, productWithIds)) {
              result.add(productWithIds);
              break;
            }
          }
        }
        return Array.from(result);
      };

      /*
       * Group non-intersecting rules groups by top-level products.
       *
       * In example, we have rules for products:
       * - Rule1 - for Laptop and Mouse
       * - Rule2 - for Printer and Printer Paper
       * - Rule3 - for Mouse
       * - Rule4 - for "Some Product Not From Laptop Pro Bundle"
       *
       * These rules will be grouped by top-level products:
       * - Laptop Pro Bundle - Rule1, Rule2, Rule3
       * - "Some Product Not From Laptop Pro Bundle" - Rule4
       */
      const productsWithRules = new Map<ProductWithIds[], ConfiguratorRuleInput[]>();
      for (const [group, rulesInGroup] of groups) {
        const productIdsInGroup = group.split(',');
        // Find top-level products for given rules group.
        const productsForRulesInGroup = findProductWithIdsByProductIds(Array.from(productIdsInGroup));
        let found = false;
        for (const [targetGroupProducts, targetGroupRules] of productsWithRules) {
          // If there is any product that is in both groups, then we can merge them.
          if (
            targetGroupProducts.some((pwi) =>
              productsForRulesInGroup.some((pwiInGroup) => isProductIdInProductWithIds(pwiInGroup.product.id, pwi))
            )
          ) {
            // Merge rules and products.
            rulesInGroup
              .filter((ruleInGroup) => !targetGroupRules.some(({ apiName }) => apiName === ruleInGroup.apiName))
              .forEach((ruleInGroup) => targetGroupRules.push(ruleInGroup));
            productsForRulesInGroup
              .filter(
                (pwiInGroup) =>
                  !targetGroupProducts.some((pwi) => isProductIdInProductWithIds(pwiInGroup.product.id, pwi))
              )
              .forEach((pwiInGroup) => targetGroupProducts.push(pwiInGroup));
            found = true;
            break;
          }
        }
        // If no product was found, then we can add new group.
        if (!found) {
          productsWithRules.set(productsForRulesInGroup, rulesInGroup);
        }
      }

      // Generate CML for each group of products and rules.
      let index = 0;
      const genCmlPromises = Array.from(productsWithRules.entries()).map(([productsWithIds, rulesInGroup]) =>
        this.generateCmlForProductsAndRulesGroup(rulesInGroup, productsWithIds, safeApi, index++, workspaceDir)
      );

      await Promise.all(genCmlPromises);

      this.log('✅ Done');

      return {
        path: `${workspaceDir ?? '.'}/${safeApi}_0.cml`,
      };
    } catch (e) {
      this.log('🔥 Caught error: ', e);
      this.log('🧵 Stack trace:', (e as Error).stack);
      throw e; // rethrow to preserve exit behavior
    }
  }

  /**
   * Generates CML model for given products and rules.
   *
   * @param {Array} rulesInGroup - Array of rules for given products.
   * @param {Array} productsWithIds - Array of products with ids.
   * @param {string} safeApi - Safe API name of target CML.
   * @param {number} index - Index of the group.
   * @param {string | undefined} workspaceDir - Workspace directory.
   */
  private async generateCmlForProductsAndRulesGroup(
    rulesInGroup: ConfiguratorRuleInput[],
    productsWithIds: ProductWithIds[],
    safeApi: string,
    index: number,
    workspaceDir: string | undefined
  ): Promise<void> {
    this.log(`📦 Generating CML model for rules ${rulesInGroup.map(({ apiName }) => apiName).join(', ')}`);

    const cmlModel = newCmlModel();
    const modelInfo = PcmGenerator.generateViewModels(
      cmlModel,
      productsWithIds.map(({ product }) => product)
    );
    for (const type of modelInfo.types) {
      modelInfo.attributes.get(type.name)?.forEach((attr) => type.addAttribute(attr));
      modelInfo.relations.get(type.name)?.forEach((rel) => type.addRelation(rel));
      cmlModel.addType(type);
    }
    for (const association of modelInfo.associations) {
      cmlModel.addAssociation(association);
    }

    BreRulesGenerator.generateConstraints(cmlModel, rulesInGroup, {
      info: (msg) => this.log(msg),
      warn: (msg) => this.warn(msg),
      error: (msg) => this.error(msg),
    });

    const cmlContent = cmlModel.generateCml();
    const associationsCsvContent = generateCsvForAssociations(safeApi, cmlModel.associations);

    const cmlFileName = `${safeApi}_${index}.cml`;
    const associationsFileName = `${safeApi}_${index}_Associations.csv`;
    const fullPath = workspaceDir ? `${workspaceDir}/${cmlFileName}` : cmlFileName;
    const associationsFullPath = workspaceDir ? `${workspaceDir}/${associationsFileName}` : associationsFileName;

    this.log(`📦 Writing CML content to ${cmlFileName}`);

    await fs.writeFile(fullPath, cmlContent, 'utf8');
    await fs.writeFile(associationsFullPath, associationsCsvContent, 'utf8');

    this.log(`✅ Wrote CML to ${fullPath} with related associations to ${associationsFullPath}`);
  }
}
