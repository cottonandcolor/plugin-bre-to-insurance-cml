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
import { AnnotatedCmlElement } from './base/types.js';
import { CmlDomain } from './types.js';

export class CmlAttribute extends AnnotatedCmlElement {
  readonly #attributeId: string | null;
  #name: string;
  #type: string;
  #typeScale?: number; // decimal and double attribute types have scale values
  #valueType?: string;
  #value?: CmlDomain;

  public constructor(attributeId: string | null, name: string, type: string) {
    super();
    this.#attributeId = attributeId;
    this.#name = name;
    this.#type = type;
  }

  public get attributeId(): string | null {
    return this.#attributeId;
  }

  public get name(): string {
    return this.#name;
  }

  public get type(): string {
    return this.#type;
  }

  public get typeScale(): number | undefined {
    return this.#typeScale;
  }

  public get valueType(): string | undefined {
    return this.#valueType;
  }

  public get value(): CmlDomain | undefined {
    return this.#value;
  }

  public set name(name: string) {
    this.#name = name;
  }

  public set type(type: string) {
    this.#type = type;
  }

  public setTypeScale(scale: number | undefined): void {
    this.#typeScale = scale;
  }

  public setValue(valueType: string, value: CmlDomain): void {
    this.#valueType = valueType;
    this.#value = value;
  }

  public generateCml(): string {
    let output = '';

    if (this.hasProperties()) {
      output += this.generateAnnotation() + '\n';
    }

    if (this.#type) {
      if (this.#typeScale !== undefined && this.#typeScale !== null) {
        output += `${this.#type}(${this.#typeScale}) ${this.#name}`;
      } else {
        output += `${this.#type} ${this.#name}`;
      }
    } else {
      // relation and component attributes do not have a defined data type
      output += `${this.#name}`;
    }

    if (this.value) {
      output += ` = ${this.value.generateCml()}`;
    }

    return output;
  }
}
