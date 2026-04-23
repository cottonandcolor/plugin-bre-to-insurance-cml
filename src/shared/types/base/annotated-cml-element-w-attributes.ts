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
import { findInMap, isSameIds } from '../../utils/common.utils.js';
import { CmlAttribute } from '../cml-attribute.js';
import { AnnotatedCmlElement } from './types.js';

export class AnnotatedCmlElementWAttributes extends AnnotatedCmlElement {
  #attributes: Map<string, CmlAttribute> = new Map();

  public get attributes(): CmlAttribute[] {
    return Array.from(this.#attributes.values());
  }

  public getAttribute(name: string): CmlAttribute | undefined {
    return findInMap(this.#attributes, 'name', name);
  }

  public findAttributeById(attributeId: string): CmlAttribute | null {
    return Array.from(this.#attributes.values()).find((a) => isSameIds(a.attributeId, attributeId)) ?? null;
  }

  public addAttribute(a: CmlAttribute): void {
    this.#attributes.set(a.name, a);
  }

  public hasAttributes(): boolean {
    return this.attributes.length > 0;
  }
}
