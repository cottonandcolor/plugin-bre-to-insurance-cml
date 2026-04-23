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
import { Connection } from '@salesforce/core';
import { PCMProduct, PCMProductComponentGroup } from './pcm-products.types.js';
import { unescapeHtml } from './utils/common.utils.js';

const PCM_PRODUCTS_BULK_LIMIT = 20;
const PCM_PRODUCTS_BULK_URI = '/connect/pcm/products/bulk';

export type ProductWithIds = {
  product: PCMProduct;
  productIds: string[];
};

export async function fetchProductsFromPcm(
  conn: Connection,
  allProductIds: string[]
): Promise<Map<string, PCMProduct>> {
  const chunk = (arr: string[], size: number): string[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

  const getPostBulkBody = (
    productIds: string[]
  ): {
    correlationId: string;
    productIds: string[];
    uptoLevel?: number;
    additionalFields?: string[];
  } => ({
    correlationId: `${Date.now()}`,
    productIds,
  });

  const fetchPromises = chunk(allProductIds, PCM_PRODUCTS_BULK_LIMIT).map(async (productIds) =>
    conn.requestPost<{ products: PCMProduct[] }>(PCM_PRODUCTS_BULK_URI, getPostBulkBody(productIds))
  );
  const allProducts = new Map<string, PCMProduct>();
  (await Promise.all(fetchPromises))
    .flatMap((resp) => resp.products)
    .forEach((p) => allProducts.set(p.id, unescapeProductName(p)));
  return allProducts;
}

/**
 * Do unescape of PCMProduct.name recursively.
 * - &amp; -> &
 *
 * @param {PCMProduct} product - PCM product.
 * @returns {PCMProduct} PCM Product with unescaped name.
 */
function unescapeProductName(product: PCMProduct): PCMProduct {
  product.name = unescapeHtml(product.name);
  product.childProducts?.forEach((childProduct) => unescapeProductName(childProduct));
  product.productComponentGroups?.forEach((group) => unescapeProductNameInPCGroup(group));
  return product;
}

// helper function for unescapeProductName
function unescapeProductNameInPCGroup(productComponentGroup: PCMProductComponentGroup): void {
  productComponentGroup.childGroups?.forEach((childGroup) => unescapeProductNameInPCGroup(childGroup));
  productComponentGroup.components?.forEach((component) => unescapeProductName(component));
}

/**
 * Reduces products map to only those products that are not contained in any other bundle product.
 *
 * @param {Map} productMap - Map of PCM products.
 * @returns {Map} Reduced map of PCM products with all ids presented in PCM products structure.
 */
export function reduceProductsToRootLevelOnly(productMap: Map<string, PCMProduct>): Map<string, ProductWithIds> {
  const newMap = new Map<string, ProductWithIds>();
  for (const [productId, product] of productMap) {
    newMap.set(productId, { product, productIds: collectProductIds(product) });
  }
  for (const [productId] of productMap) {
    for (const [, bundleProduct] of newMap) {
      if (isBundleContainsProduct(bundleProduct.product, productId)) {
        newMap.delete(productId);
        break;
      }
    }
  }
  return newMap;
}

/**
 * Checks if bundle product contains product with id in PCM structure.
 *
 * @param {PCMProduct} bundleProduct - Bundle product.
 * @param {string} productId - Product ID to check.
 * @returns {boolean} Is bundleProduct contains product with id in PCM structure.
 */
function isBundleContainsProduct(bundleProduct: PCMProduct, productId: string): boolean {
  if (bundleProduct.nodeType !== 'bundleProduct') {
    return false;
  }
  for (const childProduct of bundleProduct.childProducts) {
    if (childProduct.id === productId) {
      return true;
    }
    const isContains = isBundleContainsProduct(childProduct, productId);
    if (isContains) {
      return true;
    }
  }
  return bundleProduct.productComponentGroups.some((pcg) => isProductComponentGroupContainsProductId(pcg, productId));
}

/**
 * Checks if product component group contains product with id.
 *
 * @param {PCMProductComponentGroup} productComponentGroup - Product component group of PCM structure.
 * @param {string} productId - Product ID to check.
 * @returns {boolean} Is productComponentGroup contains product with id.
 */
function isProductComponentGroupContainsProductId(
  productComponentGroup: PCMProductComponentGroup,
  productId: string
): boolean {
  return (
    productComponentGroup.components.some(
      (comp) => comp.id === productId || isBundleContainsProduct(comp, productId)
    ) || productComponentGroup.childGroups.some((cg) => isProductComponentGroupContainsProductId(cg, productId))
  );
}

/**
 * Collects product IDs that are presented in PCM structure of provided product
 *
 * @param {PCMProduct} product - PCM Product.
 * @returns {Array} Array of product IDs that are presented in PCM structure of provided product.
 */
function collectProductIds(product: PCMProduct): string[] {
  const productIds = new Set<string>([product.id]);
  if (product.nodeType === 'bundleProduct') {
    for (const childProduct of product.childProducts) {
      productIds.add(childProduct.id);
      if (childProduct.nodeType === 'bundleProduct') {
        collectProductIds(childProduct).forEach((id) => productIds.add(id));
      }
    }
    for (const pcg of product.productComponentGroups) {
      collectProductIdsInProductComponentGroup(pcg).forEach((id) => productIds.add(id));
    }
  }
  return Array.from(productIds);
}

/**
 * Collects product IDs that are presented in PCM structure of provided product component group
 *
 * @param {PCMProductComponentGroup} productComponentGroup - PCM Product Component Group.
 * @returns {Array} Array of product IDs that are presented in PCM structure of provided product component group.
 */
function collectProductIdsInProductComponentGroup(productComponentGroup: PCMProductComponentGroup): Set<string> {
  const productIds = new Set<string>();
  for (const comp of productComponentGroup.components) {
    collectProductIds(comp).forEach((id) => productIds.add(id));
  }
  for (const cg of productComponentGroup.childGroups) {
    collectProductIdsInProductComponentGroup(cg).forEach((id) => productIds.add(id));
  }
  return productIds;
}
