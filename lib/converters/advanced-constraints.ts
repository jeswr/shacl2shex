/**
 * Advanced constraint converters for SHACL to ShEx
 * 
 * Handles complex SHACL constraints that require special mapping logic
 */

import * as SHACL from '../types/shacl-types';
import * as ShEx from '../types/shex-types';
import { Result, Maybe } from '../utils/functional-helpers';
import { ConversionError, ConversionContext } from './shacl-to-shex-converter';

/**
 * Convert sh:hasValue constraint
 * Maps to a fixed value in ShEx
 * Spec: https://www.w3.org/TR/shacl/#HasValueConstraintComponent
 */
export const convertHasValue = (
  hasValue: SHACL.RDFTerm[],
  context: ConversionContext
): Result<ShEx.NodeConstraint, ConversionError> => {
  
  if (hasValue.length === 0) {
    return Result.error({
      type: 'InvalidInput',
      message: 'sh:hasValue requires at least one value'
    });
  }
  
  // Convert RDF terms to ShEx values
  const values = hasValue.map(value => {
    if (typeof value === 'string') {
      return value; // IRI
    }
    
    if (typeof value === 'number') {
      return {
        value: value.toString(),
        datatype: 'http://www.w3.org/2001/XMLSchema#decimal'
      } as ShEx.Literal;
    }
    
    if (typeof value === 'boolean') {
      return {
        value: value.toString(),
        datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
      } as ShEx.Literal;
    }
    
    return {
      value: String(value),
      datatype: 'http://www.w3.org/2001/XMLSchema#string'
    } as ShEx.Literal;
  });
  
  return Result.ok({
    type: 'NodeConstraint',
    values
  });
};

/**
 * Convert sh:languageIn constraint
 * Maps to language tag constraints in ShEx
 * Spec: https://www.w3.org/TR/shacl/#LanguageInConstraintComponent
 */
export const convertLanguageIn = (
  languages: string[],
  context: ConversionContext
): Result<ShEx.NodeConstraint, ConversionError> => {
  
  if (languages.length === 0) {
    return Result.error({
      type: 'InvalidInput',
      message: 'sh:languageIn requires at least one language'
    });
  }
  
  // Create language value set
  const values: ShEx.Language[] = languages.map(lang => ({
    type: 'Language',
    languageTag: lang
  }));
  
  return Result.ok({
    type: 'NodeConstraint',
    values
  });
};

/**
 * Convert sh:uniqueLang constraint
 * Maps to UNIQUE constraint in ShEx (requires extension)
 * Spec: https://www.w3.org/TR/shacl/#UniqueLangConstraintComponent
 */
export const convertUniqueLang = (
  uniqueLang: boolean,
  tripleConstraint: ShEx.TripleConstraint,
  context: ConversionContext
): Result<ShEx.TripleConstraint, ConversionError> => {
  
  if (uniqueLang) {
    // Add annotation to indicate unique language constraint
    tripleConstraint.annotations = tripleConstraint.annotations || [];
    tripleConstraint.annotations.push({
      predicate: 'http://www.w3.org/ns/shacl#uniqueLang',
      object: 'true'
    });
    
    // Add warning about partial support
    context.warnings.push(
      'sh:uniqueLang is mapped as an annotation. Full uniqueness validation may require additional processing.'
    );
  }
  
  return Result.ok(tripleConstraint);
};

/**
 * Convert property pair constraints (sh:equals, sh:disjoint, sh:lessThan, sh:lessThanOrEquals)
 * These require special handling as ShEx doesn't have direct equivalents
 * Spec: https://www.w3.org/TR/shacl/#core-components-property-pairs
 */
export const convertPropertyPairConstraint = (
  constraintType: 'equals' | 'disjoint' | 'lessThan' | 'lessThanOrEquals',
  properties: SHACL.IRI[],
  context: ConversionContext
): Result<ShEx.SemAct, ConversionError> => {
  
  if (properties.length === 0) {
    return Result.error({
      type: 'InvalidInput',
      message: `sh:${constraintType} requires at least one property`
    });
  }
  
  // Create semantic action to represent the constraint
  const semAct: ShEx.SemAct = {
    name: `http://www.w3.org/ns/shacl#${constraintType}`,
    code: properties.join(' ')
  };
  
  // Add warning about limited support
  context.warnings.push(
    `sh:${constraintType} is mapped to a semantic action. Validation requires custom implementation.`
  );
  
  return Result.ok(semAct);
};

/**
 * Convert sh:qualifiedValueShape with qualifiedMinCount/qualifiedMaxCount
 * Maps to complex ShEx expressions
 * Spec: https://www.w3.org/TR/shacl/#QualifiedValueShapeConstraintComponent
 */
export const convertQualifiedValueShape = (
  shape: SHACL.PropertyShape,
  context: ConversionContext
): Result<ShEx.tripleExpr, ConversionError> => {
  
  if (!shape.qualifiedValueShape) {
    return Result.error({
      type: 'InvalidInput',
      message: 'qualifiedValueShape is required for qualified constraints'
    });
  }
  
  // This is a complex mapping that would require creating
  // a combination of shape expressions with cardinality constraints
  
  context.warnings.push(
    'sh:qualifiedValueShape requires complex mapping. Current implementation provides partial support.'
  );
  
  // Simplified implementation - would need more sophisticated handling
  return Result.ok({
    type: 'TripleConstraint',
    predicate: shape.path as string,
    min: shape.qualifiedMinCount,
    max: shape.qualifiedMaxCount,
    annotations: [{
      predicate: 'http://www.w3.org/ns/shacl#qualifiedValueShape',
      object: 'true'
    }]
  });
};

/**
 * Convert SHACL-SPARQL constraints
 * These cannot be directly mapped to ShEx
 * Spec: https://www.w3.org/TR/shacl/#sparql-constraints
 */
export const convertSPARQLConstraint = (
  sparqlConstraint: SHACL.SPARQLConstraint,
  context: ConversionContext
): Result<ShEx.SemAct, ConversionError> => {
  
  const query = sparqlConstraint.select || sparqlConstraint.ask;
  
  if (!query) {
    return Result.error({
      type: 'InvalidInput',
      message: 'SPARQL constraint requires select or ask query'
    });
  }
  
  // Create semantic action to represent SPARQL constraint
  const semAct: ShEx.SemAct = {
    name: 'http://www.w3.org/ns/shacl#sparql',
    code: JSON.stringify({
      query,
      prefixes: sparqlConstraint.prefixes,
      message: sparqlConstraint.message
    })
  };
  
  context.warnings.push(
    'SPARQL constraints are mapped to semantic actions. Validation requires SPARQL execution engine.'
  );
  
  return Result.ok(semAct);
};

/**
 * Convert sh:xone (exactly one) constraint
 * Maps to a complex ShEx expression
 * Spec: https://www.w3.org/TR/shacl/#XoneConstraintComponent
 */
export const convertXone = (
  shapes: SHACL.NodeShape[],
  context: ConversionContext
): Result<ShEx.shapeExpr, ConversionError> => {
  
  if (shapes.length < 2) {
    return Result.error({
      type: 'InvalidInput',
      message: 'sh:xone requires at least two shapes'
    });
  }
  
  // XONE is "exactly one of" - this requires a more complex encoding in ShEx
  // We can approximate it using OR combined with NOT for mutual exclusion
  
  context.warnings.push(
    'sh:xone (exactly one) constraint approximated using ShEx OR. Full mutual exclusion validation may require additional logic.'
  );
  
  // For now, approximate with OR (at least one)
  // Full implementation would need to ensure mutual exclusion
  return Result.ok({
    type: 'ShapeOr',
    shapeExprs: shapes.map(s => ({
      type: 'ShapeRef',
      reference: s.id || '_:xone_shape'
    }))
  });
};

/**
 * Convert complex property paths
 * Handles sequence paths, alternative paths, inverse paths, etc.
 * Spec: https://www.w3.org/TR/shacl/#property-paths
 */
export const convertComplexPath = (
  path: SHACL.PropertyPath,
  context: ConversionContext
): Result<string, ConversionError> => {
  
  if (SHACL.isPredicatePath(path)) {
    return Result.ok(path);
  }
  
  if (SHACL.isInversePath(path)) {
    // ShEx supports inverse paths with ^
    const innerPath = convertComplexPath(path.path, context);
    return Result.map(innerPath, p => `^${p}`);
  }
  
  if (SHACL.isSequencePath(path)) {
    // Sequence paths require special handling
    context.warnings.push(
      'Sequence paths are not directly supported in ShEx. Consider restructuring the shape.'
    );
    return Result.error({
      type: 'UnsupportedConstruct',
      construct: 'SequencePath',
      details: 'ShEx does not support property path sequences'
    });
  }
  
  if (SHACL.isAlternativePath(path)) {
    // Alternative paths could be mapped to OneOf in some cases
    context.warnings.push(
      'Alternative paths require special handling in ShEx.'
    );
    return Result.error({
      type: 'UnsupportedConstruct',
      construct: 'AlternativePath',
      details: 'Alternative paths require manual conversion'
    });
  }
  
  if (SHACL.isZeroOrMorePath(path) || SHACL.isOneOrMorePath(path) || SHACL.isZeroOrOnePath(path)) {
    // These require recursive shape definitions
    context.warnings.push(
      'Path cardinality operators (* + ?) require recursive shape definitions in ShEx.'
    );
    return Result.error({
      type: 'UnsupportedConstruct',
      construct: 'PathCardinality',
      details: 'Path cardinality requires manual conversion to recursive shapes'
    });
  }
  
  return Result.error({
    type: 'UnsupportedConstruct',
    construct: 'ComplexPath',
    details: 'Unknown property path type'
  });
};

/**
 * Convert sh:flags for regex patterns
 * Maps regex flags from SHACL to ShEx
 */
export const convertRegexFlags = (
  flags: string | undefined
): string | undefined => {
  // ShEx supports the same regex flags as SHACL (XPath/XQuery flags)
  // Common flags: i (case-insensitive), m (multiline), s (dot-all), x (extended)
  return flags;
};

/**
 * Helper to combine multiple constraints into a single shape expression
 */
export const combineConstraints = (
  constraints: ShEx.shapeExpr[],
  operator: 'and' | 'or' = 'and'
): ShEx.shapeExpr => {
  
  if (constraints.length === 0) {
    return { type: 'NodeConstraint' };
  }
  
  if (constraints.length === 1) {
    return constraints[0]!;
  }
  
  return operator === 'and'
    ? { type: 'ShapeAnd', shapeExprs: constraints }
    : { type: 'ShapeOr', shapeExprs: constraints };
};