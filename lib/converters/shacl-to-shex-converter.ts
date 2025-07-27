/**
 * SHACL to ShEx Converter
 * 
 * A functional implementation of SHACL to ShEx conversion
 * Based on:
 * - SHACL 1.1: https://www.w3.org/TR/shacl/
 * - ShEx 2.1: http://shex.io/shex-semantics/
 */

import * as SHACL from '../types/shacl-types';
import * as ShEx from '../types/shex-types';
import { Result, Maybe, pipe, compose, mapObject, filterObject } from '../utils/functional-helpers';
import { getMappingForShaclConstruct } from '../mappings/shacl-shex-mapping';
import { 
  convertHasValue, 
  convertLanguageIn, 
  convertUniqueLang,
  convertPropertyPairConstraint,
  convertXone,
  combineConstraints
} from './advanced-constraints';

/**
 * Conversion error types
 */
export type ConversionError = 
  | { type: 'UnsupportedConstruct'; construct: string; details?: string }
  | { type: 'InvalidInput'; message: string }
  | { type: 'ConversionFailure'; source: string; target: string; reason: string };

/**
 * Conversion context to track state
 */
export interface ConversionContext {
  prefixes: Map<string, string>;
  generatedShapes: Map<string, ShEx.shapeExpr>;
  warnings: string[];
}

/**
 * Create an empty conversion context
 */
export const createContext = (): ConversionContext => ({
  prefixes: new Map([
    ['sh', 'http://www.w3.org/ns/shacl#'],
    ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
    ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#']
  ]),
  generatedShapes: new Map(),
  warnings: []
});

/**
 * Main conversion function
 */
export const convertShaclToShex = (
  shapesGraph: SHACL.ShapesGraph
): Result<ShEx.Schema, ConversionError> => {
  const context = createContext();
  
  // Add prefixes from SHACL
  if (shapesGraph.prefixes) {
    shapesGraph.prefixes.forEach(p => 
      context.prefixes.set(p.prefix, p.namespace)
    );
  }
  
  // Convert shapes
  const shapeResults = shapesGraph.shapes.map(shape => 
    convertShape(shape, context)
  );
  
  // Check for errors
  const errors = shapeResults.filter(Result.isError);
  if (errors.length > 0) {
    return errors[0]; // Return first error
  }
  
  // Extract successful conversions
  const shapeDecls = shapeResults
    .filter(Result.isOk)
    .map(r => r.value);
  
  // Build ShEx schema
  const schema: ShEx.Schema = {
    type: "Schema",
    prefixes: Object.fromEntries(context.prefixes),
    shapes: shapeDecls
  };
  
  // Add imports if present
  if (shapesGraph.imports && shapesGraph.imports.length > 0) {
    schema.imports = shapesGraph.imports;
  }
  
  return Result.ok(schema);
};

/**
 * Convert a SHACL shape to ShEx shape declaration
 */
const convertShape = (
  shape: SHACL.NodeShape | SHACL.PropertyShape,
  context: ConversionContext
): Result<ShEx.ShapeDecl, ConversionError> => {
  const shapeId = shape.id || generateShapeId(shape);
  
  if (SHACL.isPropertyShape(shape)) {
    // Property shapes are typically embedded in node shapes
    // but can be standalone
    return convertPropertyShapeToShapeDecl(shape, shapeId, context);
  }
  
  return convertNodeShapeToShapeDecl(shape as SHACL.NodeShape, shapeId, context);
};

/**
 * Convert SHACL NodeShape to ShEx ShapeDecl
 * Spec: https://www.w3.org/TR/shacl/#node-shapes
 */
const convertNodeShapeToShapeDecl = (
  nodeShape: SHACL.NodeShape,
  shapeId: string,
  context: ConversionContext
): Result<ShEx.ShapeDecl, ConversionError> => {
  
  const shapeExprResult = convertNodeShapeToShapeExpr(nodeShape, context);
  
  return Result.map(shapeExprResult, shapeExpr => ({
    id: shapeId,
    shapeExpr
  }));
};

/**
 * Convert SHACL NodeShape to ShEx shapeExpr
 */
const convertNodeShapeToShapeExpr = (
  nodeShape: SHACL.NodeShape,
  context: ConversionContext
): Result<ShEx.shapeExpr, ConversionError> => {
  
  // Handle logical constraints first (sh:and, sh:or, sh:not, sh:xone)
  const logicalExpr = convertLogicalConstraints(nodeShape, context);
  if (logicalExpr.isSome()) {
    return Result.ok(logicalExpr.getOrElse({} as ShEx.shapeExpr));
  }
  
  // Check if this is purely a node constraint
  const hasOnlyNodeConstraints = !nodeShape.property || nodeShape.property.length === 0;
  
  if (hasOnlyNodeConstraints) {
    return convertToNodeConstraint(nodeShape, context);
  }
  
  // Convert to Shape with triple expressions
  return convertToShape(nodeShape, context);
};

/**
 * Convert logical constraints (sh:and, sh:or, sh:not)
 */
const convertLogicalConstraints = (
  shape: SHACL.NodeShape,
  context: ConversionContext
): Maybe<ShEx.shapeExpr> => {
  
  if (shape.and && shape.and.length > 0) {
    const andExprs = shape.and.map(s => convertNodeShapeToShapeExpr(s, context));
    const errors = andExprs.filter(Result.isError);
    
    if (errors.length > 0) {
      return Maybe.none();
    }
    
    const shapeExprs = andExprs.filter(Result.isOk).map(r => r.value);
    
    return Maybe.of<ShEx.ShapeAnd>({
      type: "ShapeAnd",
      shapeExprs
    });
  }
  
  if (shape.or && shape.or.length > 0) {
    const orExprs = shape.or.map(s => convertNodeShapeToShapeExpr(s, context));
    const errors = orExprs.filter(Result.isError);
    
    if (errors.length > 0) {
      return Maybe.none();
    }
    
    const shapeExprs = orExprs.filter(Result.isOk).map(r => r.value);
    
    return Maybe.of<ShEx.ShapeOr>({
      type: "ShapeOr",
      shapeExprs
    });
  }
  
  if (shape.not && shape.not.length > 0) {
    const notExpr = convertNodeShapeToShapeExpr(shape.not[0], context);
    
    if (Result.isError(notExpr)) {
      return Maybe.none();
    }
    
    return Maybe.of<ShEx.ShapeNot>({
      type: "ShapeNot",
      shapeExpr: notExpr.value
    });
  }
  
  if (shape.xone && shape.xone.length > 0) {
    const xoneResult = convertXone(shape.xone, context);
    
    if (Result.isError(xoneResult)) {
      return Maybe.none();
    }
    
    return Maybe.of(xoneResult.value);
  }
  
  return Maybe.none();
};

/**
 * Convert to ShEx NodeConstraint
 * Spec: http://shex.io/shex-semantics/#node-constraints
 */
const convertToNodeConstraint = (
  shape: SHACL.NodeShape,
  context: ConversionContext
): Result<ShEx.NodeConstraint, ConversionError> => {
  
  const nodeConstraint: ShEx.NodeConstraint = {
    type: "NodeConstraint"
  };
  
  // Node kind constraint
  if (shape.nodeKind) {
    const nodeKindResult = convertNodeKind(shape.nodeKind);
    if (Result.isError(nodeKindResult)) {
      return nodeKindResult;
    }
    nodeConstraint.nodeKind = nodeKindResult.value;
  }
  
  // Datatype constraint
  if (shape.datatype) {
    nodeConstraint.datatype = shape.datatype;
  }
  
  // Value set constraints (sh:in)
  if (shape.in && shape.in.length > 0) {
    nodeConstraint.values = shape.in.map(convertValueToShEx);
  }
  
  // sh:hasValue constraint
  if (shape.hasValue && shape.hasValue.length > 0) {
    const hasValueResult = convertHasValue(shape.hasValue, context);
    if (Result.isOk(hasValueResult)) {
      nodeConstraint.values = hasValueResult.value.values;
    }
  }
  
  // Language constraints
  if (shape.languageIn && shape.languageIn.length > 0) {
    const langResult = convertLanguageIn(shape.languageIn, context);
    if (Result.isOk(langResult)) {
      nodeConstraint.values = langResult.value.values;
    }
  }
  
  // String constraints
  if (shape.pattern) {
    nodeConstraint.pattern = shape.pattern;
    if (shape.flags) {
      nodeConstraint.flags = shape.flags;
    }
  }
  
  if (shape.minLength !== undefined) {
    nodeConstraint.minlength = shape.minLength;
  }
  
  if (shape.maxLength !== undefined) {
    nodeConstraint.maxlength = shape.maxLength;
  }
  
  // Numeric constraints
  if (shape.minInclusive !== undefined) {
    nodeConstraint.mininclusive = shape.minInclusive;
  }
  
  if (shape.maxInclusive !== undefined) {
    nodeConstraint.maxinclusive = shape.maxInclusive;
  }
  
  if (shape.minExclusive !== undefined) {
    nodeConstraint.minexclusive = shape.minExclusive;
  }
  
  if (shape.maxExclusive !== undefined) {
    nodeConstraint.maxexclusive = shape.maxExclusive;
  }
  
  return Result.ok(nodeConstraint);
};

/**
 * Convert SHACL node kind to ShEx node kind
 */
const convertNodeKind = (
  nodeKind: SHACL.NodeKind
): Result<"iri" | "bnode" | "nonliteral" | "literal", ConversionError> => {
  
  const mapping: Record<SHACL.NodeKind, "iri" | "bnode" | "nonliteral" | "literal"> = {
    [SHACL.NodeKind.IRI]: "iri",
    [SHACL.NodeKind.BlankNode]: "bnode",
    [SHACL.NodeKind.Literal]: "literal",
    [SHACL.NodeKind.BlankNodeOrIRI]: "nonliteral",
    [SHACL.NodeKind.BlankNodeOrLiteral]: "literal", // Approximation
    [SHACL.NodeKind.IRIOrLiteral]: "literal" // Approximation
  };
  
  const shexNodeKind = mapping[nodeKind];
  
  if (!shexNodeKind) {
    return Result.error({
      type: 'UnsupportedConstruct',
      construct: nodeKind,
      details: 'Unknown SHACL node kind'
    });
  }
  
  return Result.ok(shexNodeKind);
};

/**
 * Convert SHACL value to ShEx value
 */
const convertValueToShEx = (value: SHACL.RDFTerm): ShEx.ObjectValue => {
  if (typeof value === 'string') {
    return value; // IRI
  }
  
  if (typeof value === 'number') {
    return {
      value: value.toString(),
      datatype: 'http://www.w3.org/2001/XMLSchema#decimal'
    };
  }
  
  if (typeof value === 'boolean') {
    return {
      value: value.toString(),
      datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
    };
  }
  
  // Default to string literal
  return {
    value: String(value),
    datatype: 'http://www.w3.org/2001/XMLSchema#string'
  };
};

/**
 * Convert to ShEx Shape with triple expressions
 */
const convertToShape = (
  nodeShape: SHACL.NodeShape,
  context: ConversionContext
): Result<ShEx.Shape, ConversionError> => {
  
  const shape: ShEx.Shape = {
    type: "Shape"
  };
  
  // Handle closed shapes
  if (nodeShape.closed) {
    shape.closed = true;
    if (nodeShape.ignoredProperties && nodeShape.ignoredProperties.length > 0) {
      shape.extra = nodeShape.ignoredProperties;
    }
  }
  
  // Convert property shapes to triple expressions
  if (nodeShape.property && nodeShape.property.length > 0) {
    const tripleExprResults = nodeShape.property.map(prop => 
      convertPropertyShapeToTripleExpr(prop, context)
    );
    
    const errors = tripleExprResults.filter(Result.isError);
    if (errors.length > 0) {
      return errors[0];
    }
    
    const tripleExprs = tripleExprResults
      .filter(Result.isOk)
      .map(r => r.value);
    
    if (tripleExprs.length === 1) {
      shape.expression = tripleExprs[0];
    } else if (tripleExprs.length > 1) {
      shape.expression = {
        type: "EachOf",
        expressions: tripleExprs
      };
    }
  }
  
  return Result.ok(shape);
};

/**
 * Convert SHACL PropertyShape to ShEx TripleConstraint
 */
const convertPropertyShapeToTripleExpr = (
  propShape: SHACL.PropertyShape,
  context: ConversionContext
): Result<ShEx.TripleConstraint, ConversionError> => {
  
  // Extract predicate from path
  const predicateResult = extractPredicateFromPath(propShape.path);
  if (Result.isError(predicateResult)) {
    return predicateResult;
  }
  
  const tripleConstraint: ShEx.TripleConstraint = {
    type: "TripleConstraint",
    predicate: predicateResult.value
  };
  
  // Set cardinality
  if (propShape.minCount !== undefined) {
    tripleConstraint.min = propShape.minCount;
  }
  
  if (propShape.maxCount !== undefined) {
    tripleConstraint.max = propShape.maxCount;
  }
  
  // Convert value constraints
  const hasValueConstraints = 
    propShape.datatype || propShape.nodeKind || propShape.in || 
    propShape.pattern || propShape.minLength || propShape.maxLength ||
    propShape.minInclusive || propShape.maxInclusive ||
    propShape.minExclusive || propShape.maxExclusive ||
    propShape.node || propShape.hasValue || propShape.languageIn;
  
  if (hasValueConstraints) {
    const valueExprResult = convertPropertyValueConstraints(propShape, context);
    if (Result.isOk(valueExprResult)) {
      tripleConstraint.valueExpr = valueExprResult.value;
    }
  }
  
  // Handle sh:uniqueLang
  if (propShape.uniqueLang) {
    const uniqueLangResult = convertUniqueLang(propShape.uniqueLang, tripleConstraint, context);
    if (Result.isOk(uniqueLangResult)) {
      return uniqueLangResult;
    }
  }
  
  // Handle property pair constraints
  if (propShape.equals && propShape.equals.length > 0) {
    const semActResult = convertPropertyPairConstraint('equals', propShape.equals, context);
    if (Result.isOk(semActResult)) {
      tripleConstraint.semActs = tripleConstraint.semActs || [];
      tripleConstraint.semActs.push(semActResult.value);
    }
  }
  
  if (propShape.disjoint && propShape.disjoint.length > 0) {
    const semActResult = convertPropertyPairConstraint('disjoint', propShape.disjoint, context);
    if (Result.isOk(semActResult)) {
      tripleConstraint.semActs = tripleConstraint.semActs || [];
      tripleConstraint.semActs.push(semActResult.value);
    }
  }
  
  if (propShape.lessThan && propShape.lessThan.length > 0) {
    const semActResult = convertPropertyPairConstraint('lessThan', propShape.lessThan, context);
    if (Result.isOk(semActResult)) {
      tripleConstraint.semActs = tripleConstraint.semActs || [];
      tripleConstraint.semActs.push(semActResult.value);
    }
  }
  
  if (propShape.lessThanOrEquals && propShape.lessThanOrEquals.length > 0) {
    const semActResult = convertPropertyPairConstraint('lessThanOrEquals', propShape.lessThanOrEquals, context);
    if (Result.isOk(semActResult)) {
      tripleConstraint.semActs = tripleConstraint.semActs || [];
      tripleConstraint.semActs.push(semActResult.value);
    }
  }
  
  return Result.ok(tripleConstraint);
};

/**
 * Extract predicate IRI from property path
 */
const extractPredicateFromPath = (
  path: SHACL.PropertyPath
): Result<string, ConversionError> => {
  
  if (SHACL.isPredicatePath(path)) {
    return Result.ok(path);
  }
  
  // Complex paths not fully supported yet
  return Result.error({
    type: 'UnsupportedConstruct',
    construct: 'ComplexPropertyPath',
    details: 'Only predicate paths are currently supported'
  });
};

/**
 * Convert property value constraints to ShEx shape expression
 */
const convertPropertyValueConstraints = (
  propShape: SHACL.PropertyShape,
  context: ConversionContext
): Result<ShEx.shapeExpr, ConversionError> => {
  
  // If sh:node is specified, create a shape reference
  if (propShape.node && propShape.node.length > 0) {
    return Result.ok<ShEx.ShapeRef>({
      type: "ShapeRef",
      reference: propShape.node[0]
    });
  }
  
  // Otherwise, create a node constraint
  return convertToNodeConstraint(propShape, context);
};

/**
 * Convert standalone PropertyShape to ShapeDecl
 */
const convertPropertyShapeToShapeDecl = (
  propShape: SHACL.PropertyShape,
  shapeId: string,
  context: ConversionContext
): Result<ShEx.ShapeDecl, ConversionError> => {
  
  const tripleExprResult = convertPropertyShapeToTripleExpr(propShape, context);
  
  return Result.map(tripleExprResult, tripleExpr => ({
    id: shapeId,
    shapeExpr: {
      type: "Shape",
      expression: tripleExpr
    } as ShEx.Shape
  }));
};

/**
 * Generate shape ID if not provided
 */
const generateShapeId = (shape: SHACL.Shape): string => {
  if (shape.targetClass && shape.targetClass.length > 0) {
    return shape.targetClass[0] + "Shape";
  }
  
  return "_:shape" + Math.random().toString(36).substr(2, 9);
};

/**
 * Export converter function with additional options
 */
export interface ConversionOptions {
  generateComments?: boolean;
  preserveOriginalIds?: boolean;
  strictMode?: boolean;
}

export const convert = (
  input: string | SHACL.ShapesGraph,
  options: ConversionOptions = {}
): Result<ShEx.Schema, ConversionError> => {
  
  try {
    const shapesGraph = typeof input === 'string' 
      ? JSON.parse(input) as SHACL.ShapesGraph
      : input;
    
    return convertShaclToShex(shapesGraph);
  } catch (error) {
    return Result.error({
      type: 'InvalidInput',
      message: error instanceof Error ? error.message : 'Invalid input'
    });
  }
};