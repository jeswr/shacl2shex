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
 * SHACL sequence, alternative, `sh:zeroOrMorePath` and `sh:zeroOrOnePath`
 * paths (and nested compositions) have no direct ShEx triple-constraint
 * equivalent and are treated as unsupported: the enclosing property shape is
 * skipped with a warning at emission time.
 */
export type PropertyPath =
  /** A plain predicate path. */
  | { kind: 'predicate'; predicate: string }
  /** `sh:inversePath` over a plain predicate. */
  | { kind: 'inverse'; predicate: string }
  /** `sh:oneOrMorePath` over a plain predicate. */
  | { kind: 'oneOrMore'; predicate: string };

/** A parsed SHACL property shape (the object of `sh:property`). */
export interface ShaclProperty {
  /** The RDF term identifying the property shape; kept for diagnostics. */
  term: Term;
  /** The parsed `sh:path`, or `undefined` when missing or unsupported. */
  path?: PropertyPath;
  /** `sh:nodeKind`, when exactly one recognised value is present. */
  nodeKind?: ShaclNodeKind;
  /** `sh:datatype` (first IRI value). */
  datatype?: string;
  /** `sh:class` IRIs. */
  classes: string[];
  /** `sh:node` shape references (raw term values). */
  nodeShapes: string[];
  /** The members of the `sh:in` list, when exactly one resolvable list is present. */
  inValues?: Term[];
  /** `sh:minCount`, when it is a parseable integer. */
  minCount?: number;
  /** `sh:maxCount`, when it is a parseable integer. */
  maxCount?: number;
}

/** A parsed SHACL node shape (an `sh:NodeShape` instance). */
export interface ShaclNodeShape {
  /** IRI or blank-node identifier of the node shape. */
  id: string;
  /** `sh:targetClass` IRIs. */
  targetClasses: string[];
  /** `sh:targetSubjectsOf` predicate IRIs. */
  targetSubjectsOf: string[];
  /** `sh:targetObjectsOf` predicate IRIs. */
  targetObjectsOf: string[];
  /** Shape-level `sh:nodeKind`, when exactly one recognised value is present. */
  nodeKind?: ShaclNodeKind;
  /** Shape-level `sh:class` IRIs (converted to an `rdf:type` constraint). */
  classes: string[];
  /** The shape's `sh:property` property shapes, in store order. */
  properties: ShaclProperty[];
}

/** All node shapes parsed from a SHACL document, in store order. */
export interface ShaclSchema {
  shapes: ShaclNodeShape[];
}
