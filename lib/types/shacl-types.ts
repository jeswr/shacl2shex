/**
 * Type definitions for SHACL (Shapes Constraint Language)
 * Based on SHACL 1.1 Specification: https://www.w3.org/TR/shacl/
 */

export type IRI = string;
export type BlankNode = string;
export type Literal = string | number | boolean;
export type RDFTerm = IRI | BlankNode | Literal;

/**
 * SHACL Node Kinds
 * Spec: https://www.w3.org/TR/shacl/#NodeKindConstraintComponent
 */
export enum NodeKind {
  IRI = "sh:IRI",
  BlankNode = "sh:BlankNode",
  Literal = "sh:Literal",
  BlankNodeOrIRI = "sh:BlankNodeOrIRI",
  BlankNodeOrLiteral = "sh:BlankNodeOrLiteral",
  IRIOrLiteral = "sh:IRIOrLiteral"
}

/**
 * SHACL Severity Levels
 * Spec: https://www.w3.org/TR/shacl/#severity
 */
export enum Severity {
  Info = "sh:Info",
  Warning = "sh:Warning",
  Violation = "sh:Violation"
}

/**
 * Base Shape interface
 */
export interface Shape {
  id?: IRI;
  targetClass?: IRI[];
  targetNode?: RDFTerm[];
  targetObjectsOf?: IRI[];
  targetSubjectsOf?: IRI[];
  severity?: Severity;
  message?: Literal[];
  deactivated?: boolean;
}

/**
 * Node Shape
 * Spec: https://www.w3.org/TR/shacl/#node-shapes
 */
export interface NodeShape extends Shape {
  type: "sh:NodeShape";
  property?: PropertyShape[];
  
  // Node constraints
  nodeKind?: NodeKind;
  datatype?: IRI;
  class?: IRI[];
  
  // Value constraints
  in?: RDFTerm[];
  hasValue?: RDFTerm[];
  
  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  flags?: string;
  languageIn?: string[];
  uniqueLang?: boolean;
  
  // Numeric constraints
  minInclusive?: number | string;
  maxInclusive?: number | string;
  minExclusive?: number | string;
  maxExclusive?: number | string;
  
  // Logical constraints
  not?: NodeShape[];
  and?: NodeShape[];
  or?: NodeShape[];
  xone?: NodeShape[];
  
  // Shape-based constraints
  node?: IRI[];
  qualifiedValueShape?: NodeShape;
  qualifiedMinCount?: number;
  qualifiedMaxCount?: number;
  qualifiedValueShapesDisjoint?: boolean;
  
  // Other constraints
  closed?: boolean;
  ignoredProperties?: IRI[];
  equals?: IRI[];
  disjoint?: IRI[];
  lessThan?: IRI[];
  lessThanOrEquals?: IRI[];
  
  // SPARQL constraints
  sparql?: SPARQLConstraint[];
}

/**
 * Property Shape
 * Spec: https://www.w3.org/TR/shacl/#property-shapes
 */
export interface PropertyShape extends NodeShape {
  type: "sh:PropertyShape";
  path: PropertyPath;
  
  // Cardinality constraints
  minCount?: number;
  maxCount?: number;
  
  // Property pair constraints
  equals?: IRI[];
  disjoint?: IRI[];
  lessThan?: IRI[];
  lessThanOrEquals?: IRI[];
  
  // Additional property-specific constraints
  name?: Literal[];
  description?: Literal[];
  order?: number;
  group?: IRI;
  defaultValue?: RDFTerm;
}

/**
 * Property Path
 * Spec: https://www.w3.org/TR/shacl/#property-paths
 */
export type PropertyPath = 
  | IRI // Predicate path
  | SequencePath
  | AlternativePath
  | InversePath
  | ZeroOrMorePath
  | OneOrMorePath
  | ZeroOrOnePath;

export interface SequencePath {
  type: "SequencePath";
  paths: PropertyPath[];
}

export interface AlternativePath {
  type: "AlternativePath";
  paths: PropertyPath[];
}

export interface InversePath {
  type: "InversePath";
  path: PropertyPath;
}

export interface ZeroOrMorePath {
  type: "ZeroOrMorePath";
  path: PropertyPath;
}

export interface OneOrMorePath {
  type: "OneOrMorePath";
  path: PropertyPath;
}

export interface ZeroOrOnePath {
  type: "ZeroOrOnePath";
  path: PropertyPath;
}

/**
 * SPARQL Constraint
 * Spec: https://www.w3.org/TR/shacl/#sparql-constraints
 */
export interface SPARQLConstraint {
  select?: string;
  ask?: string;
  message?: Literal[];
  prefixes?: PrefixDeclaration[];
}

/**
 * Prefix Declaration
 */
export interface PrefixDeclaration {
  prefix: string;
  namespace: IRI;
}

/**
 * SHACL Shapes Graph
 */
export interface ShapesGraph {
  prefixes?: PrefixDeclaration[];
  imports?: IRI[];
  shapes: (NodeShape | PropertyShape)[];
}

/**
 * Type guards
 */
export const isNodeShape = (shape: Shape): shape is NodeShape => 
  (shape as any).type === "sh:NodeShape" || !(shape as any).path;

export const isPropertyShape = (shape: Shape): shape is PropertyShape =>
  (shape as any).type === "sh:PropertyShape" || !!(shape as any).path;

export const isPredicatePath = (path: PropertyPath): path is IRI =>
  typeof path === "string";

export const isSequencePath = (path: PropertyPath): path is SequencePath =>
  (path as any).type === "SequencePath";

export const isAlternativePath = (path: PropertyPath): path is AlternativePath =>
  (path as any).type === "AlternativePath";

export const isInversePath = (path: PropertyPath): path is InversePath =>
  (path as any).type === "InversePath";

export const isZeroOrMorePath = (path: PropertyPath): path is ZeroOrMorePath =>
  (path as any).type === "ZeroOrMorePath";

export const isOneOrMorePath = (path: PropertyPath): path is OneOrMorePath =>
  (path as any).type === "OneOrMorePath";

export const isZeroOrOnePath = (path: PropertyPath): path is ZeroOrOnePath =>
  (path as any).type === "ZeroOrOnePath";