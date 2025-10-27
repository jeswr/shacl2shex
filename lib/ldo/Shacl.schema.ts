/**
 * =============================================================================
 * ShaclSchema: ShexJ Schema for Shacl
 * =============================================================================
 */
export const ShaclSchema = {
  type: 'Schema',
  shapes: [
    {
      id: 'http://www.w3.org/ns/shacl-shacl#ShapeShape',
      type: 'ShapeDecl',
      shapeExpr: {
        type: 'Shape',
        expression: {
          type: 'EachOf',
          expressions: [
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#targetClass',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#targetSubjectsOf',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#targetObjectsOf',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#severity',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#class',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#closed',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#boolean',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#datatype',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#disjoint',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#equals',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#lessThan',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#lessThanOrEquals',
              valueExpr: {
                type: 'NodeConstraint',
                nodeKind: 'iri',
              },
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#maxCount',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#integer',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#maxExclusive',
              valueExpr: {
                type: 'NodeConstraint',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#maxInclusive',
              valueExpr: {
                type: 'NodeConstraint',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#maxLength',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#integer',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#minCount',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#integer',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#minExclusive',
              valueExpr: {
                type: 'NodeConstraint',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#minInclusive',
              valueExpr: {
                type: 'NodeConstraint',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#minLength',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#integer',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#nodeKind',
              valueExpr: {
                type: 'NodeConstraint',
                values: [
                  'http://www.w3.org/ns/shacl#BlankNode',
                  'http://www.w3.org/ns/shacl#IRI',
                  'http://www.w3.org/ns/shacl#Literal',
                  'http://www.w3.org/ns/shacl#BlankNodeOrIRI',
                  'http://www.w3.org/ns/shacl#BlankNodeOrLiteral',
                  'http://www.w3.org/ns/shacl#IRIOrLiteral',
                ],
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#pattern',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#string',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#flags',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#string',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#qualifiedMaxCount',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#integer',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#qualifiedMinCount',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#integer',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#qualifiedValueShapesDisjoint',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#boolean',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#uniqueLang',
              valueExpr: {
                type: 'NodeConstraint',
                datatype: 'http://www.w3.org/2001/XMLSchema#boolean',
              },
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#and',
              valueExpr: 'http://www.w3.org/ns/shacl-shacl#ShapeShape',
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#or',
              valueExpr: 'http://www.w3.org/ns/shacl-shacl#ShapeShape',
              min: 0,
              max: -1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#not',
              valueExpr: 'http://www.w3.org/ns/shacl-shacl#ShapeShape',
              min: 0,
              max: 1,
            },
            {
              type: 'TripleConstraint',
              predicate: 'http://www.w3.org/ns/shacl#xone',
              valueExpr: 'http://www.w3.org/ns/shacl-shacl#ShapeShape',
              min: 0,
              max: -1,
            },
          ],
        },
      },
    },
  ],
};