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
import { ASSOCIATION_TYPES } from '../constants/constants.js';
import { Association, CmlRelation, CmlType } from '../types/types.js';

/**
 * Filters associations to return only those that match the specified type
 * and are not marked for deletion.
 *
 * @param {Array} associations - Array of association objects to filter.
 * @param {Object} typeName - The type name to filter associations by.
 * @returns {Array} Filtered array of associations for the specified type and not marked for deletion.
 */
export function getTypeAssociationsForType(associations: Association[], typeName: string): Association[] {
  const isTypeAssociation = (a: Association): boolean => a.type === ASSOCIATION_TYPES.TYPE;
  const isForTypeName = (a: Association): boolean => a.tag === typeName;

  return associations.filter(isTypeAssociation).filter(isForTypeName);
}

// /**
//  * Retrieves type association that match a specified type and reference object ID.
//  *
//  * @param {Array} associations - Array of association objects to search within.
//  * @param {Object} type - The type object to filter associations by.
//  * @param {string} referenceObjectId - The reference object ID to match.
//  * @returns {Object} - An association that:
//  *                        is of the specified relation
//  *                        have a matching reference object ID
//  */
export function getTypeAssociationForTypeAndReferenceObjectId(
  associations: Association[],
  type: CmlType,
  referenceObjectId: string
): Association | undefined {
  const typeAssociations = getTypeAssociationsForType(associations, type.name);
  const isForReferenceObjectId = (a: Association): boolean => a.referenceObjectId === referenceObjectId;

  return typeAssociations.find(isForReferenceObjectId);
}

// /**
//  * Retrieves relation associations that match a specified relation and reference object ID.
//  *
//  * @param {Array} associations - Array of association objects to search within.
//  * @param {Object} relation - The relation object to filter associations by.
//  * @param {string} referenceObjectId - The reference object ID to match.
//  * @returns {Object} - An association that:
//    *                      is of the specified relation
//  *                        have a matching reference object ID
//  */
export function getRelationAssociationForRelationAndReferenceObjectId(
  associations: Association[],
  relation: CmlRelation,
  referenceObjectId: string
): Association | undefined {
  const relationAssociations = getRelationAssociationsForRelation(associations, relation);
  const isForReferenceObjectId = (a: Association): boolean => a.referenceObjectId === referenceObjectId;

  return relationAssociations.find(isForReferenceObjectId);
}

// /**
//  * Filters a list of associations to return only those that are of type `RELATION`,
//  * are part of the specified type's relations, and are not marked for deletion.
//  *
//  * @param {Array} associations - Array of association objects to filter.
//  * @param {Object} type - An object representing the type, which includes a `relations` property.
//  * @param {Array<Object>} type.relations - Array of relation objects associated with the type.
//  * @param {string} type.relations[].name - The name of each relation associated with the type.
//  * @returns {Array} Filtered array of associations that match the criteria:
//  *                  they are of type `RELATION`, their tag matches a relation in the specified type,
//  *                  and they are not marked for deletion.
//  */
export function getRelationAssociationsForType(associations: Association[], type: CmlType): Association[] {
  const relations = new Set(type.relations.map((r) => r.name));
  const prcIds = new Set(type.relations.flatMap((r) => r.prcIds));

  const isRelationAssociation = (a: Association): boolean => a.type === ASSOCIATION_TYPES.RELATION;
  const isRelationAssociationPartOfType = (a: Association): boolean =>
    relations.has(a.tag) && prcIds.has(a.referenceObjectId);
  const isNotMarkedForDelete = (a: Association): boolean => a && false; // !a.hasState(ASSOCIATION_STATES.MARKED_FOR_DELETION);

  return associations
    .filter(isRelationAssociation)
    .filter(isRelationAssociationPartOfType)
    .filter(isNotMarkedForDelete);
}

// /**
//  * Retrieves active relation associations for a specified relation from a list of associations.
//  *
//  * @param {Array} associations - The list of associations to filter.
//  * @param {Object} relation - The relation object to match against.
//  * @param {string} relation.name - The name of the relation to filter associations by.
//  * @returns {Array} - An array of associations that:
//  *   - have the type `ASSOCIATION_TYPES.RELATION`
//  *   - match the specified relation's name
//  *   - are not marked for deletion
//  */
export function getRelationAssociationsForRelation(associations: Association[], relation: CmlRelation): Association[] {
  const isRelationAssociation = (a: Association): boolean => a.type === ASSOCIATION_TYPES.RELATION;
  const isForRelationName = (a: Association): boolean =>
    a.tag === relation.name && relation.prcIds?.includes(a.referenceObjectId);
  const isNotMarkedForDelete = (a: Association): boolean => a && false; // !a.hasState(ASSOCIATION_STATES.MARKED_FOR_DELETION);

  return associations.filter(isRelationAssociation).filter(isForRelationName).filter(isNotMarkedForDelete);
}

/**
 * Retrieves the tag name of the type association for a given reference object ID.
 *
 * @param {Array} associations - Array of association objects to search within.
 * @param {string} referenceObjectId - The reference object ID to match.
 * @returns {string|undefined} The tag name of the type association if found, otherwise undefined.
 */
export function getTypeNameForRelatedObjectId(
  associations: Association[],
  referenceObjectId: string
): string | undefined {
  const isTypeAssociation = (a: Association): boolean => a.type === ASSOCIATION_TYPES.TYPE;
  const isRelatedObjectMatch = (a: Association): boolean => a.referenceObjectId === referenceObjectId;

  const association = associations.filter(isTypeAssociation).find(isRelatedObjectMatch);

  return association?.tag;
}

/**
 * Retrieves the tag name of the relation association for a given reference object ID.
 *
 * @param {Array} associations - Array of association objects to search within.
 * @param {string} referenceObjectId - The reference object ID to match.
 * @returns {string|undefined} The tag name of the relation association if found, otherwise undefined.
 */
export function getRelationNameForRelatedObjectId(
  associations: Association[],
  referenceObjectId: string
): string | undefined {
  const isRelationAssociation = (a: Association): boolean => a.type === ASSOCIATION_TYPES.RELATION;
  const isRelatedObjectMatch = (a: Association): boolean => a.referenceObjectId === referenceObjectId;

  const association = associations.filter(isRelationAssociation).find(isRelatedObjectMatch);

  return association?.tag;
}

/**
 * Filters associations to return only those marked for creation.
 *
 * @param {Array} associations - Array of association objects to filter.
 * @returns {Array} Filtered array of associations marked for creation.
 */
export function getAssociationRecordsToCreate(associations: Association[]): Association[] {
  return associations;
  // return associations.filter((a) => a.hasState(ASSOCIATION_STATES.DRAFT));
}

/**
 * Filters associations to return only those marked for update.
 *
 * @param {Array} associations - Array of association objects to filter.
 * @returns {Array} Filtered array of associations marked for update.
 */
export function getAssociationRecordsToUpdate(associations: Association[]): Association[] {
  return associations;
  // return associations.filter((a) => a.hasState(ASSOCIATION_STATES.MARKED_FOR_UPDATE));
}

/**
 * Returns true if there is an existing association for the same tag and reference object ID
 *
 * @param {Array} associations - Array of association objects to filter.
 * @param {string} tag - The tag of the association to match
 * @param {string} referenceObjectId - The reference object ID of the association to match.
 * @returns {Boolean} True or false depending on if the association exists
 */
export function isDuplicateAssociationRecord(
  associations: Association[],
  tag: string,
  referenceObjectId: string
): boolean {
  return associations.some((a) => a.tag === tag && a.referenceObjectId === referenceObjectId);
}

/**
 * Returns generated CSV using provided associations for provided CML model name
 *
 * @param {string} cmlName - The name of target CML model.
 * @param {Array} associations - Array of association objects.
 * @returns {String} Generated CSV content
 */
export function generateCsvForAssociations(cmlName: string, associations: Association[]): string {
  return (
    'ExpressionSet.ApiName,ConstraintModelTag,ConstraintModelTagType,ReferenceObjectId,$Product2ReferenceId,$ProductClassificationName,$ProductRelatedComponentKey\n' +
    associations
      .map((a) => {
        const product2ReferenceId = a.referenceObjectType === 'Product2' ? a.referenceObjectReferenceValue : '';
        const productClassificationName =
          a.referenceObjectType === 'ProductClassification' ? a.referenceObjectReferenceValue : '';
        const productRelatedComponentKey =
          a.referenceObjectType === 'ProductRelatedComponent' ? a.referenceObjectReferenceValue : '';
        return `${cmlName},${a.tag},${a.type},${a.referenceObjectId},${product2ReferenceId},${productClassificationName},${productRelatedComponentKey}`;
      })
      .join('\n')
  );
}
