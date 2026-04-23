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
export type RuleScope = 'Product' | 'Bundle' | 'Transaction';
export type RuleConditionType = 'Tag' | 'Enum' | 'Attribute';

export type RuleConditionOperator =
  | 'Equals'
  | 'NotEquals'
  | 'LessThan'
  | 'LessThanOrEquals'
  | 'GreaterThan'
  | 'GreaterThanOrEquals'
  | 'IsNotNull'
  | 'IsNull'
  | 'Contains'
  | 'DoesNotContain'
  | 'In'
  | 'NotIn';

export type RuleActionType =
  | 'AutoAdd'
  | 'AutoRemove'
  | 'SetAttribute'
  | 'SetQuantity'
  | 'SetDefaultProduct'
  | 'SetDefaultAttributeValue'
  | 'HideAttribute'
  | 'HideAttributeValue'
  | 'HideProduct'
  | 'DisableProduct'
  | 'DisableAttributeValue'
  | 'Requires'
  | 'Excludes'
  | 'Validate';

export type QuantityScaleMethod = 'Proportional' | 'Constant';

export type RuleConditionDataType =
  | 'Text'
  | 'String'
  | 'Number'
  | 'Integer'
  | 'Percent'
  | 'Picklist'
  | 'Boolean'
  | 'MultiPicklist'
  | 'Date'
  | 'DateTime'
  | 'Currency'
  | 'Lookup';

export type UpdateCartAction = 'Validate' | 'Price';

export type ResourceValues = {
  values: Array<string | null>;
};

export type ConditionInformation = {
  type: string;
  name: string;
  values: ResourceValues;
};

export type Condition = {
  contextTagName?: string;
  dataType?: RuleConditionDataType;
  values: string[];
  attributeId?: string;
  attributeName?: string;
  conditionIndex?: number;
  operator: RuleConditionOperator;
  type: RuleConditionType;
};

export type RuleCriteria = {
  rootObjectId: string;
  sourceDataType?: string;
  sourceContextTagName?: string;
  sourceOperator?: RuleConditionOperator;
  sourceValues: string[];
  sourceInformation: ConditionInformation[];
  conditionExpression?: string;
  criteriaIndex?: number;
  conditions?: Condition[];
};

export type RuleAction = {
  name: string;
  message?: string;
  actionType: RuleActionType;
  behaviorTypeLock?: boolean;
  messageType?: string;
  sequence?: number;
  targetValues: string[];
  targetInformation: ConditionInformation[];
  targetContextTagName?: string;
  targetDataType?: RuleConditionDataType;
  targetOperator?: RuleConditionOperator;
  actionParameters?: Condition[];
  actionParametersExpression?: string;
};

export type ConfiguratorRuleInput = {
  name: string;
  apiName: string;
  description?: string;
  sequence?: number;
  usageSubType: string;
  criteriaExpressionType: string;
  startDate?: string;
  endDate?: string;
  scope: RuleScope;
  criteria: RuleCriteria[];
  actions: RuleAction[];
  productConfigurationRuleId?: string;
};
