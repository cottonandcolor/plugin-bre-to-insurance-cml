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

type ExpressionSetConstraintObjRecord = {
  ExpressionSetId: string;
};

type ExpressionSetVersionRecord = {
  Id: string;
  ExpressionSetDefinitionVerId: string;
  VersionNumber: number;
};

/**
 * Fetch existing CML content from the org for a given root product ID.
 *
 * Lookup chain:
 *   ProductPath root ID
 *     → ExpressionSetConstraintObj (ReferenceObjectId = productId, TagType = 'Type')
 *       → ExpressionSetVersion (latest by VersionNumber)
 *         → ExpressionSetDefinitionVersion.ConstraintModel (blob)
 *
 * Returns the CML string or null if no constraint model exists for the product.
 */
export async function fetchExistingCmlFromOrg(
  conn: Connection,
  rootProductId: string
): Promise<{ cml: string; expressionSetId: string } | null> {
  // Step 1: Find ExpressionSetConstraintObj for this product
  const assocResult = await conn.query<ExpressionSetConstraintObjRecord>(
    `SELECT ExpressionSetId FROM ExpressionSetConstraintObj WHERE ReferenceObjectId = '${rootProductId}' AND ConstraintModelTagType = 'Type' LIMIT 1`
  );
  if (assocResult.records.length === 0) {
    return null;
  }
  const expressionSetId = assocResult.records[0].ExpressionSetId;

  // Step 2: Get the latest ExpressionSetVersion
  const versionResult = await conn.query<ExpressionSetVersionRecord>(
    `SELECT Id, ExpressionSetDefinitionVerId, VersionNumber FROM ExpressionSetVersion WHERE ExpressionSetId = '${expressionSetId}' ORDER BY VersionNumber DESC LIMIT 1`
  );
  if (versionResult.records.length === 0) {
    return null;
  }
  const defVersionId = versionResult.records[0].ExpressionSetDefinitionVerId;

  // Step 3: Fetch the CML blob
  const blobUrl = `/services/data/v68.0/sobjects/ExpressionSetDefinitionVersion/${defVersionId}/ConstraintModel`;
  const response = await conn.request<string>({ method: 'GET', url: blobUrl });
  if (!response) {
    return null;
  }

  return { cml: response as unknown as string, expressionSetId };
}

/**
 * Fetch existing CML for all unique root product IDs from a set of records.
 * Returns a map of rootProductId → CML content string.
 * If multiple products share the same ExpressionSet, only one fetch is made.
 */
export async function fetchExistingCmlForProducts(
  conn: Connection,
  rootProductIds: Set<string>
): Promise<Map<string, string>> {
  const productToCml = new Map<string, string>();
  const fetchedExpressionSets = new Set<string>();

  for (const productId of rootProductIds) {
    const result = await fetchExistingCmlFromOrg(conn, productId);
    if (result && !fetchedExpressionSets.has(result.expressionSetId)) {
      productToCml.set(productId, result.cml);
      fetchedExpressionSets.add(result.expressionSetId);
    }
  }

  return productToCml;
}
