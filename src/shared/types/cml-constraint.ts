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
import { CONSTRAINT_TYPES } from '../constants/constants.js';
import { isEmpty } from '../utils/common.utils.js';
import { AnnotatedCmlElement } from './base/types.js';

export type CmlConstraintAttribute = { attributeName: string; attributeValue: string };

export class CmlConstraint extends AnnotatedCmlElement {
  #type: string;
  #name: string = '';
  #declaration: string;
  #explanation?: string;
  #explanationType?: string;

  #additiveExpressions?: string[];
  #targetRelation?: string;
  #targetType?: string;
  #targetAttributes: CmlConstraintAttribute[] = [];
  #targetQuantity?: number;

  #action?: string;
  #actionScope?: string;
  #actionTarget?: string;
  #actionClassification?: string;
  #actionTargetValues: string[] = [];

  #sequence: number = 0;

  public constructor(type: string, declaration: string, explanation?: string, explanationType?: string) {
    super();
    this.#type = type;
    this.#declaration = declaration;
    this.#explanation = explanation;
    this.#explanationType = explanationType;
  }

  public get type(): string {
    return this.#type;
  }

  public get name(): string {
    return this.#name;
  }

  public get explanation(): string | undefined {
    return this.#explanation;
  }

  public get explanationType(): string | undefined {
    return this.#explanationType;
  }

  public get declaration(): string {
    return this.#declaration;
  }

  public get targetType(): string | undefined {
    return this.#targetType;
  }

  public get targetRelation(): string | undefined {
    return this.#targetRelation;
  }

  public get targetAttributes(): CmlConstraintAttribute[] {
    return (this.#targetAttributes ?? []).map((attr) => ({ ...attr }));
  }

  public get targetQuantity(): number | undefined {
    return this.#targetQuantity;
  }

  public get action(): string | undefined {
    return this.#action;
  }

  public get actionScope(): string | undefined {
    return this.#actionScope;
  }

  public get actionTarget(): string | undefined {
    return this.#actionTarget;
  }

  public get actionClassification(): string | undefined {
    return this.#actionClassification;
  }

  public get actionTargetValues(): string[] {
    return this.#actionTargetValues;
  }

  public get additiveExpressions(): string[] | undefined {
    return this.#additiveExpressions;
  }

  public get sequence(): number {
    return this.#sequence;
  }

  public set name(name: string) {
    this.#name = name;
  }

  public static createRequireConstraint(
    type: string, // 'exclude' | 'require'
    declaration: string,
    targetRelation: string,
    targetType: string,
    explanation?: string,
    targetAttributes: CmlConstraintAttribute[] = [],
    targetQuantity = 1
  ): CmlConstraint {
    const requireConstraint = new CmlConstraint(type, declaration, explanation);
    requireConstraint.setTargetRelation(targetRelation);
    requireConstraint.setTargetType(targetType);
    requireConstraint.setTargetAttributes(targetAttributes);
    requireConstraint.setTargetQuantity(targetQuantity);
    return requireConstraint;
  }

  public static createRuleConstraint(
    declaration: string,
    action: string,
    actionScope: string,
    actionTarget: string,
    actionClassification?: string,
    actionTargetValues: string[] = []
  ): CmlConstraint {
    const ruleConstraint = new CmlConstraint(CONSTRAINT_TYPES.RULE, declaration);
    ruleConstraint.setAction(action);
    ruleConstraint.setActionScope(actionScope);
    ruleConstraint.setActionClassification(actionClassification);
    ruleConstraint.setActionTarget(actionTarget);
    ruleConstraint.setActionTargetValues(actionTargetValues);
    return ruleConstraint;
  }

  public static createMessageConstraint(
    declaration: string,
    explanation?: string,
    explanationType?: string,
    additiveExpressions?: string[]
  ): CmlConstraint {
    const messageConstraint = new CmlConstraint(CONSTRAINT_TYPES.MESSAGE, declaration, explanation, explanationType);
    messageConstraint.#additiveExpressions = additiveExpressions;
    return messageConstraint;
  }

  public equalsTo(other: CmlConstraint): boolean {
    return this.generateCml().trim() === other.generateCml().trim();
  }

  public setType(type: string): void {
    if (!Object.values(CONSTRAINT_TYPES).includes(type)) {
      throw new Error('InvalidConstraintType'.replace('{0}', type));
    }
    this.#type = type;
  }

  public setExplanation(explanation: string): void {
    this.#explanation = explanation;
  }

  public setExplanationType(explanationType: string): void {
    this.#explanationType = explanationType;
  }

  public setSequence(value: number): void {
    this.#sequence = value;
  }

  public setTargetType(value: string): void {
    this.#targetType = value;
  }

  public setDeclaration(declaration: string): void {
    this.#declaration = declaration;
  }

  public setTargetRelation(value: string): void {
    this.#targetRelation = value;
  }

  public setTargetAttributes(attributesArray: CmlConstraintAttribute[]): void {
    this.#targetAttributes = attributesArray.map((attr) => ({ ...attr }));
  }

  public setTargetQuantity(value: number): void {
    this.#targetQuantity = value;
  }

  public setAction(action: string): void {
    this.#action = action;
  }

  public setActionScope(actionScope: string): void {
    this.#actionScope = actionScope;
  }

  public setActionTarget(actionTarget: string): void {
    this.#actionTarget = actionTarget;
  }

  public setActionClassification(actionClassification?: string): void {
    this.#actionClassification = actionClassification;
  }

  public setActionTargetValues(actionTargetValues: string[]): void {
    if (actionTargetValues) {
      this.#actionTargetValues = actionTargetValues.map((value) => value);
    }
  }

  public addTargetAttribute(attribute: string, value: string): void {
    this.#targetAttributes.push({ attributeName: attribute, attributeValue: value });
  }

  public removeTargetAttribute(attribute: string): void {
    this.#targetAttributes = this.#targetAttributes.filter((attr) => attr.attributeName !== attribute);
  }

  public updateTargetAttribute(index: number, attribute: string, value: string): void {
    this.#targetAttributes[index].attributeName = attribute;
    this.#targetAttributes[index].attributeValue = value;
  }

  public generateCml(): string {
    switch (this.#type) {
      case CONSTRAINT_TYPES.CONSTRAINT:
      case CONSTRAINT_TYPES.PREFERENCE: {
        let output = '';

        if (this.hasProperties()) {
          output += this.generateAnnotation() + '\n';
        }

        if (isEmpty(this.#name)) {
          output += `${this.#type}(`;
        } else {
          output += `${this.#type} ${this.#name} = (`;
        }
        output += this.#declaration;
        if (this.#explanation) {
          output += `, ${this.#explanation}`;
        }
        output += ');';
        return output;
      }
      case CONSTRAINT_TYPES.MESSAGE: {
        let output = '';

        if (this.hasProperties()) {
          output += this.generateAnnotation() + '\n';
        }

        output += 'message(';
        output += this.#declaration;
        if (this.#explanation) {
          output += `, ${this.#explanation}`;
        }
        if (this.#additiveExpressions) {
          output += `, ${this.#additiveExpressions.join(', ')}`;
        }
        if (this.#explanationType) {
          output += `, ${this.#explanationType}`;
        }
        output += ');';
        return output;
      }
      case CONSTRAINT_TYPES.EXCLUDE:
      case CONSTRAINT_TYPES.REQUIRE:
        return this.generateRequireCml();
      case CONSTRAINT_TYPES.RULE:
        return this.generateRuleCml();
      default:
        return this.#declaration;
    }
  }

  private generateRequireCml(): string {
    let output = '';

    if (this.hasProperties()) {
      output += this.generateAnnotation() + '\n';
    }

    output += `${this.#type}(`;
    output += this.#declaration;
    output += ', ';

    output += `${this.targetRelation ?? ''}[`;
    output += `${this.targetType ?? ''}]`;

    if (this.targetAttributes && this.targetAttributes.length > 0) {
      output += ' { ';
      this.targetAttributes.forEach((attr) => {
        output += `${attr.attributeName} = `;
        output += `${attr.attributeValue}, `;
      });
      output = output.slice(0, -2);
      output += ' }';
    }

    if (this.targetQuantity !== 1) {
      output += ` == ${this.#targetQuantity ?? 0}`;
    }
    if (this.#explanation) {
      output += `, ${this.#explanation}`;
    }
    output += ');';
    return output;
  }

  private generateRuleCml(): string {
    let output = '';

    if (this.hasProperties()) {
      output += this.generateAnnotation() + '\n';
    }

    output += 'rule(';
    output += this.declaration;
    output += ', ';

    output += `"${this.action ?? ''}"`;
    output += ', ';
    output += `"${this.actionScope ?? ''}"`;
    output += ', ';
    output += `"${this.actionTarget ?? ''}"`;
    if (this.actionClassification) {
      output += `, "${this.actionClassification}"`;
    }

    if (this.actionTargetValues && this.actionTargetValues.length > 0) {
      const value =
        this.actionTargetValues.length > 1
          ? `[${this.actionTargetValues.map((v) => `"${v}"`).join(', ')}]`
          : `"${this.actionTargetValues[0] ?? ''}"`;
      output += `, ${value}`;
    }

    output += ');';
    return output;
  }
}
