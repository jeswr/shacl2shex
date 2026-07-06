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
  class: `${shacl}class`,
  datatype: `${shacl}datatype`,
  in: `${shacl}in`,
  inversePath: `${shacl}inversePath`,
  maxCount: `${shacl}maxCount`,
  minCount: `${shacl}minCount`,
  node: `${shacl}node`,
  nodeKind: `${shacl}nodeKind`,
  oneOrMorePath: `${shacl}oneOrMorePath`,
  path: `${shacl}path`,
  property: `${shacl}property`,
  targetClass: `${shacl}targetClass`,
  targetObjectsOf: `${shacl}targetObjectsOf`,
  targetSubjectsOf: `${shacl}targetSubjectsOf`,
  // Node kinds
  IRI: `${shacl}IRI`,
  Literal: `${shacl}Literal`,
  BlankNode: `${shacl}BlankNode`,
  BlankNodeOrIRI: `${shacl}BlankNodeOrIRI`,
  IRIOrLiteral: `${shacl}IRIOrLiteral`,
  BlankNodeOrLiteral: `${shacl}BlankNodeOrLiteral`,
} as const;
