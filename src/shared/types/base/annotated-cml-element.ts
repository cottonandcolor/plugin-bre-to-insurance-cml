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
export class AnnotatedCmlElement {
  #properties: Record<string, string | number | boolean> = {};

  public get properties(): Record<string, string | number | boolean> {
    return this.#properties;
  }

  public setProperties(properties: { [k: string]: string | number | boolean }): void {
    Object.assign(this.#properties, properties);
  }

  public hasProperties(): boolean {
    return Object.entries(this.properties).length > 0;
  }

  public generateAnnotation(): string {
    if (!this.hasProperties()) {
      return ''; // Return an empty string if no properties are set
    }

    const entries = Object.entries(this.properties);

    const formattedEntries = entries.map(([key, value]) => {
      const formattedValue = typeof value === 'string' ? `"${value}"` : value;
      return `${key} = ${formattedValue}`;
    });

    return `@(${formattedEntries.join(', ')})`;
  }
}
