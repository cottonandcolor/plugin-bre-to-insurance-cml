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
import { CmlAttribute, CmlConstraint, CmlModel, CmlType } from './types/types.js';
import { CML_DATA_TYPES, CONSTRAINT_TYPES } from './constants/constants.js';

/**
 * Parse a .cml file into a CmlModel. Handles the subset of CML syntax
 * used by insurance rule conversion: types with attributes and constraints.
 */
export function parseCmlFile(cmlContent: string): CmlModel {
  const model = new CmlModel();
  const lines = cmlContent.split('\n');
  let currentType: CmlType | null = null;
  let braceDepth = 0;
  let constraintBuffer = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('//')) continue;

    if (constraintBuffer) {
      constraintBuffer += ' ' + line;
      if (constraintBuffer.includes(');')) {
        parseConstraintLine(constraintBuffer, currentType!);
        constraintBuffer = '';
      }
      continue;
    }

    if (line.startsWith('type ') && line.includes('{')) {
      const typeName = line.replace('type ', '').replace('{', '').trim().split(/\s+/)[0];
      currentType = new CmlType(typeName, undefined, undefined);
      braceDepth = 1;
      continue;
    }

    if (line === '}') {
      braceDepth--;
      if (braceDepth === 0 && currentType) {
        model.addType(currentType);
        currentType = null;
      }
      continue;
    }

    if (!currentType) continue;

    if (line.startsWith('constraint ') || line.startsWith('preference ')) {
      if (line.includes(');')) {
        parseConstraintLine(line, currentType);
      } else {
        constraintBuffer = line;
      }
      continue;
    }

    if (line.endsWith(';') && !line.startsWith('constraint') && !line.startsWith('preference')) {
      const attrLine = line.slice(0, -1).trim();
      const parts = attrLine.split(/\s+/);
      if (parts.length >= 2) {
        const dataType = parts[0];
        const attrName = parts[1];
        if (Object.values(CML_DATA_TYPES).includes(dataType)) {
          currentType.addAttribute(new CmlAttribute(null, attrName, dataType));
        }
      }
    }
  }

  return model;
}

function parseConstraintLine(line: string, type: CmlType): void {
  const isPreference = line.startsWith('preference ');
  const constraintType = isPreference ? CONSTRAINT_TYPES.PREFERENCE : CONSTRAINT_TYPES.CONSTRAINT;

  const nameMatch = line.match(/(?:constraint|preference)\s+(\w+)\s*=\s*\(/);
  if (!nameMatch) return;

  const name = nameMatch[1];
  const afterParen = line.slice(line.indexOf('(', nameMatch.index ?? 0) + 1);
  const beforeClosing = afterParen.slice(0, afterParen.lastIndexOf(');'));

  let declaration: string;
  let explanation: string | undefined;

  const lastCommaQuote = beforeClosing.lastIndexOf(', "');
  if (lastCommaQuote !== -1) {
    const candidate = beforeClosing.slice(lastCommaQuote + 2).trim();
    if (candidate.startsWith('"') && candidate.endsWith('"')) {
      declaration = beforeClosing.slice(0, lastCommaQuote).trim();
      explanation = candidate;
    } else {
      declaration = beforeClosing.trim();
    }
  } else {
    declaration = beforeClosing.trim();
  }

  const constraint = new CmlConstraint(constraintType, declaration, explanation);
  constraint.name = name;
  type.addConstraint(constraint);
}

/**
 * Merge new attributes and constraints from source into target CmlModel.
 * If the target already has a type with the same name, new attributes and
 * constraints are appended (duplicates are skipped via addConstraint's
 * equalsTo check and attribute name matching).
 */
export function mergeCmlModels(target: CmlModel, source: CmlModel): CmlModel {
  for (const sourceType of source.types) {
    const existingType = target.getType(sourceType.name);
    if (existingType) {
      const existingAttrNames = new Set(existingType.attributes.map((a) => a.name));
      for (const attr of sourceType.attributes) {
        if (!existingAttrNames.has(attr.name)) {
          existingType.addAttribute(new CmlAttribute(attr.attributeId, attr.name, attr.type));
        }
      }
      for (const constraint of sourceType.constraints) {
        existingType.addConstraint(constraint);
      }
    } else {
      target.addType(sourceType);
    }
  }

  for (const assoc of source.associations) {
    try {
      target.addAssociation(assoc);
    } catch {
      // association already exists — skip
    }
  }

  return target;
}
