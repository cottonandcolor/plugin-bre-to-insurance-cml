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
export const CML_METHODS = {
  GET_PROPERTY: 'getProperty',
  GET_ID: 'getId',
  GET_TYPE_NAME: 'getTypeName',
};

/**
 * CML has a set of predefined functions that can be invoked.
 */
export const CML_RELATION_ATTRIBUTE_FUNCTIONS = {
  SUM: 'sum',
  TOTAL: 'total',
  MAX: 'max',
  MIN: 'min',
  COUNT: 'count',
  JOIN: 'join',
};

/**
 * CML has a set of proxy variables.
 */
export const CML_PROXY_VARIABLES = {
  PARENT: 'parent',
  ROOT: 'root',
  SIBLING: 'sibling',
  CARDINALITY: 'cardinality',
  THIS_QUANTITY: 'this.quantity',
};

/**
 * CML variable value types.
 */
export const CML_VARIABLE_VALUE_TYPES = {
  DOMAIN: 'Domain',
  FUNCTION: 'Function',
  EXPRESSION: 'Expression',
  PROXY_VARIABLE: 'Proxy Variable',
};

/**
 * All primitive data types for CML.
 */
export const CML_DATA_TYPES = {
  BOOLEAN: 'boolean',
  DATE: 'date',
  DECIMAL: 'decimal',
  DOUBLE: 'double',
  INTEGER: 'int',
  STRING: 'string',
  STRING_ARRAY: 'string[]',
};

/**
 * Display names of primitive data types for CML.
 */
export const CML_DATA_TYPE_DISPLAY_NAMES = {
  int: 'Integer',
  boolean: 'Boolean',
  date: 'Date',
  decimal: 'Decimal',
  double: 'Double',
  string: 'String',
  'string[]': 'String Array',
};

/**
 * Subset of data types that are numbers.
 */
export const CML_NUMBER_DATA_TYPES = {
  DECIMAL: 'decimal',
  DOUBLE: 'double',
  INTEGER: 'int',
};

/**
 * All the constraint types.
 *
 * @type {Set<string>}
 */
export const CONSTRAINT_TYPES = {
  BELONG: 'belong',
  CONSTRAINT: 'constraint',
  DISTINCT: 'distinct',
  EQUAL: 'equal',
  EXCLUDE: 'exclude',
  INCLUDE: 'include',
  MESSAGE: 'message',
  PREFERENCE: 'preference',
  REQUIRE: 'require',
  RULE: 'rule',
  SEQUENTIAL: 'sequential',
  ACTION: 'action',
  SET: 'set',
  CONSTRUCTOR: 'constructor',
  UNKNOWN: 'unknown',
};

/**
 * All the CML association types.
 */
export type AssociationType = 'Type' | 'Port';
export const ASSOCIATION_TYPES: Record<'TYPE' | 'RELATION', AssociationType> = {
  TYPE: 'Type',
  RELATION: 'Port',
};
