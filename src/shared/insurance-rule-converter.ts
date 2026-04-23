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
import {
  BASE_LINE_ITEM_TYPE_NAME,
  CmlAttribute,
  CmlConstraint,
  CmlModel,
  CmlType,
  Association,
} from './types/types.js';
import { CML_DATA_TYPES, CONSTRAINT_TYPES, ASSOCIATION_TYPES } from './constants/constants.js';

export type RuleCondition = {
  contextTagName?: string;
  operator: string;
  conditionIndex?: number;
  attributeName?: string;
  attributePicklistValueId?: string;
  attributeId?: string;
  dataType?: string;
  type?: string;
  values?: string[];
};

export type RuleCriteria = {
  rootObjectId: string;
  criteriaIndex?: number;
  sourceContextTagName?: string;
  sourceOperator?: string;
  sourceDataType?: string;
  sourceValues?: string[];
  conditions?: RuleCondition[];
};

export type ParsedRuleDefinition = {
  name: string;
  apiName: string;
  productPath: string;
  status?: string;
  description?: string;
  criteriaExpressionType?: string;
  ruleCriteria?: RuleCriteria[];
};

export type RuleRecord = {
  Id: string;
  Name: string;
  ProductPath: string;
};

export type RuleKeyEntry = {
  recordId: string;
  name: string;
  ruleKey: string;
};

function doubleQuoted(value: string | undefined): string {
  return `"${value ?? ''}"`;
}

function operatorToCml(op: string): string | null {
  switch (op) {
    case 'Equals':
      return '==';
    case 'NotEquals':
      return '!=';
    case 'LessThan':
      return '<';
    case 'LessThanOrEquals':
      return '<=';
    case 'GreaterThan':
      return '>';
    case 'GreaterThanOrEquals':
      return '>=';
    case 'Contains':
    case 'DoesNotContain':
    case 'In':
    case 'NotIn':
      return null; // handled separately
    default:
      return '==';
  }
}

function dataTypeToCml(dataType?: string): string {
  const types: Record<string, string> = {
    Number: CML_DATA_TYPES.INTEGER,
    Integer: CML_DATA_TYPES.INTEGER,
    Percent: CML_DATA_TYPES.DECIMAL,
    Currency: CML_DATA_TYPES.DECIMAL,
    Boolean: CML_DATA_TYPES.BOOLEAN,
    Date: CML_DATA_TYPES.DATE,
    DateTime: CML_DATA_TYPES.DATE,
    Picklist: CML_DATA_TYPES.STRING,
  };
  return (dataType && types[dataType]) ?? CML_DATA_TYPES.STRING;
}

export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

export function generateRuleKey(prefix: string, productCode: string, apiName: string): string {
  return `${prefix}__${sanitizeName(productCode)}__${sanitizeName(apiName)}`;
}

function formatValue(value: string, cmlDataType: string): string {
  const isNumeric = cmlDataType === CML_DATA_TYPES.INTEGER || cmlDataType === CML_DATA_TYPES.DECIMAL;
  return isNumeric ? value : doubleQuoted(value);
}

function generateInExpression(left: string, values: string[], cmlDataType: string): string {
  if (values.length === 1) {
    return `${left} == ${formatValue(values[0], cmlDataType)}`;
  }
  return values.map((v) => `${left} == ${formatValue(v, cmlDataType)}`).join(' || ');
}

function resolveConditionName(condition: RuleCondition): string {
  if (condition.type === 'Attribute' && condition.attributeName) {
    return condition.attributeName;
  }
  if (condition.type === 'Tag' && condition.contextTagName) {
    return condition.contextTagName;
  }
  return condition.attributeName ?? condition.contextTagName ?? 'unknown';
}

function buildConditionExpression(condition: RuleCondition): string | null {
  if (!condition.values || condition.values.length === 0) return null;

  const rawName = resolveConditionName(condition);
  const attrName = sanitizeName(rawName);
  const cmlDataType = dataTypeToCml(condition.dataType);
  const values = condition.values;

  switch (condition.operator) {
    case 'Contains':
      return `strcontain(${attrName}, ${doubleQuoted(values[0])})`;
    case 'DoesNotContain':
      return `!strcontain(${attrName}, ${doubleQuoted(values[0])})`;
    case 'In':
      return `(${generateInExpression(attrName, values, cmlDataType)})`;
    case 'NotIn':
      return `!(${generateInExpression(attrName, values, cmlDataType)})`;
    default: {
      const op = operatorToCml(condition.operator);
      if (!op) return null;
      return `${attrName} ${op} ${formatValue(values[0], cmlDataType)}`;
    }
  }
}

function buildCriteriaExpression(criteria: RuleCriteria): string | null {
  const parts: string[] = [];

  if (criteria.sourceContextTagName === 'Product' && criteria.sourceValues && criteria.sourceValues.length > 0) {
    if (criteria.sourceValues.length === 1) {
      parts.push(`product.id == ${doubleQuoted(criteria.sourceValues[0])}`);
    } else {
      parts.push(`(${generateInExpression('product.id', criteria.sourceValues, CML_DATA_TYPES.STRING)})`);
    }
  }

  if (criteria.conditions) {
    for (const condition of criteria.conditions) {
      const expr = buildConditionExpression(condition);
      if (expr) parts.push(expr);
    }
  }

  return parts.length > 0 ? parts.join(' && ') : null;
}

export function buildConstraintDeclaration(ruleDef: {
  criteriaExpressionType?: string;
  ruleCriteria?: RuleCriteria[];
}): string {
  if (!ruleDef.ruleCriteria || ruleDef.ruleCriteria.length === 0) {
    return 'true';
  }

  const expressions = ruleDef.ruleCriteria.map(buildCriteriaExpression).filter((e): e is string => e !== null);

  if (expressions.length === 0) return 'true';
  if (expressions.length === 1) return expressions[0];

  const joiner = ruleDef.criteriaExpressionType?.toUpperCase() === 'ALL' ? ' && ' : ' || ';
  return expressions.map((e) => `(${e})`).join(joiner);
}

export function collectAttributes(
  ruleDefs: Array<{ ruleDef: { ruleCriteria?: RuleCriteria[] } }>
): Map<string, { name: string; attributeId: string | null; cmlDataType: string }> {
  const attrs = new Map<string, { name: string; attributeId: string | null; cmlDataType: string }>();
  for (const { ruleDef } of ruleDefs) {
    for (const criteria of ruleDef.ruleCriteria ?? []) {
      for (const cond of criteria.conditions ?? []) {
        const name = resolveConditionName(cond);
        if (name && !attrs.has(name)) {
          attrs.set(name, {
            name,
            attributeId: cond.attributeId ?? null,
            cmlDataType: dataTypeToCml(cond.dataType),
          });
        }
      }
    }
  }
  return attrs;
}

export async function fetchProductCodes(conn: Connection, productIds: Set<string>): Promise<Map<string, string>> {
  const idToCode = new Map<string, string>();
  if (productIds.size === 0) return idToCode;

  const idList = Array.from(productIds)
    .map((id) => `'${id}'`)
    .join(',');
  const result = await conn.query<{ Id: string; ProductCode: string }>(
    `SELECT Id, ProductCode FROM Product2 WHERE Id IN (${idList})`
  );
  for (const p of result.records) {
    idToCode.set(p.Id, p.ProductCode ?? p.Id);
  }
  return idToCode;
}

export function buildCmlModel(
  ruleDefs: Array<{ record: RuleRecord; ruleDef: ParsedRuleDefinition }>,
  productIdToCode: Map<string, string>,
  keyPrefix: string,
  constraintLabel: string
): { cmlModel: CmlModel; ruleKeyMapping: RuleKeyEntry[] } {
  const cmlModel = new CmlModel();
  const lineItemType = new CmlType(BASE_LINE_ITEM_TYPE_NAME, undefined, undefined);

  const attrMap = collectAttributes(ruleDefs);
  lineItemType.addAttribute(new CmlAttribute(null, 'product_id', CML_DATA_TYPES.STRING));
  for (const [, attr] of attrMap) {
    lineItemType.addAttribute(new CmlAttribute(attr.attributeId, sanitizeName(attr.name), attr.cmlDataType));
  }
  cmlModel.addType(lineItemType);

  const ruleKeyMapping: RuleKeyEntry[] = [];
  for (const { record, ruleDef } of ruleDefs) {
    const rootProductId = ruleDef.ruleCriteria?.[0]?.rootObjectId ?? record.ProductPath.split('/')[0];
    const productCode = productIdToCode.get(rootProductId) ?? rootProductId;
    const apiName = ruleDef.apiName ?? record.Name;
    const ruleKey = generateRuleKey(keyPrefix, productCode, apiName);

    const constraint = new CmlConstraint(
      CONSTRAINT_TYPES.CONSTRAINT,
      buildConstraintDeclaration(ruleDef),
      `"${constraintLabel}: ${record.Name}"`
    );
    constraint.name = sanitizeName(apiName);
    lineItemType.addConstraint(constraint);

    cmlModel.addAssociation(
      new Association(null, BASE_LINE_ITEM_TYPE_NAME, ASSOCIATION_TYPES.TYPE, rootProductId, 'Product2', productCode)
    );

    ruleKeyMapping.push({ recordId: record.Id, name: record.Name, ruleKey });
  }

  return { cmlModel, ruleKeyMapping };
}
