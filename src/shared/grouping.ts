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
import { ConfiguratorRuleInput, RuleCriteria } from './models.js';

function isProduct2Id(id: string | null | undefined): boolean {
  return id?.startsWith('01t') ?? false;
}

export function extractProductIdsFromRuleCriteria(criterion: RuleCriteria): Set<string> {
  const ids = new Set<string>();
  if (isProduct2Id(criterion.rootObjectId)) {
    ids.add(criterion.rootObjectId);
  }
  criterion.sourceValues?.forEach((v) => {
    if (isProduct2Id(v)) {
      ids.add(v);
    }
  });
  criterion.sourceInformation
    ?.filter((info) => info.name === 'Product')
    .flatMap((info) => info.values?.values ?? [])
    .filter(isProduct2Id)
    .forEach((v) => ids.add(v!));

  return ids;
}

export function extractProductIds(rule: ConfiguratorRuleInput): Set<string> {
  const ids = new Set<string>();

  for (const criterion of rule.criteria) {
    Array.from(extractProductIdsFromRuleCriteria(criterion)).forEach((p) => ids.add(p));
  }

  for (const action of rule.actions) {
    action.targetValues?.filter(isProduct2Id).forEach((v) => ids.add(v));
    action.targetInformation
      ?.filter((info) => info.name === 'Product')
      .flatMap((info) => info.values?.values ?? [])
      .filter(isProduct2Id)
      .forEach((v) => ids.add(v!));
  }

  return ids;
}

export function groupByNonIntersectingProduct2(rules: ConfiguratorRuleInput[]): Map<string, ConfiguratorRuleInput[]> {
  const ruleToProducts = new Map<ConfiguratorRuleInput, Set<string>>();
  const productToRules = new Map<string, Set<ConfiguratorRuleInput>>();

  for (const rule of rules) {
    const ids = extractProductIds(rule);
    ruleToProducts.set(rule, ids);
    for (const id of ids) {
      if (!productToRules.has(id)) {
        productToRules.set(id, new Set());
      }
      productToRules.get(id)!.add(rule);
    }
  }

  const parent = new Map<ConfiguratorRuleInput, ConfiguratorRuleInput>();

  const find = (x: ConfiguratorRuleInput): ConfiguratorRuleInput => {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  };

  const union = (x: ConfiguratorRuleInput, y: ConfiguratorRuleInput): void => {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX !== rootY) {
      parent.set(rootY, rootX);
    }
  };

  for (const rule of rules) {
    parent.set(rule, rule);
  }

  for (const linkedRules of productToRules.values()) {
    const [first, ...rest] = [...linkedRules];
    for (const rule of rest) {
      union(first, rule);
    }
  }

  const rootToGroup = new Map<ConfiguratorRuleInput, ConfiguratorRuleInput[]>();
  for (const rule of rules) {
    const root = find(rule);
    if (!rootToGroup.has(root)) {
      rootToGroup.set(root, []);
    }
    rootToGroup.get(root)!.push(rule);
  }

  const result = new Map<string, ConfiguratorRuleInput[]>();

  for (const group of rootToGroup.values()) {
    const ids = [...(ruleToProducts.get(group[0]) ?? [])];
    const key = ids.join(',');
    result.set(key, group);
  }

  return result;
}
