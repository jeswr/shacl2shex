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
 * The property paths this converter understands.
 *
 * Paths that cannot be reduced to these forms are treated as unsupported: the
 * enclosing property shape is skipped with a warning at emission time.
 */
export type PropertyPath =
  /** A plain predicate path. */
  | { kind: 'predicate'; predicate: string }
  /** `sh:inversePath` over a plain predicate. */
  | { kind: 'inverse'; predicate: string }
  /** `sh:oneOrMorePath` over a plain predicate. */
  | { kind: 'oneOrMore'; predicate: string };

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
  /**
   * Names of constraint components present on the shape that ShEx cannot
   * express (`sh:equals`, `sh:disjoint`, `sh:lessThan`, `sh:lessThanOrEquals`,
   * `sh:uniqueLang`, `sh:sparql`). They are warned about and skipped; the
   * remaining constraints on the shape still convert.
   */
  unsupported: string[];
}

/** A parsed SHACL property shape (the object of `sh:property`). */
export interface ShaclProperty extends ShaclShapeBody {
  /** The parsed `sh:path`, or `undefined` when missing or unsupported. */
  path?: PropertyPath;
  /** `sh:minCount`, when it is a parseable integer. */
  minCount?: number;
  /** `sh:maxCount`, when it is a parseable integer. */
  maxCount?: number;
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
  /** The shape's `sh:property` property shapes, in store order. */
  properties: ShaclProperty[];
}

/** All node shapes parsed from a SHACL document, in store order. */
export interface ShaclSchema {
  shapes: ShaclNodeShape[];
}
