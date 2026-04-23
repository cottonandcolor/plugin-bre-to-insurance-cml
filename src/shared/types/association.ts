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
import { ASSOCIATION_TYPES, AssociationType } from '../constants/constants.js';
import { uuid } from '../utils/common.utils.js';

export type ReferenceObjectType = 'Product2' | 'ProductClassification' | 'ProductRelatedComponent';

export class Association {
  readonly #id: string;
  #tag: string; // ConstraintModelTag
  #type: AssociationType; // ConstraintModelTagType
  #referenceObjectId: string; // ReferenceObjectId

  readonly #referenceObjectType: ReferenceObjectType;
  readonly #referenceObjectReferenceValue: string;

  public constructor(
    id: string | null,
    tag: string,
    type: AssociationType,
    referenceObjectId: string,
    referenceObjectType: ReferenceObjectType,
    referenceObjectReferenceValue: string
  ) {
    this.#id = id ?? uuid();
    this.#tag = tag;
    this.#referenceObjectId = referenceObjectId;
    this.#type = type;
    this.#referenceObjectType = referenceObjectType;
    this.#referenceObjectReferenceValue = referenceObjectReferenceValue;
  }

  public get id(): string {
    return this.#id;
  }

  public get tag(): string {
    return this.#tag;
  }

  public get type(): AssociationType {
    return this.#type;
  }

  public get referenceObjectId(): string {
    return this.#referenceObjectId;
  }

  public get referenceObjectType(): ReferenceObjectType {
    return this.#referenceObjectType;
  }

  public get referenceObjectReferenceValue(): string {
    return this.#referenceObjectReferenceValue;
  }

  public setReferenceObjectId(referenceObjectId: string): void {
    this.#referenceObjectId = referenceObjectId;
  }

  public setType(type: AssociationType): void {
    if (!Object.values(ASSOCIATION_TYPES).includes(type)) {
      throw new Error('InvalidAssociationType'.replace('{0}', type));
    }
    this.#type = type;
  }

  public setTag(tag: string): void {
    this.#tag = tag;
  }
}
