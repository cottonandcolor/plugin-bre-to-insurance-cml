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
import { isEmpty, isSameIds } from '../utils/common.utils.js';
import { Association, CmlAttribute, CmlType } from './types.js';

export const BASE_LINE_ITEM_TYPE_NAME = 'LineItem';
export const VIRTUAL_QUOTE_TYPE_NAME = 'VirtualQuote';

export class CmlModel {
  #types: Map<string, CmlType> = new Map();
  #associations: Map<string, Association> = new Map();
  #externalAttributes: Map<string, CmlAttribute> = new Map();
  #globalProperties: Map<string, unknown> = new Map();
  #globalConstants: Map<string, { name: string; type: string; value: unknown }> = new Map();

  public get types(): CmlType[] {
    return Array.from(this.#types.values());
  }

  public get associations(): Association[] {
    return Array.from(this.#associations.values());
  }

  public get externalAttributes(): CmlAttribute[] {
    return Array.from(this.#externalAttributes.values());
  }

  public get globalProperties(): unknown[] {
    return Array.from(this.#globalProperties.values());
  }

  public get globalConstants(): unknown[] {
    return Array.from(this.#globalConstants.values());
  }

  public getType(name: string): CmlType | undefined {
    return this.#types.get(name);
  }

  public getTypeByProductId(productId: string): CmlType | undefined {
    return Array.from(this.#types.values()).find(
      (p) => isSameIds(p.productId, productId) || isSameIds(p.basedOnId, productId)
    );
  }

  public addType(type: CmlType): void {
    if (isEmpty(type.name)) {
      throw new Error('MissingTypeNameError');
    }
    this.#types.set(type.name, type);
  }

  public editType(type: CmlType): void {
    this.#types.set(type.name, type);
  }

  public deleteType(type: CmlType): void {
    if (!type.name) {
      throw new Error('MissingTypeNameError');
    }
    if (!this.#types.has(type.name)) {
      throw new Error('MissingTypeError'.replace('{0}', type.name));
    }
    this.#types.delete(type.name);
  }

  public clearAllTypes(): void {
    this.#types = new Map();
  }

  public addAssociation(association: Association): void {
    if (this.#associations.has(association.id)) {
      throw new Error('AssociationAlreadyExists'.replace('{0}', association.id));
    }
    this.#associations.set(association.id, association);
  }

  public editAssociation(association: Association): void {
    this.#associations.set(association.id, association);
  }

  public removeAssociation(associationId: string): void {
    this.#associations.delete(associationId);
  }

  public getAssociation(id: string): Association | undefined {
    return this.#associations.get(id);
  }

  public addExternalAttribute(attribute: CmlAttribute): void {
    if (!attribute.name) {
      throw new Error('MissingExternalVariableName');
    }
    if (this.#externalAttributes.has(attribute.name)) {
      throw new Error('ExternalVariableExists'.replace('{0}', attribute.name));
    }
    this.#externalAttributes.set(attribute.name, attribute);
  }

  public getExternalAttribute(name: string): CmlAttribute | undefined {
    return this.#externalAttributes.get(name);
  }

  public addGlobalProperty(property: { name: string; value: unknown }): void {
    if (!property.name) {
      throw new Error('MissingGlobalPropertyName');
    }
    if (this.#globalProperties.has(property.name)) {
      throw new Error('GlobalPropertyExists'.replace('{0}', property.name));
    }
    this.#globalProperties.set(property.name, property.value);
  }

  public getGlobalProperty(name: string): unknown {
    return this.#globalProperties.get(name);
  }

  public addGlobalConstant(constant: { name: string; type: string; value: unknown }): void {
    if (!constant.name) {
      throw new Error('MissingConstantName');
    }
    if (this.#globalConstants.has(constant.name)) {
      throw new Error('GlobalConstantExists'.replace('{0}', constant.name));
    }
    this.#globalConstants.set(constant.name, constant);
  }

  public getGlobalConstant(name: string): { name: string; type: string; value: unknown } | undefined {
    return this.#globalConstants.get(name);
  }

  public generateCml(): string {
    const output: string[] = [];
    for (const type of this.#types.values()) {
      output.push(type.generateCml());
    }
    return formatIndentation(output.join('\n'));
  }
}

function formatIndentation(code: string): string {
  const TAB = '    ';
  const lines = code.split('\n'); // Split the input string by new lines
  let indentationLevel = 0;
  let formattedCode = '';

  lines.forEach((line) => {
    // Check if the line is blank or only contains whitespace
    if (line.trim() === '') {
      // Preserve the blank line without any tabs or indentation
      formattedCode += '\n';
      return; // Continue to the next iteration
    }

    // Trim the line to ignore leading/trailing spaces
    const trimmedLine = line.trim();

    // Decrease indentation level for lines that start with a closing brace `}`
    if (trimmedLine.startsWith('}')) {
      indentationLevel = Math.max(0, indentationLevel - 1);
    }

    // Add the appropriate number of tabs based on the current indentation level
    formattedCode += TAB.repeat(indentationLevel) + trimmedLine + '\n';

    // Increase indentation level for lines that contain an opening brace `{`
    if (trimmedLine.endsWith('{')) {
      indentationLevel++;
    }
  });

  return formattedCode;
}
