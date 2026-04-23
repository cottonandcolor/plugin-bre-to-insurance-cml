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
import { ASSOCIATION_TYPES, CML_DATA_TYPES, CML_VARIABLE_VALUE_TYPES } from './constants/constants.js';
import {
  getRelationAssociationForRelationAndReferenceObjectId,
  getRelationNameForRelatedObjectId,
  getTypeAssociationForTypeAndReferenceObjectId,
  getTypeNameForRelatedObjectId,
} from './utils/association.utils.js';
import {
  PCMProduct,
  PCMProductAttribute,
  PCMProductComponentGroup,
  PCMProductRelatedComponent,
} from './pcm-products.types.js';
import { isRelationNameUnique, isScaledType, isTypeNameUnique } from './utils/common.utils.js';
import { Association, CmlAttribute, CmlDomain, CmlModel, CmlRelation, CmlType } from './types/types.js';

const dataTypeToCmlType = {
  CHECKBOX: CML_DATA_TYPES.BOOLEAN,
  DATE: CML_DATA_TYPES.DATE,
  NUMBER: CML_DATA_TYPES.DECIMAL,
  TEXT: CML_DATA_TYPES.STRING,
  STRING: CML_DATA_TYPES.STRING,
  CURRENCY: CML_DATA_TYPES.DECIMAL,
  PERCENT: CML_DATA_TYPES.DECIMAL,
} as { [k: string]: string };

export class PcmGenerator {
  public static generateType(
    model: CmlModel,
    product: PCMProduct,
    existingProductIdsToTypes: Map<string, CmlType>
  ): { type: CmlType; association?: Association } {
    const existingTypeName = getTypeNameForRelatedObjectId(model.associations, product.id);
    if (existingTypeName) {
      const existingType = model.getType(existingTypeName);
      if (existingType) {
        return {
          type: existingType,
        };
      }
    }
    const name = product.nodeType === 'productClass' ? product.productClassification.name : product.name;
    const typeName = generateUniqueTypeName(model, name, existingProductIdsToTypes);
    const type = new CmlType(typeName, product.id, product.productClassification?.id);

    const hasExistingAssociation = getTypeAssociationForTypeAndReferenceObjectId(model.associations, type, product.id);
    if (hasExistingAssociation) {
      return {
        type,
      };
    }

    const referenceObjectId = product.nodeType === 'productClass' ? product.productClassification?.id : product.id;
    const referenceObjectType = product.nodeType === 'productClass' ? 'ProductClassification' : 'Product2';
    const referenceObjectReferenceValue =
      product.nodeType === 'productClass' ? product.productClassification?.name : product.name;
    const association = new Association(
      null,
      typeName,
      ASSOCIATION_TYPES.TYPE,
      referenceObjectId,
      referenceObjectType,
      referenceObjectReferenceValue
    );

    return {
      association,
      type,
    };
  }

  public static setParentTypesToBaseType(model: CmlModel): void {
    const baseType = model.getType('LineItem');
    for (const type of model.types) {
      if (baseType && type !== baseType && type.parentType == null && type.properties?.virtual !== true) {
        type.setParentType(baseType);
      }
    }
  }

  public static generateRelationsAndChildTypes(
    model: CmlModel,
    type: CmlType,
    rootProduct: PCMProduct,
    childProducts: PCMProduct[]
  ): { associations: Association[]; relations: CmlRelation[]; types: CmlType[] } {
    const relations: CmlRelation[] = [];
    const types: CmlType[] = [];
    const associations: Association[] = [];
    const existingProductIdsToTypes = new Map<string, CmlType>();
    const existingPrcIdsToRelations = new Map<string, CmlRelation>();

    const rootProductId = rootProduct.id;
    // generate association for root product's type
    const existingAssociation = getTypeAssociationForTypeAndReferenceObjectId(model.associations, type, rootProductId);
    if (!existingAssociation) {
      associations.push(
        new Association(null, type.name, ASSOCIATION_TYPES.TYPE, rootProductId, 'Product2', rootProduct.name)
      );
    }

    for (const childProduct of childProducts) {
      // generate child type
      const childTypeResult = PcmGenerator.generateType(model, childProduct, existingProductIdsToTypes);
      const childProductType = childTypeResult.type;
      types.push(childProductType);
      existingProductIdsToTypes.set(childProduct.id, childProductType);
      if (childTypeResult.association) {
        associations.push(childTypeResult.association);
      }

      // generate relation to child type
      const prc = childProduct.productRelatedComponent;
      const childRelationResult = PcmGenerator.generateRelation(
        model,
        type,
        childProductType,
        childProduct,
        rootProduct,
        prc,
        existingPrcIdsToRelations
      );
      relations.push(childRelationResult.relation);
      existingPrcIdsToRelations.set(prc.id, childRelationResult.relation);
      if (childRelationResult.association) {
        associations.push(childRelationResult.association);
      }
    }
    return {
      associations,
      relations,
      types,
    };
  }

  // generate types, attributes, relations, associations
  public static generateViewModels(
    model: CmlModel,
    productsToAdd: PCMProduct[]
  ): {
    types: CmlType[];
    associations: Association[];
    attributes: Map<string, CmlAttribute[]>;
    relations: Map<string, CmlRelation[]>;
  } {
    const types: CmlType[] = [];
    const associations: Association[] = [];
    const relations = new Map<string, CmlRelation[]>();
    const attributes = new Map<string, CmlAttribute[]>();
    // prevent duplicates by keeping track of selected products and PRCs that are not yet added to the model
    const existingProductIdsToTypes = new Map<string, CmlType>();
    const existingPrcIdsToRelations = new Map<string, CmlRelation>();

    for (const product of productsToAdd) {
      // for single product/parent product, generate types, attributes, type associations
      let type = existingProductIdsToTypes.get(product.id);
      if (!type) {
        const typeInfo = PcmGenerator.generateType(model, product, existingProductIdsToTypes);
        type = typeInfo.type;
        const baseType = model.getType('LineItem');
        if (baseType) {
          type.setParentType(baseType);
        }
        types.push(type);
        existingProductIdsToTypes.set(product.id, type);
        if (typeInfo.association) {
          associations.push(typeInfo.association);
        }
        const existingTypeName = getTypeNameForRelatedObjectId(model.associations, product.id);
        if (!existingTypeName) {
          const productAttributes = PcmGenerator.getProductAttributes(product);
          const typeAttributes = PcmGenerator.generateAttributes(productAttributes);
          if (typeAttributes && typeAttributes.length > 0) {
            attributes.set(type.name, typeAttributes);
            // type.setPcmVariables(typeAttributes);
          }
        }
      }

      // if bundle product, generate view model for all levels
      const productComponents = PcmGenerator.getProductComponents(product);
      if (productComponents && productComponents.length > 0) {
        const childTypesInfo = PcmGenerator.generateRelationsAttributesAndChildTypesRecursively(
          model,
          type,
          product,
          productComponents,
          existingProductIdsToTypes,
          existingPrcIdsToRelations
        );
        if (childTypesInfo.types && childTypesInfo.types.length > 0) {
          types.push(...childTypesInfo.types);
        }
        if (childTypesInfo.relations && childTypesInfo.relations.size > 0) {
          childTypesInfo.relations.forEach((value, key) => {
            relations.set(key, value);
          });
        }
        if (childTypesInfo.associations && childTypesInfo.associations.length > 0) {
          associations.push(...childTypesInfo.associations);
        }
        if (childTypesInfo.attributes && childTypesInfo.attributes.size > 0) {
          childTypesInfo.attributes.forEach((value, key) => {
            attributes.set(key, value);
          });
        }
      }
    }
    return {
      types,
      attributes,
      relations,
      associations,
    };
  }

  public static generateRelationsAttributesAndChildTypesRecursively(
    model: CmlModel,
    type: CmlType,
    parentProduct: PCMProduct,
    childProducts: PCMProduct[],
    existingProductIdsToTypes: Map<string, CmlType>,
    existingPrcIdsToRelations: Map<string, CmlRelation>,
    types: CmlType[] = [],
    associations: Association[] = [],
    relations: Map<string, CmlRelation[]> = new Map<string, CmlRelation[]>(),
    attributes: Map<string, CmlAttribute[]> = new Map<string, CmlAttribute[]>()
  ): {
    associations: Association[];
    relations: Map<string, CmlRelation[]>;
    attributes: Map<string, CmlAttribute[]>;
    types: CmlType[];
  } {
    for (const childProduct of childProducts) {
      // generate child type, type association, attributes if they don't exist
      let childType = existingProductIdsToTypes.get(childProduct.id);
      if (!childType) {
        const childTypeInfo = PcmGenerator.generateType(model, childProduct, existingProductIdsToTypes);
        childType = childTypeInfo.type;
        const baseType = model.getType('LineItem');
        if (baseType && !childType.hasParentType()) {
          childType.setParentType(baseType);
        }
        types.push(childType);
        if (childTypeInfo.association) {
          associations.push(childTypeInfo.association);
        }
        existingProductIdsToTypes.set(childProduct.id, childType);
        const existingTypeName = getTypeNameForRelatedObjectId(model.associations, childProduct.id);
        if (!existingTypeName) {
          const productAttributes = PcmGenerator.getProductAttributes(childProduct);
          const childTypeAttributes = PcmGenerator.generateAttributes(productAttributes);
          if (childTypeAttributes && childTypeAttributes.length > 0) {
            attributes.set(childType.name, childTypeAttributes);
            // childType.setPcmVariables(childTypeAttributes);
          }
        }
      }

      // generate relation to child type and relation association if they don't exist
      const prc = childProduct.productRelatedComponent;
      if (!existingPrcIdsToRelations.get(prc.id)) {
        const childRelationInfo = PcmGenerator.generateRelation(
          model,
          type,
          childType,
          childProduct,
          parentProduct,
          prc,
          existingPrcIdsToRelations
        );
        const relationsForTypeId = relations.get(type.name) ?? [];
        if (!relationsForTypeId.includes(childRelationInfo.relation)) {
          relationsForTypeId.push(childRelationInfo.relation);
          relations.set(type.name, relationsForTypeId);
        }
        existingPrcIdsToRelations.set(prc.id, childRelationInfo.relation);
        if (childRelationInfo.association) {
          associations.push(childRelationInfo.association);
        }
      }

      // generate entities for each level of bundle
      const childProductComponents = this.getProductComponents(childProduct);
      if (childProductComponents && childProductComponents.length > 0) {
        this.generateRelationsAttributesAndChildTypesRecursively(
          model,
          childType,
          childProduct,
          childProductComponents,
          existingProductIdsToTypes,
          existingPrcIdsToRelations,
          types,
          associations,
          relations,
          attributes
        );
      }
    }
    return {
      associations,
      attributes,
      relations,
      types,
    };
  }

  public static generateRelation(
    model: CmlModel,
    parentProductType: CmlType,
    childProductType: CmlType,
    childProductComponent: PCMProduct,
    parentProduct: PCMProduct,
    prc: PCMProductRelatedComponent,
    existingPrcIdsToRelations: Map<string, CmlRelation>
  ): { association?: Association; relation: CmlRelation } {
    const existingRelationName = getRelationNameForRelatedObjectId(model.associations, prc.id);
    if (existingRelationName) {
      const existingRelation = parentProductType.getRelation(existingRelationName);
      if (existingRelation) {
        // TODO: Potential bug here is that a different type could have a
        //  relation for this PRC record. Relation names are not unique
        //  across types, and associations could confuse this code.
        return {
          relation: existingRelation,
        };
      }
    }
    const relationName = generateUniqueRelationName(
      parentProductType,
      childProductType.name,
      existingPrcIdsToRelations
    );
    const relation = new CmlRelation(relationName, childProductType.name);

    relation.setPrcIds([prc.id]);

    if (prc.minQuantity !== undefined) {
      relation.setMinCardinality(prc.minQuantity);
    } else if (prc.isComponentRequired) {
      relation.setMinCardinality(1);
    }

    if (prc.maxQuantity !== undefined) {
      relation.setMaxCardinality(prc.maxQuantity);
    } else if (prc.isComponentRequired) {
      relation.setMaxCardinality(9999);
    }

    // // all CML components have a default quantity of 1, so only set this if that is not the case
    // if (prc.quantity > 1) {
    //   const component = new Component(childProductType.name);
    //   component.setDefaultQuantity(prc.quantity);
    //   relation.addDefaultComponent(component);
    // }

    const hasExistingAssociation = getRelationAssociationForRelationAndReferenceObjectId(
      model.associations,
      relation,
      prc.id
    );
    if (hasExistingAssociation) {
      return {
        relation,
      };
    }

    let referenceObjectReferenceValue = `${parentProduct.name}||${childProductComponent.name}||`;
    if (childProductComponent.nodeType === 'productClass') {
      referenceObjectReferenceValue = `${parentProduct.name}||||${childProductComponent.productClassification.name}`;
    }

    const association = new Association(
      null,
      relationName,
      ASSOCIATION_TYPES.RELATION,
      prc.id,
      'ProductRelatedComponent',
      referenceObjectReferenceValue
    );

    return {
      association,
      relation,
    };
  }

  public static getProductComponents(product: PCMProduct): PCMProduct[] {
    const components: PCMProduct[] = [];

    // Helper function to recursively process groups and child groups
    function processGroup(group: PCMProductComponentGroup): void {
      components.push(...(group.components || []));
      (group.childGroups || []).forEach(processGroup);
    }

    // // Add ungrouped components (legacy PCM support)
    // components.push(...(product.components || []));

    // Add grouped components recursively
    (product.productComponentGroups || []).forEach(processGroup);

    return components;
  }

  public static generateAttributes(productAttributes: PCMProductAttribute[]): CmlAttribute[] {
    const attributes = [];
    for (const productAttribute of productAttributes) {
      attributes.push(PcmGenerator.generateAttribute(productAttribute));
    }
    return attributes;
  }

  public static generateAttribute(productAttribute: PCMProductAttribute): CmlAttribute {
    const attributeId = productAttribute.id;
    const attributeName = productAttribute.developerName;
    const attributeType = PcmGenerator.dataTypeToCmlDataType(productAttribute);
    const attribute = new CmlAttribute(attributeId, attributeName, attributeType);

    if (isScaledType(attributeType)) {
      // For now, we're hardcoding the scale to "2" for all PCM attribute types
      // UOM feature may change this later
      attribute.setTypeScale(2);
    }

    const domain = generateDomain(productAttribute);
    if (domain) {
      attribute.setValue(CML_VARIABLE_VALUE_TYPES.DOMAIN, domain);
    }

    if (productAttribute.isReadOnly) {
      attribute.setProperties({ configurable: false });
    }

    if (productAttribute.defaultValue) {
      attribute.setProperties({ defaultValue: productAttribute.defaultValue });
    }

    return attribute;
  }

  public static getProductAttributes(product: PCMProduct): PCMProductAttribute[] {
    const attributes = [];

    // uncategorized attributes (legacy PCM support)
    attributes.push(...(product.attributes || []));

    // categorized attributes
    attributes.push(...(product.attributeCategory?.flatMap((ac) => ac.attributes) ?? []));

    // filter out Inactive and DateTime attributes
    return attributes.filter((a) => a.status === 'Active' && a.dataType.toUpperCase() !== 'DATETIME');
  }

  public static dataTypeToCmlDataType(attribute: PCMProductAttribute): string {
    if (attribute.dataType.toUpperCase() === 'PICKLIST') {
      return this.dataTypeNameToCmlDataType(attribute.picklist.dataType);
    }
    return this.dataTypeNameToCmlDataType(attribute.dataType);
  }

  public static dataTypeNameToCmlDataType(dataType: string): string {
    return dataTypeToCmlType[dataType.toUpperCase()];
  }
}

export function generateDomain(attribute: PCMProductAttribute): CmlDomain | null {
  if (attribute.dataType.toUpperCase() === 'PICKLIST') {
    const domain = new CmlDomain();
    const pickListDataType = attribute.picklist.dataType?.toUpperCase();
    switch (pickListDataType) {
      case 'TEXT':
        domain.setDomainValues(attribute.picklist.values.map((v) => v.value));
        break;
      case 'NUMBER':
        domain.setDomainValues(attribute.picklist.values.map((v) => Number(v.value)));
        break;
      case 'DATE':
        domain.setDomainValues(attribute.picklist.values.map((v) => new Date(v.value)));
        break;
      case 'DATETIME':
        domain.setDomainValues(attribute.picklist.values.map((v) => new Date(v.value)));
        break;
      case 'BOOLEAN':
        domain.setDomainValues(attribute.picklist.values.map((v) => v.value === 'true'));
        break;
      case 'CURRENCY':
        domain.setDomainValues(attribute.picklist.values.map((v) => Number(v.value)));
        break;
      case 'PERCENT':
        domain.setDomainValues(attribute.picklist.values.map((v) => Number(v.value)));
        break;
      default:
        domain.setDomainValues(attribute.picklist.values.map((v) => v.value));
        break;
    }
    return domain;
  }
  return null;
}

/**
 * Generates a unique type name for a product within the given model.
 * Ensures the name has only alphanumeric characters and underscores, starts with a letter,
 * and is no longer than 80 characters.
 *
 * @param {Object} model - The model containing existing type names.
 * @param {string} productName - The base name of the product.
 * @param {Map} existingProductIdsToTypes - A map of existing type names to types that have been created but not yet saved to the model.
 * @returns {string} - A valid, unique type name.
 */
export function generateUniqueTypeName(
  model: CmlModel,
  productName: string,
  existingProductIdsToTypes: Map<string, CmlType>
): string {
  // Remove invalid characters and ensure the name starts with an alphabetic character
  let name = productName
    .replace(/[^a-zA-Z0-9_]/g, '') // Keep only alphanumeric and underscores
    .replace(/^[^a-zA-Z]+/, ''); // Ensure it starts with a letter

  if (!name) {
    throw new Error('Product name must contain at least one alphabetic character.');
  }

  // Truncate the name to ensure it's no longer than 80 characters
  const maxBaseLength = 80; // Max length for base name (excluding numeric suffixes)
  if (name.length > maxBaseLength) {
    name = name.substring(0, maxBaseLength);
  }

  let result = name;
  let index = 1;

  // Ensure uniqueness and handle length constraints when appending suffixes
  while (!isTypeNameUnique(model, result, existingProductIdsToTypes) || result.length > 80) {
    const suffix = `${index}`;
    const truncatedName = name.substring(0, Math.min(maxBaseLength - suffix.length, name.length));
    result = `${truncatedName}${suffix}`;
    index += 1;
  }

  return result;
}

/**
 * Generates a unique relation name for a parent product type based on a child product type name.
 *
 * @param {Object} parentProductType - The parent product type object containing existing relations.
 * @param {string} childProductTypeName - The base name for the relation.
 * @param {Map} existingPrcIdsToRelations - A map of existing relation names to relations that have been created but not yet saved to the model.
 * @returns {string} - A unique, lowercased relation name.
 */
export function generateUniqueRelationName(
  parentProductType: CmlType,
  childProductTypeName: string,
  existingPrcIdsToRelations: Map<string, CmlRelation>
): string {
  // product type name
  const baseName = childProductTypeName.toLowerCase(); // lowercased child

  let result = baseName;
  let index = 1;

  // Ensure uniqueness and handle length constraints when appending suffixes
  while (!isRelationNameUnique(parentProductType, result, existingPrcIdsToRelations)) {
    const suffix = `${index}`;
    result = `${baseName}${suffix}`;
    index += 1;
  }

  return result;
}
