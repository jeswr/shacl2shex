export const ShaclContext = {
  targetClass: {
    '@id': 'http://www.w3.org/ns/shacl#targetClass',
    '@type': '@id',
  },
  targetSubjectsOf: {
    '@id': 'http://www.w3.org/ns/shacl#targetSubjectsOf',
    '@type': '@id',
  },
  targetObjectsOf: {
    '@id': 'http://www.w3.org/ns/shacl#targetObjectsOf',
    '@type': '@id',
  },
  severity: {
    '@id': 'http://www.w3.org/ns/shacl#severity',
    '@type': '@id',
  },
  class: {
    '@id': 'http://www.w3.org/ns/shacl#class',
    '@type': '@id',
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
  },
  equals: {
    '@id': 'http://www.w3.org/ns/shacl#equals',
    '@type': '@id',
  },
  lessThan: {
    '@id': 'http://www.w3.org/ns/shacl#lessThan',
    '@type': '@id',
  },
  lessThanOrEquals: {
    '@id': 'http://www.w3.org/ns/shacl#lessThanOrEquals',
    '@type': '@id',
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
    '@type': '@id',
  },
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
  path: {
    '@id': 'http://www.w3.org/ns/shacl#path',
    '@type': '@id',
  },
  property: {
    '@id': 'http://www.w3.org/ns/shacl#property',
    '@type': '@id',
  },
  name: {
    '@id': 'http://www.w3.org/ns/shacl#name',
  },
  description: {
    '@id': 'http://www.w3.org/ns/shacl#description',
  },
  defaultValue: {
    '@id': 'http://www.w3.org/ns/shacl#defaultValue',
  },
  group: {
    '@id': 'http://www.w3.org/ns/shacl#group',
    '@type': '@id',
  },
  order: {
    '@id': 'http://www.w3.org/ns/shacl#order',
  },
  qualifiedValueShape: {
    '@id': 'http://www.w3.org/ns/shacl#qualifiedValueShape',
    '@type': '@id',
  },
  hasValue: {
    '@id': 'http://www.w3.org/ns/shacl#hasValue',
  },
  in: {
    '@id': 'http://www.w3.org/ns/shacl#in',
    '@container': '@list',
  },
  languageIn: {
    '@id': 'http://www.w3.org/ns/shacl#languageIn',
    '@container': '@list',
  },
  node: {
    '@id': 'http://www.w3.org/ns/shacl#node',
    '@type': '@id',
  },
  ignoredProperties: {
    '@id': 'http://www.w3.org/ns/shacl#ignoredProperties',
    '@container': '@list',
  },
  and: {
    '@id': 'http://www.w3.org/ns/shacl#and',
    '@type': '@id',
    '@container': '@list',
  },
  or: {
    '@id': 'http://www.w3.org/ns/shacl#or',
    '@type': '@id',
    '@container': '@list',
  },
  not: {
    '@id': 'http://www.w3.org/ns/shacl#not',
    '@type': '@id',
  },
  xone: {
    '@id': 'http://www.w3.org/ns/shacl#xone',
    '@type': '@id',
    '@container': '@list',
  },
};