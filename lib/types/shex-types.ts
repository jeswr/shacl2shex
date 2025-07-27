/**
 * Type definitions for ShEx (Shape Expressions)
 * Based on ShEx 2.1 Specification: http://shex.io/shex-semantics/
 */

export type IRI = string;
export type BNODE = string;
export type ObjectValue = IRI | BNODE | Literal;

/**
 * Literal value with optional language or datatype
 */
export interface Literal {
  value: string;
  language?: string;
  datatype?: IRI;
}

/**
 * ShEx Schema
 * Spec: http://shex.io/shex-semantics/#schemas
 */
export interface Schema {
  type: "Schema";
  prefixes?: { [prefix: string]: IRI };
  imports?: IRI[];
  startActs?: SemAct[];
  start?: shapeExpr;
  shapes?: ShapeDecl[];
}

/**
 * Shape Declaration
 */
export interface ShapeDecl {
  id: IRI;
  abstract?: boolean;
  extends?: IRI[];
  restricts?: IRI[];
  shapeExpr: shapeExpr;
}

/**
 * Shape Expression
 * Spec: http://shex.io/shex-semantics/#shape-expressions
 */
export type shapeExpr = 
  | ShapeOr
  | ShapeAnd
  | ShapeNot
  | ShapeExternal
  | ShapeRef
  | NodeConstraint
  | Shape
  | shapeExprLabel;

export type shapeExprLabel = IRI | BNODE;

/**
 * Shape Or
 * Spec: http://shex.io/shex-semantics/#prod-shapeOr
 */
export interface ShapeOr {
  type: "ShapeOr";
  shapeExprs: shapeExpr[];
}

/**
 * Shape And
 * Spec: http://shex.io/shex-semantics/#prod-shapeAnd
 */
export interface ShapeAnd {
  type: "ShapeAnd";
  shapeExprs: shapeExpr[];
}

/**
 * Shape Not
 * Spec: http://shex.io/shex-semantics/#prod-shapeNot
 */
export interface ShapeNot {
  type: "ShapeNot";
  shapeExpr: shapeExpr;
}

/**
 * External Shape
 */
export interface ShapeExternal {
  type: "ShapeExternal";
}

/**
 * Shape Reference
 */
export interface ShapeRef {
  type: "ShapeRef";
  reference: IRI;
}

/**
 * Node Constraint
 * Spec: http://shex.io/shex-semantics/#node-constraints
 */
export interface NodeConstraint {
  type: "NodeConstraint";
  nodeKind?: "iri" | "bnode" | "nonliteral" | "literal";
  datatype?: IRI;
  values?: ValueSetValue[];
  pattern?: string;
  flags?: string;
  length?: number;
  minlength?: number;
  maxlength?: number;
  mininclusive?: number | string;
  maxinclusive?: number | string;
  minexclusive?: number | string;
  maxexclusive?: number | string;
  totaldigits?: number;
  fractiondigits?: number;
}

/**
 * Shape
 * Spec: http://shex.io/shex-semantics/#shapes
 */
export interface Shape {
  type: "Shape";
  closed?: boolean;
  extra?: IRI[];
  expression?: tripleExpr;
  semActs?: SemAct[];
  annotations?: Annotation[];
}

/**
 * Triple Expression
 * Spec: http://shex.io/shex-semantics/#triple-expressions
 */
export type tripleExpr =
  | EachOf
  | OneOf
  | TripleConstraint
  | tripleExprLabel;

export type tripleExprLabel = IRI | BNODE;

/**
 * Each Of (Conjunction)
 */
export interface EachOf {
  type: "EachOf";
  expressions: tripleExpr[];
  min?: number;
  max?: number | "unbounded";
  semActs?: SemAct[];
  annotations?: Annotation[];
}

/**
 * One Of (Disjunction)
 */
export interface OneOf {
  type: "OneOf";
  expressions: tripleExpr[];
  min?: number;
  max?: number | "unbounded";
  semActs?: SemAct[];
  annotations?: Annotation[];
}

/**
 * Triple Constraint
 * Spec: http://shex.io/shex-semantics/#triple-constraints
 */
export interface TripleConstraint {
  type: "TripleConstraint";
  predicate: IRI;
  inverse?: boolean;
  valueExpr?: shapeExpr;
  min?: number;
  max?: number | "unbounded";
  semActs?: SemAct[];
  annotations?: Annotation[];
}

/**
 * Value Set Value
 */
export type ValueSetValue = 
  | ObjectValue
  | IriStem
  | IriStemRange
  | LiteralStem
  | LiteralStemRange
  | Language
  | LanguageStem
  | LanguageStemRange;

/**
 * IRI Stem
 */
export interface IriStem {
  type: "IriStem";
  stem: IRI;
}

/**
 * IRI Stem Range
 */
export interface IriStemRange {
  type: "IriStemRange";
  stem: IRI | Wildcard;
  exclusions?: (IRI | IriStem)[];
}

/**
 * Literal Stem
 */
export interface LiteralStem {
  type: "LiteralStem";
  stem: string;
}

/**
 * Literal Stem Range
 */
export interface LiteralStemRange {
  type: "LiteralStemRange";
  stem: string | Wildcard;
  exclusions?: (Literal | LiteralStem)[];
}

/**
 * Language
 */
export interface Language {
  type: "Language";
  languageTag: string;
}

/**
 * Language Stem
 */
export interface LanguageStem {
  type: "LanguageStem";
  stem: string;
}

/**
 * Language Stem Range
 */
export interface LanguageStemRange {
  type: "LanguageStemRange";
  stem: string | Wildcard;
  exclusions?: (Language | LanguageStem)[];
}

/**
 * Wildcard
 */
export interface Wildcard {
  type: "Wildcard";
}

/**
 * Semantic Action
 */
export interface SemAct {
  name: IRI;
  code?: string;
}

/**
 * Annotation
 */
export interface Annotation {
  predicate: IRI;
  object: ObjectValue;
}

/**
 * Type guards
 */
export const isShapeOr = (expr: shapeExpr): expr is ShapeOr =>
  (expr as any).type === "ShapeOr";

export const isShapeAnd = (expr: shapeExpr): expr is ShapeAnd =>
  (expr as any).type === "ShapeAnd";

export const isShapeNot = (expr: shapeExpr): expr is ShapeNot =>
  (expr as any).type === "ShapeNot";

export const isShapeExternal = (expr: shapeExpr): expr is ShapeExternal =>
  (expr as any).type === "ShapeExternal";

export const isShapeRef = (expr: shapeExpr): expr is ShapeRef =>
  (expr as any).type === "ShapeRef";

export const isNodeConstraint = (expr: shapeExpr): expr is NodeConstraint =>
  (expr as any).type === "NodeConstraint";

export const isShape = (expr: shapeExpr): expr is Shape =>
  (expr as any).type === "Shape";

export const isEachOf = (expr: tripleExpr): expr is EachOf =>
  (expr as any).type === "EachOf";

export const isOneOf = (expr: tripleExpr): expr is OneOf =>
  (expr as any).type === "OneOf";

export const isTripleConstraint = (expr: tripleExpr): expr is TripleConstraint =>
  (expr as any).type === "TripleConstraint";

export const isLiteral = (value: any): value is Literal =>
  value && typeof value === "object" && "value" in value;

export const isIRI = (value: any): value is IRI =>
  typeof value === "string" && (value.startsWith("http") || value.includes(":"));

/**
 * Cardinality helpers
 */
export const getMinCardinality = (expr: TripleConstraint | EachOf | OneOf): number =>
  expr.min ?? 1;

export const getMaxCardinality = (expr: TripleConstraint | EachOf | OneOf): number | "unbounded" =>
  expr.max ?? 1;

export const isOptional = (expr: TripleConstraint | EachOf | OneOf): boolean =>
  getMinCardinality(expr) === 0;

export const isRepeatable = (expr: TripleConstraint | EachOf | OneOf): boolean =>
  getMaxCardinality(expr) === "unbounded" || getMaxCardinality(expr) > 1;