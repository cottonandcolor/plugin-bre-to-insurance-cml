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
import { formatToCmlDate, formatToDisplayDate, isDateType } from '../utils/common.utils.js';

export type CmlNumInterval = { min: number; max: number };
export type CmlDateInterval = { min: Date; max: Date };
export type CmlDomainValueType = string | number | boolean | Date | CmlNumInterval | CmlDateInterval;
export class CmlDomain {
  #domainName?: string;
  #domainValues: CmlDomainValueType[] = [];
  #expression?: string;

  public get domainName(): string | undefined {
    return this.#domainName;
  }

  public get domainValues(): CmlDomainValueType[] {
    return this.#domainValues;
  }

  public get expression(): string | undefined {
    return this.#expression;
  }

  public get isNamedDomain(): boolean {
    // Example: string colors = COLOR_DOMAIN;
    return !!this.#domainName;
  }

  public get isDomainOfIntervals(): boolean {
    // Example: date goodDate = ['2024-03-21'...'2025-04-01', '2025-06-01'];
    return (
      Array.isArray(this.#domainValues) &&
      this.#domainValues.every((v) => typeof v === 'object' && v !== null && 'min' in v && 'max' in v)
    );
  }

  public get isDomainOfStringValues(): boolean {
    // Example: string colors = ["Red", "Green", "Blue"];
    return Array.isArray(this.#domainValues) && this.#domainValues.every((v) => typeof v === 'string');
  }

  public get isDomainOfDateValues(): boolean {
    // Example: date validDates = ['2024-03-30', '2025-05-02'];
    return Array.isArray(this.#domainValues) && this.#domainValues.every(isDateType);
  }

  public get isDomainOfNumbers(): boolean {
    // Example: int validNumbers = [1, 5, 6, 9];
    return Array.isArray(this.#domainValues) && this.#domainValues.every((v) => typeof v === 'number');
  }

  public get domainType(): string {
    if (
      this.isDomainOfStringValues ||
      this.isDomainOfIntervals ||
      this.isDomainOfDateValues ||
      this.isDomainOfNumbers
    ) {
      return 'Value';
    } else if (this.isNamedDomain) {
      return 'Named Domain';
    }
    return '';
  }

  public get editDisplayValue(): string | undefined {
    if (this.isNamedDomain) {
      return this.#domainName;
    } else if (this.isDomainOfDateValues) {
      return this.#domainValues.map((d) => formatToCmlDate(d as Date)).join(', ');
    } else if (this.isDomainOfStringValues || this.isDomainOfNumbers) {
      return this.#domainValues.join(', ');
    } else if (this.isDomainOfIntervals) {
      return this.#domainValues
        .map((v) => {
          const vi = v as CmlNumInterval | CmlDateInterval;
          const min = isDateType(vi.min) ? formatToCmlDate(vi.min as Date) : (vi.min as number | string);
          const max = isDateType(vi.max) ? formatToCmlDate(vi.max as Date) : (vi.max as number | string);
          return min !== max ? `${min}..${max}` : `${max}`;
        })
        .join(', ');
    }
    return '';
  }

  public get displayValue(): string | undefined {
    if (this.isDomainOfDateValues) {
      return this.#domainValues.map((d) => formatToDisplayDate(d as Date)).join(', ');
    } else if (this.isDomainOfStringValues || this.isDomainOfNumbers) {
      return this.#domainValues.join(', ');
    } else if (this.isDomainOfIntervals) {
      return this.#domainValues
        .map((v) => {
          const vi = v as CmlNumInterval | CmlDateInterval;
          const min = isDateType(vi.min) ? formatToDisplayDate(vi.min as Date) : (vi.min as number | string);
          const max = isDateType(vi.max) ? formatToDisplayDate(vi.max as Date) : (vi.max as number | string);
          return min !== max ? `${min} - ${max}` : `${max}`;
        })
        .join(', ');
    }
    return this.#domainName;
  }

  public setDomainName(domainName: string): void {
    this.#domainName = domainName;
  }

  public setDomainValues(v: CmlDomainValueType[]): void {
    this.#domainValues = v;
  }

  public setExpression(expression: string): void {
    this.#expression = expression;
  }

  public generateCml(): string {
    if (this.isNamedDomain) {
      return this.#domainName!;
    } else if (this.#expression) {
      return this.#expression;
    } else if (this.isDomainOfDateValues) {
      return `[${this.#domainValues.map((v) => formatToCmlDate(v as Date)).join(', ')}]`;
    } else if (this.isDomainOfStringValues) {
      return `[${this.#domainValues.map((v) => `"${v as string}"`).join(', ')}]`;
    } else if (this.isDomainOfNumbers) {
      return `[${this.#domainValues.map((v) => `${v as string}`).join(', ')}]`;
    } else if (this.isDomainOfIntervals) {
      return `[${this.#domainValues
        .map((v) => {
          const vi = v as CmlNumInterval | CmlDateInterval;
          const min = isDateType(vi.min) ? formatToCmlDate(vi.min as Date) : (vi.min as number | string);
          const max = isDateType(vi.max) ? formatToCmlDate(vi.max as Date) : (vi.max as number | string);
          return min !== max ? `${min}..${max}` : `${max}`;
        })
        .join(', ')}]`;
    }
    return '';
  }
}
