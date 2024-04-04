import { ContextDefinition } from 'jsonld';

/**
 * =============================================================================
 * ShaclContext: JSONLD Context for Shacl
 * =============================================================================
 */
export const ShaclContext: ContextDefinition = {
  targetClass: {
    '@id': 'http://www.w3.org/ns/shacl#targetClass',
    '@type': '@id',
    '@container': '@set',
  },
  targetSubjectsOf: {
    '@id': 'http://www.w3.org/ns/shacl#targetSubjectsOf',
    '@type': '@id',
    '@container': '@set',
  },
  targetObjectsOf: {
    '@id': 'http://www.w3.org/ns/shacl#targetObjectsOf',
    '@type': '@id',
    '@container': '@set',
  },
  severity: {
    '@id': 'http://www.w3.org/ns/shacl#severity',
    '@type': '@id',
  },
  class: {
    '@id': 'http://www.w3.org/ns/shacl#class',
    '@type': '@id',
    '@container': '@set',
  },
  closed: {
    '@id': 'http://www.w3.org/ns/shacl#closed',
    '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
  },
  datatype: {
    '@id': 'http://www.w3.org/ns/shacl#datatype',
    '@type': '@id',
  },
  disjoint: {
    '@id': 'http://www.w3.org/ns/shacl#disjoint',
    '@type': '@id',
    '@container': '@set',
  },
  equals: {
    '@id': 'http://www.w3.org/ns/shacl#equals',
    '@type': '@id',
    '@container': '@set',
  },
  lessThan: {
    '@id': 'http://www.w3.org/ns/shacl#lessThan',
    '@type': '@id',
    '@container': '@set',
  },
  lessThanOrEquals: {
    '@id': 'http://www.w3.org/ns/shacl#lessThanOrEquals',
    '@type': '@id',
    '@container': '@set',
  },
  maxCount: {
    '@id': 'http://www.w3.org/ns/shacl#maxCount',
    '@type': 'http://www.w3.org/2001/XMLSchema#integer',
  },
  maxExclusive: {
    '@id': 'http://www.w3.org/ns/shacl#maxExclusive',
  },
  maxInclusive: {
    '@id': 'http://www.w3.org/ns/shacl#maxInclusive',
  },
  maxLength: {
    '@id': 'http://www.w3.org/ns/shacl#maxLength',
    '@type': 'http://www.w3.org/2001/XMLSchema#integer',
  },
  minCount: {
    '@id': 'http://www.w3.org/ns/shacl#minCount',
    '@type': 'http://www.w3.org/2001/XMLSchema#integer',
  },
  minExclusive: {
    '@id': 'http://www.w3.org/ns/shacl#minExclusive',
  },
  minInclusive: {
    '@id': 'http://www.w3.org/ns/shacl#minInclusive',
  },
  minLength: {
    '@id': 'http://www.w3.org/ns/shacl#minLength',
    '@type': 'http://www.w3.org/2001/XMLSchema#integer',
  },
  nodeKind: {
    '@id': 'http://www.w3.org/ns/shacl#nodeKind',
  },
  BlankNode: 'http://www.w3.org/ns/shacl#BlankNode',
  IRI: 'http://www.w3.org/ns/shacl#IRI',
  Literal: 'http://www.w3.org/ns/shacl#Literal',
  BlankNodeOrIRI: 'http://www.w3.org/ns/shacl#BlankNodeOrIRI',
  BlankNodeOrLiteral: 'http://www.w3.org/ns/shacl#BlankNodeOrLiteral',
  IRIOrLiteral: 'http://www.w3.org/ns/shacl#IRIOrLiteral',
  pattern: {
    '@id': 'http://www.w3.org/ns/shacl#pattern',
    '@type': 'http://www.w3.org/2001/XMLSchema#string',
  },
  flags: {
    '@id': 'http://www.w3.org/ns/shacl#flags',
    '@type': 'http://www.w3.org/2001/XMLSchema#string',
  },
  qualifiedMaxCount: {
    '@id': 'http://www.w3.org/ns/shacl#qualifiedMaxCount',
    '@type': 'http://www.w3.org/2001/XMLSchema#integer',
  },
  qualifiedMinCount: {
    '@id': 'http://www.w3.org/ns/shacl#qualifiedMinCount',
    '@type': 'http://www.w3.org/2001/XMLSchema#integer',
  },
  qualifiedValueShapesDisjoint: {
    '@id': 'http://www.w3.org/ns/shacl#qualifiedValueShapesDisjoint',
    '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
  },
  uniqueLang: {
    '@id': 'http://www.w3.org/ns/shacl#uniqueLang',
    '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
  },
};
