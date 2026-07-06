/**
 * The intermediate model that sits between SHACL ingestion ({@link parseShaclSchema})
 * and ShEx emission ({@link shexSchemaFromShacl}).
 *
 * The model captures exactly the subset of SHACL that this package converts.
 * Everything in here is plain data: no RDF/JS store access, no validators and
 * no proxies, which keeps both sides of the pipeline easy to test in isolation.
 */
import type { Term } from '@rdfjs/types';

/** The six node kinds defined by SHACL (values of `sh:nodeKind`). */
export type ShaclNodeKind =
  | 'IRI'
  | 'Literal'
  | 'BlankNode'
  | 'BlankNodeOrIRI'
  | 'IRIOrLiteral'
  | 'BlankNodeOrLiteral';

/**
 * A parsed SHACL property path.
 *
 * Emission normalizes paths (inverses are pushed inwards, nested
 * sequences/alternatives are flattened) and converts the fragments that ShEx
 * can express; paths (or path/cardinality combinations) that cannot be
 * reduced are skipped with a warning.
 */
export type PropertyPath =
  /** A plain predicate path. */
  | { kind: 'predicate'; predicate: string }
  /** `sh:inversePath`. */
  | { kind: 'inverse'; path: PropertyPath }
  /** A sequence path (an RDF list of paths). */
  | { kind: 'sequence'; paths: PropertyPath[] }
  /** `sh:alternativePath` over an RDF list of paths. */
  | { kind: 'alternative'; paths: PropertyPath[] }
  /** `sh:zeroOrMorePath`. */
  | { kind: 'zeroOrMore'; path: PropertyPath }
  /** `sh:oneOrMorePath`. */
  | { kind: 'oneOrMore'; path: PropertyPath }
  /** `sh:zeroOrOnePath`. */
  | { kind: 'zeroOrOne'; path: PropertyPath };

/**
 * Constraint parameters shared by node shapes, property shapes and the
 * operands of the logical constraint components.
 */
export interface ShaclShapeBody {
  /** The RDF term identifying the shape; kept for diagnostics. */
  term: Term;
  /** `sh:nodeKind`, when exactly one recognised value is present. */
  nodeKind?: ShaclNodeKind;
  /** `sh:datatype` (first IRI value; extra values are warned about). */
  datatype?: string;
  /** `sh:class` IRIs. */
  classes: string[];
  /** `sh:node` shape references (raw term values). */
  nodeShapes: string[];
  /** The members of the `sh:in` list, when exactly one resolvable list is present. */
  inValues?: Term[];
  /** `sh:hasValue` values (the component is repeatable). */
  hasValues: Term[];
  /** `sh:pattern` (first literal value). */
  pattern?: string;
  /** `sh:flags` (first literal value). */
  flags?: string;
  /** `sh:minLength`, when it is a parseable integer. */
  minLength?: number;
  /** `sh:maxLength`, when it is a parseable integer. */
  maxLength?: number;
  /** `sh:minInclusive` operand (kept as a term so emission can check numericness). */
  minInclusive?: Term;
  /** `sh:minExclusive` operand. */
  minExclusive?: Term;
  /** `sh:maxInclusive` operand. */
  maxInclusive?: Term;
  /** `sh:maxExclusive` operand. */
  maxExclusive?: Term;
  /** The members of the first `sh:languageIn` list (BCP47 language tags). */
  languageIn?: string[];
  /** The operand lists of each `sh:or` on the shape. */
  // eslint-disable-next-line no-use-before-define
  ors: ShaclProperty[][];
  /** The operand lists of each `sh:and` on the shape. */
  // eslint-disable-next-line no-use-before-define
  ands: ShaclProperty[][];
  /** The operand lists of each `sh:xone` on the shape. */
  // eslint-disable-next-line no-use-before-define
  xones: ShaclProperty[][];
  /** The operands of each `sh:not` on the shape. */
  // eslint-disable-next-line no-use-before-define
  nots: ShaclProperty[];
  /** The shape's `sh:property` property shapes, in store order. */
  // eslint-disable-next-line no-use-before-define
  properties: ShaclProperty[];
  /** Whether `sh:deactivated true` is asserted (the shape validates nothing). */
  deactivated?: boolean;
  /** Whether `sh:closed true` is asserted. */
  closed?: boolean;
  /** `sh:ignoredProperties` members (predicate IRIs allowed despite `sh:closed`). */
  ignoredProperties: string[];
  /**
   * Names of constraint components present on the shape that ShEx cannot
   * express (`sh:equals`, `sh:disjoint`, `sh:lessThan`, `sh:lessThanOrEquals`,
   * `sh:uniqueLang`, `sh:sparql`). They are warned about and skipped; the
   * remaining constraints on the shape still convert.
   */
  unsupported: string[];
}

/**
 * A parsed SHACL property shape (the object of `sh:property`), and also the
 * shape type used for the operands of the logical components (which may be
 * property shapes — `path` set — or nested node shapes — `path` absent).
 */
export interface ShaclProperty extends ShaclShapeBody {
  /** The parsed `sh:path`, or `undefined` when missing or unsupported. */
  path?: PropertyPath;
  /** `sh:minCount`, when it is a parseable integer. */
  minCount?: number;
  /** `sh:maxCount`, when it is a parseable integer. */
  maxCount?: number;
  /**
   * `sh:qualifiedValueShape`: a string when it references a declared node
   * shape, otherwise the inline shape.
   */
  qualifiedValueShape?: ShaclProperty | string;
  /** `sh:qualifiedMinCount`, when it is a parseable integer. */
  qualifiedMinCount?: number;
  /** `sh:qualifiedMaxCount`, when it is a parseable integer. */
  qualifiedMaxCount?: number;
  /** Whether `sh:qualifiedValueShapesDisjoint true` is asserted. */
  qualifiedValueShapesDisjoint?: boolean;
}

/** A parsed SHACL node shape (an `sh:NodeShape` instance). */
export interface ShaclNodeShape extends ShaclShapeBody {
  /** IRI or blank-node identifier of the node shape. */
  id: string;
  /** `sh:targetClass` IRIs. */
  targetClasses: string[];
  /** `sh:targetSubjectsOf` predicate IRIs. */
  targetSubjectsOf: string[];
  /** `sh:targetObjectsOf` predicate IRIs. */
  targetObjectsOf: string[];
}

/** All node shapes parsed from a SHACL document, in store order. */
export interface ShaclSchema {
  shapes: ShaclNodeShape[];
}
