/* eslint-disable no-console, no-continue, no-inner-declarations */
import { DatasetCore, Term, NamedNode } from '@rdfjs/types';
import Writer from '@shexjs/writer';
import { DataFactory, Store } from 'n3';
import { rdf } from 'rdf-namespaces';
import { TripleConstraint, shapeExprOrRef } from 'shexj';
import { ShapeShapeShapeType } from './ldo/Shacl.shapeTypes';
import { shapeFromDataset } from './shapeFromDataset';

const { namedNode, defaultGraph } = DataFactory;

function getSingleObjectOfType(
  store: DatasetCore,
  subject: Term,
  predicate: Term,
): NamedNode | undefined {
  const objects = [...store.match(subject, predicate, null, defaultGraph())];
  if (objects.length !== 1) {
    console.warn('Expected exactly one object', objects);
    return undefined;
  }
  if (objects[0].object.termType !== 'NamedNode') {
    console.warn('Expected object to be a NamedNode', objects[0]);
    return undefined;
  }
  return objects[0].object;
}

export async function shaclStoreToShexSchema(shapeStore: Store) {
  const shexShapes = [];
  for (const { subject: shape } of shapeStore.match(null, namedNode(rdf.type), namedNode('http://www.w3.org/ns/shacl#NodeShape'), defaultGraph())) {
    const eachOf = [];
    for (const property of shapeStore.getObjects(shape, namedNode('http://www.w3.org/ns/shacl#property'), defaultGraph())) {
      if (property.termType !== 'NamedNode' && property.termType !== 'BlankNode') {
        console.warn('Unsupported property', property);
        continue;
      }
      const shapeData = shapeFromDataset(ShapeShapeShapeType, shapeStore, property);
      const inValues = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#in'), defaultGraph());
      const shapeRef = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#node'), defaultGraph());
      const path = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#path'), defaultGraph());

      let valueExpr: shapeExprOrRef = {
        type: 'NodeConstraint',
      };

      if (shapeData.nodeKind) {
        valueExpr.nodeKind = ({
          IRI: 'iri',
          Literal: 'literal',
          BlankNode: 'bnode',
          BlankNodeOrIRI: 'nonliteral',
          IRIOrLiteral: undefined,
          BlankNodeOrLiteral: undefined,
        } as const)[shapeData.nodeKind['@id']];
      }
      if (inValues.length === 1) {
        const list = shapeStore.extractLists()[inValues[0].value];
        if (list) {
          const [firstTerm] = list;

          // TODO: Make this just the else case once https://github.com/o-development/ldo/issues/31 is resolved
          if (firstTerm && firstTerm.termType === 'Literal' && list.every((v) => v.termType === 'Literal' && v.datatype.equals(firstTerm.datatype))) {
            valueExpr.datatype = firstTerm.datatype.value;
          } else {
            valueExpr.values = list.map((v) => (v.termType === 'Literal' ? {
              value: v.value,
              type: v.datatype.value,
            } : v.value));
          }
        }
      }

      if (shapeData.datatype) {
        valueExpr.datatype = shapeData.datatype['@id'];
      } else if (shapeRef.length === 1) {
        // TODO: Error if there are any other constraints
        valueExpr = shapeRef[0].value;
      } else if (valueExpr.nodeKind || valueExpr.values) {
        // Noop
      } else {
        console.warn('Unsupported property', property);
        continue;
      }

      function toTripleConstraint(pathElem: Term): TripleConstraint {
        if (pathElem.termType === 'NamedNode') {
          return {
            type: 'TripleConstraint',
            predicate: pathElem.value,
            valueExpr,
            // FIXME: Int checks etc should be done here
            min: shapeData.minCount ?? 0,
            max: shapeData.maxCount ?? -1,
          };
        }
        const inversePath = getSingleObjectOfType(shapeStore, pathElem, namedNode('http://www.w3.org/ns/shacl#inversePath'));
        if (inversePath) {
          return {
            type: 'TripleConstraint',
            predicate: pathElem.value,
            valueExpr,
            inverse: true,
            // FIXME: Int checks etc should be done here
            min: shapeData.minCount ?? 0,
            max: shapeData.maxCount ?? -1,
          };
        }
        const oneOrMorePath = getSingleObjectOfType(shapeStore, pathElem, namedNode('http://www.w3.org/ns/shacl#oneOrMorePath'));
        if (oneOrMorePath) {
          return {
            type: 'TripleConstraint',
            predicate: pathElem.value,
            valueExpr: {
              type: 'ShapeOr',
              shapeExprs: [{
                type: 'Shape',
                expression: toTripleConstraint(oneOrMorePath),
              }, valueExpr],
            },
            min: shapeData.minCount ?? 0,
            max: shapeData.maxCount ?? -1,
          };
        }

        console.log(
          shape,
          getSingleObjectOfType(shapeStore, pathElem, namedNode('http://www.w3.org/ns/shacl#alternativePath')),
          getSingleObjectOfType(shapeStore, pathElem, namedNode('http://www.w3.org/ns/shacl#zeroOrMorePath')),
          getSingleObjectOfType(shapeStore, pathElem, namedNode('http://www.w3.org/ns/shacl#oneOrMorePath')),
          getSingleObjectOfType(shapeStore, pathElem, namedNode('http://www.w3.org/ns/shacl#zeroOrOnePath')),
          getSingleObjectOfType(shapeStore, pathElem, namedNode('http://www.w3.org/ns/shacl#inversePath')),
          shapeStore.extractLists()[pathElem.value],
        );

        throw new Error('Unsupported path');
      }
      try {
        eachOf.push(toTripleConstraint(path[0]));
      } catch (e) {
        console.warn('Error processing property', property, e);
      }
    }

    if (eachOf.length === 0) {
      console.warn('No properties found in shape', shape);
      continue;
    }

    shexShapes.push({
      id: shape.value,
      type: 'ShapeDecl',
      shapeExpr: {
        type: 'Shape',
        expression: {
          type: 'EachOf',
          expressions: eachOf,
        },
      },
    });
  }

  const filteredShapes = [];

  const shapes = new Set(shexShapes.map((s) => s.id));

  // TODO: Apply this recursively
  // TODO: Add warnings
  for (const shape of shexShapes) {
    shape.shapeExpr.expression.expressions = shape.shapeExpr.expression.expressions.filter((eachOf) => typeof eachOf.valueExpr !== 'string' || shapes.has(eachOf.valueExpr));

    if (shape.shapeExpr.expression.expressions.length > 0) {
      filteredShapes.push(shape);
    }
  }

  return {
    type: 'Schema',
    shapes: filteredShapes,
  };
}

export function writeShexSchema(schema: any, prefixes?: Record<string, string>) {
  const shexWriter = new Writer({ prefixes }, {});
  return new Promise<string>((resolve, reject) => {
    shexWriter.writeSchema(
      schema,
      (error: any, text: string) => {
        if (error) reject(error);
        else if (text !== undefined) resolve(text);
      },
    );
  });
}
