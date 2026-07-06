/**
 * IRIs of the RDF and SHACL terms used by the converter.
 *
 * These are kept as plain string constants (rather than pulling in a
 * vocabulary package) so that the runtime dependency footprint stays minimal.
 */

export const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const shacl = 'http://www.w3.org/ns/shacl#';

export const sh = {
  NodeShape: `${shacl}NodeShape`,
  and: `${shacl}and`,
  class: `${shacl}class`,
  datatype: `${shacl}datatype`,
  deactivated: `${shacl}deactivated`,
  disjoint: `${shacl}disjoint`,
  equals: `${shacl}equals`,
  flags: `${shacl}flags`,
  hasValue: `${shacl}hasValue`,
  in: `${shacl}in`,
  inversePath: `${shacl}inversePath`,
  languageIn: `${shacl}languageIn`,
  lessThan: `${shacl}lessThan`,
  lessThanOrEquals: `${shacl}lessThanOrEquals`,
  maxCount: `${shacl}maxCount`,
  maxExclusive: `${shacl}maxExclusive`,
  maxInclusive: `${shacl}maxInclusive`,
  maxLength: `${shacl}maxLength`,
  minCount: `${shacl}minCount`,
  minExclusive: `${shacl}minExclusive`,
  minInclusive: `${shacl}minInclusive`,
  minLength: `${shacl}minLength`,
  node: `${shacl}node`,
  nodeKind: `${shacl}nodeKind`,
  not: `${shacl}not`,
  oneOrMorePath: `${shacl}oneOrMorePath`,
  or: `${shacl}or`,
  path: `${shacl}path`,
  pattern: `${shacl}pattern`,
  property: `${shacl}property`,
  sparql: `${shacl}sparql`,
  targetClass: `${shacl}targetClass`,
  targetObjectsOf: `${shacl}targetObjectsOf`,
  targetSubjectsOf: `${shacl}targetSubjectsOf`,
  uniqueLang: `${shacl}uniqueLang`,
  xone: `${shacl}xone`,
  // Node kinds
  IRI: `${shacl}IRI`,
  Literal: `${shacl}Literal`,
  BlankNode: `${shacl}BlankNode`,
  BlankNodeOrIRI: `${shacl}BlankNodeOrIRI`,
  IRIOrLiteral: `${shacl}IRIOrLiteral`,
  BlankNodeOrLiteral: `${shacl}BlankNodeOrLiteral`,
} as const;
