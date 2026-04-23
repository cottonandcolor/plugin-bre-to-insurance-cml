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
import { getRandomValues } from 'node:crypto';
import { CML_DATA_TYPES, CML_NUMBER_DATA_TYPES } from '../constants/constants.js';
import { CmlModel, CmlRelation, CmlType } from '../types/types.js';

export type Logger = { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };

export function isSameIds(id1: string | null | undefined, id2: string | null | undefined): boolean {
  if (!id1 || !id2) {
    return false;
  }
  if (id1.length === id2.length) {
    return id1.localeCompare(id2) === 0;
  }
  if (id1.length > id2.length) {
    return id1.startsWith(id2);
  }
  return id2.startsWith(id1);
}

/**
 * Checks whether the passed parameter is specifically undefined or null and not an empty string.
 *
 * @param {String} value The string to check
 * @returns {Boolean} Whether value is undefined or null
 */
export function isUndefinedOrNull(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * Checks if the input value is undefined, null, empty array and object.
 *
 * @param {String} value input string to evaluate
 * @returns {boolean} return true for undefined, null or empty string otherwise false
 */
export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  } else if (Array.isArray(value)) {
    return value.length <= 0;
  } else if (isObject(value)) {
    return Object.keys(value).length === 0;
  } else if (value === '') {
    return true;
  }
  return false;
}

/**
 * Determines if item is an object
 *
 * @param {*} item The item in question of being an object
 * @returns {Boolean} Whether item is an object or not
 */
export function isObject(item: unknown): boolean {
  return typeof item === 'object' && !Array.isArray(item) && !isUndefinedOrNull(item);
}

/**
 * Capitalizes the first letter in a string.
 *
 * @param string - string to capitalize
 * @returns {string} - capitalized version of the string.
 */
export function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

/**
 * Generates a random uuid (Version 4 in rfc4122)
 * Copied the method from ui-industries-epc-components
 *
 * @returns {string} a UUID string
 */
export function uuid(): string {
  const hexDigits = '0123456789abcdef';
  const valueArray = new Uint32Array(32);
  getRandomValues(valueArray);

  let res = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      res += '_';
    }
    if (i === 12) {
      res += '4'; // UUID version
    } else if (i === 16) {
      res += hexDigits.charAt((valueArray[i] & 0x3) | 0x8); // Bits need to start with 10
    } else {
      res += hexDigits.charAt(valueArray[i] & 0xf);
    }
  }

  return res;
}

/**
 * Finds an entry in a Map based on a specified key-value pair.
 *
 * @param {Map} map - The map to search through, where values are objects.
 * @param {string} key - The key to match within each entry's object.
 * @param {*} value - The value to match for the specified key.
 * @returns {Object|undefined} - The first entry in the map where the specified key has the given value, or `undefined` if no match is found.
 */
export function findInMap<T>(map: Map<string, T>, key: string, value: unknown): T | undefined {
  return [...map.values()].find((entry) => (entry as Record<string, unknown>)[key] === value);
}

/**
 * Checks that name is valid - it should have only alphanumeric chars and underscores and should start with a letter
 *
 * @param name - string to validate
 * @returns {boolean} - whether name is valid or not
 */
export function isNameValid(name: string): boolean {
  const validChars = /^[a-zA-Z0-9_]+$/;
  const validFirstChar = /^[a-zA-Z]/;
  return validFirstChar.test(name.charAt(0)) && validChars.test(name);
}

/**
 * Checks if a given name is already used in the model.
 *
 * @param {Object} model - The model containing existing types.
 * @param {string} name - The name to check for uniqueness.
 * @param {Map} existingProductIdsToTypes - A map of existing type names to types that have been created but not yet saved to the model.
 * @returns {boolean} - Returns true if the name is not used, otherwise false.
 */
export function isTypeNameUnique(
  model: CmlModel,
  name: string,
  existingProductIdsToTypes: Map<string, CmlType>
): boolean {
  return !model.getType(name) && (!existingProductIdsToTypes || !findInMap(existingProductIdsToTypes, 'name', name));
}

/**
 * Checks if a given relation name is unique within a specific type.
 *
 * @param {Object} type - The type object containing existing relations.
 * @param {string} name - The name of the relation to check.
 * @param {Map} existingPrcIdsToRelations - A map of existing relation names to relations that have been created but not yet saved to the model.
 * @returns {boolean} - Returns true if the relation name is unique (not already used), otherwise false.
 */
export function isRelationNameUnique(
  type: CmlType,
  name: string,
  existingPrcIdsToRelations: Map<string, CmlRelation>
): boolean {
  return !type.getRelation(name) && (!existingPrcIdsToRelations || !findInMap(existingPrcIdsToRelations, 'name', name));
}

/**
 * Checks that name length is 80 or fewer chars
 *
 * @param name - string to validate
 * @returns {boolean} - whether name is valid or not
 */
export function isNameLengthValid(name: string): boolean {
  return name.length <= 80;
}

/**
 * Checks if value is an integer
 *
 * @param value - string to validate
 * @returns {boolean} - whether value is an integer or not
 */
export function isInteger(value: string): boolean {
  const num = Number(value);
  return !isNaN(num) ? !value.toString().includes('.') : false;
}

/**
 * Checks if value is a double
 *
 * @param value - string to validate
 * @returns {boolean} - whether value is a double or not
 */
export function isDouble(value: string): boolean {
  const num = Number(value);
  return !isNaN(num) ? value.toString().includes('.') : false;
}

/**
 * Checks if value is a boolean
 *
 * @param value - string to validate
 * @returns {boolean} - whether value is a boolean or not
 */
export function isBoolean(value: string): boolean {
  return value.toString().toLowerCase() === 'true' || value.toString().toLowerCase() === 'false';
}

/**
 * Checks if value is a date
 *
 * @param value - string to validate
 * @returns {boolean} - whether value is a date or not
 */
export function isDate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Checks if value is a string
 *
 * @param value - string to validate
 * @returns {boolean} - whether value is a string or not
 */
export function isString(value: string): boolean {
  return typeof value === 'string';
}

/**
 * Checks if the given value is a Date object.
 *
 * @param {*} d - The value to check.
 * @returns {boolean} True if the value is an instance of Date, otherwise false.
 */
export function isDateType(d: unknown): boolean {
  return d instanceof Date;
}

/**
 * Determines whether a given CML data type requires scale precision.
 *
 * @param {string} type - The CML data type to check (e.g., "double", "decimal").
 * @returns {boolean} - Returns `true` if the type requires scale precision, otherwise `false`.
 */
export function isScaledType(type: string): boolean {
  return type === CML_DATA_TYPES.DOUBLE || type === CML_DATA_TYPES.DECIMAL;
}

/**
 * Parses a string by removing surrounding quotes (single or double).
 *
 * @param {string} value - The string to be parsed.
 * @returns {string} - The parsed string with quotes removed, or the original string if no quotes are found.
 */
export function parseString(value: string): string {
  if (
    typeof value === 'string' &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value; // Return the original string if no surrounding quotes
}

/**
 * Parses a date string into a Date object or returns the original string if invalid
 *
 * We return the original string because it may be a CML constant variable reference
 *
 * @param {string} stringValue - A date string in the format "YYYY-MM-DD"
 * @returns {Date|string} A valid Date object if parsing succeeds, or the original string if invalid
 */
export function parseDate(stringValue: string): Date | string {
  const parts = stringValue.split('-');

  // Ensure the format has exactly 3 parts (year, month, day)
  if (parts.length !== 3) {
    return stringValue;
  }

  // Convert parts to numbers
  const [year, month, day] = parts.map(Number);

  // Validate year, month, and day
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return stringValue;
  }

  // Create and validate the Date object
  const date = new Date(year, month - 1, day);
  // Ensure the Date object matches the input values
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    return stringValue;
  }

  return date;
}

/**
 * Parses a numeric string into a number (either integer or float).
 *
 * @param {string} value - The string representation of the number.
 * @returns {number} - The parsed number.
 * @throws {Error} - Throws an error if the value cannot be parsed as a number.
 */
export function parseNumber(value: string): number {
  const parsedValue = parseFloat(value);
  if (isNaN(parsedValue)) {
    throw new Error(`Invalid number format: ${value}`);
  }
  return Number.isInteger(parsedValue) ? parseInt(value, 10) : parsedValue;
}

/**
 * Determines whether a given type is a number type.
 *
 * @param {string} type - The attribute type (e.g., "int", "double", "decimal").
 * @returns {boolean} - True if the type is a number type, false otherwise.
 */
export function isNumberType(type: string): boolean {
  return Object.values(CML_NUMBER_DATA_TYPES).includes(type);
}

/**
 * Determines whether a given type is a date type.
 *
 * @param {string} type - The attribute type (e.g., "date", "int").
 * @returns {boolean} - True if the type is "date", false otherwise.
 */
export function isDateDataType(type: string): boolean {
  return type === CML_DATA_TYPES.DATE;
}

/**
 * Formats a Date object to a CML-compatible date string in the format "YYYY-MM-DD".
 *
 * @param {Date} date - The Date object to format.
 * @returns {string} The formatted date string in "YYYY-MM-DD" format, enclosed in double quotes.
 */
export function formatToCmlDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `"${year}-${month}-${day}"`;
}

/**
 * Formats a Date object to a user-friendly display string in the format "Month Day, Year".
 *
 * @param {Date} date - The Date object to format.
 * @returns {string} The formatted date string in "Month Day, Year" format (e.g., "March 27, 1994").
 */
export function formatToDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Converts the HTML entities &amp;, &lt;, &gt;, &quot;, and &#39; in string to their corresponding characters.
 *
 * @param {string} source - The source string
 * @returns {string} The string with unescaped HTML characters.
 */
export function unescapeHtml(source: string | undefined): string {
  if (typeof source !== 'string') return '';
  return source
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
