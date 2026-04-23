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
import { AnnotatedCmlElementWAttributes } from './base/types.js';
import { CmlConstraint } from './cml-constraint.js';
import { CmlRelation } from './cml-relation.js';

export class CmlType extends AnnotatedCmlElementWAttributes {
  readonly #name: string;
  readonly #productId: string | undefined;
  readonly #basedOnId: string | undefined;
  #parentType?: CmlType;
  #relations: Map<string, CmlRelation> = new Map();
  #constraints: CmlConstraint[] = [];

  public constructor(name: string, productId: string | undefined, basedOnId?: string) {
    super();
    this.#name = name;
    this.#productId = productId;
    this.#basedOnId = basedOnId;
  }

  public get name(): string {
    return this.#name;
  }

  public get productId(): string | undefined {
    return this.#productId;
  }

  public get basedOnId(): string | undefined {
    return this.#basedOnId;
  }

  public get parentType(): CmlType | undefined {
    return this.#parentType;
  }

  public get relations(): CmlRelation[] {
    return Array.from(this.#relations.values());
  }

  public get constraints(): CmlConstraint[] {
    return Array.from(this.#constraints);
  }

  public get isVirtualContainer(): boolean {
    return this.properties?.virtual === true;
  }

  public hasParentType(): boolean {
    return !!this.#parentType;
  }

  public setParentType(parentType: CmlType): void {
    this.#parentType = parentType;
  }

  public isEmptyType(): boolean {
    return this.attributes.length === 0 && this.relations.length === 0 && this.constraints.length === 0;
  }

  public addRelation(r: CmlRelation): void {
    if (!r.name) {
      throw new Error('MissingRelationName');
    }
    const existingRelation = this.#relations.get(r.name);
    if (existingRelation) {
      throw new Error('RelationExists'.replace('{0}', r.name));
    }
    this.#relations.set(r.name, r);
  }

  public getRelation(name: string): CmlRelation | undefined {
    return this.#relations.get(name);
  }

  public editRelation(r: CmlRelation): void {
    if (!r.name) {
      throw new Error('MissingRelationName');
    }
    if (!this.#relations.has(r.name)) {
      throw new Error('RelationDoesNotExist'.replace('{0}', r.name));
    }
    this.#relations.set(r.name, r);
  }

  public addConstraint(c: CmlConstraint): void {
    if (!this.#constraints.some((c1) => c1.equalsTo(c))) {
      c.setSequence(this.#constraints.length);
      this.#constraints.push(c);
    }
  }

  public containsConstraints(cc: CmlConstraint[]): boolean {
    return cc.every((c) => this.#constraints.some(({ name }) => c.name === name));
  }

  public generateCml(): string {
    let output = '';

    if (this.hasProperties()) {
      output += this.generateAnnotation() + '\n';
    }

    output += `type ${this.#name}`;

    if (this.#parentType) {
      output += ` : ${this.#parentType.name}`;
    }

    if (this.isEmptyType()) {
      return `${output};\n`;
    }

    const sections = [
      this.attributes.map((a) => a.generateCml() + ';\n'),
      this.relations.map((r) => r.generateCml() + '\n'),
      this.constraints.sort((l, r) => l.sequence - r.sequence).map((c) => c.generateCml() + '\n'),
    ]
      .filter((section) => section.length > 0)
      .flat();

    output += ` {\n${sections.join('\n')}\n}\n`;
    return output;
  }
}
