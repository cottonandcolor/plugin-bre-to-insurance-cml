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
import { isEmpty } from '../utils/common.utils.js';
import { AnnotatedCmlElementWAttributes } from './base/types.js';

export type CmlRelationCardinality = {
  min?: number;
  max?: number;
};

export class CmlRelation extends AnnotatedCmlElementWAttributes {
  #name;
  #type;
  #cardinality: CmlRelationCardinality = {};
  #order: string[] = [];
  #prcIds: string[] = [];

  public constructor(name: string, type: string) {
    super();
    this.#name = name;
    this.#type = type;
  }

  public get name(): string {
    return this.#name;
  }

  public get type(): string {
    return this.#type;
  }

  public get cardinality(): CmlRelationCardinality {
    return this.#cardinality;
  }

  public get order(): string[] {
    return this.#order;
  }

  public get prcIds(): string[] {
    return this.#prcIds;
  }

  public set type(type: string) {
    this.#type = type;
  }

  public set name(name: string) {
    this.#name = name;
  }

  /**
   * Cardinality can be an integer or a string constant.
   */
  public setMinCardinality(minCardinality: number): void {
    this.#cardinality.min = minCardinality;
  }

  /**
   * Cardinality can be an integer or a string constant.
   */
  public setMaxCardinality(maxCardinality: number): void {
    if (isEmpty(this.#cardinality.min)) {
      this.#cardinality.min = 0;
    }
    this.#cardinality.max = maxCardinality;
  }

  public hasCardinality(): boolean {
    return !isEmpty(this.#cardinality.min) && !isEmpty(this.#cardinality.max);
  }

  public hasMinCardinality(): boolean {
    return !isEmpty(this.#cardinality.min);
  }

  public hasMaxCardinality(): boolean {
    return !isEmpty(this.#cardinality.max);
  }

  public setOrder(order: string[]): void {
    this.#order = order;
  }

  public setPrcIds(prcIds: string[]): void {
    this.#prcIds = prcIds;
  }

  public hasOrder(): boolean {
    return this.#order.length > 0;
  }

  public generateCml(): string {
    let output = '';

    if (this.hasProperties()) {
      output += this.generateAnnotation() + '\n';
    }

    output += `relation ${this.#name} : ${this.#type}`;

    // relations can have min/max cardinalities
    if (this.hasCardinality()) {
      if (this.cardinality.min === this.cardinality.max) {
        output += `[${this.cardinality.min ?? 0}]`;
      } else {
        output += `[${this.cardinality.min ?? 0}..${this.cardinality.max ?? 0}]`;
      }
    }

    // relations can have an order of child types
    if (this.hasOrder()) {
      output += ' order (';
      output += this.order.join(', ');
      output += ')';
    }

    // relation body can contain relation attributes and default components
    if (this.hasAttributes()) {
      output += ' {\n';

      this.attributes.forEach((a) => {
        output += a.generateCml() + ';\n';
      });

      output += '}';
    } else {
      output += ';';
    }

    return output;
  }
}
