import { DatasetCore, Term } from '@rdfjs/types';
import { rdf } from "rdf-namespaces";
import { DataFactory, Store } from 'n3';
import { ShapeShapeShapeType } from "./ldo/Shacl.shapeTypes";
import Writer from "@shexjs/writer";
import { shapeFromDataset, shapeMatches } from './shapeFromDataset';
const { namedNode, defaultGraph } = DataFactory;

function getSingleObjectOfType(store: DatasetCore, subject: Term, predicate: Term) {
    const objects = [...store.match(subject, predicate, null, defaultGraph())];
    if (objects.length !== 1) {
        console.warn('Expected exactly one object', objects);
        return;
    }
    if (objects[0].object.termType !== 'NamedNode') {
        console.warn('Expected object to be a NamedNode', objects[0]);
        return;
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
            const shape = shapeFromDataset(ShapeShapeShapeType, shapeStore, property);
            const inValues = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#in'), defaultGraph());
            const shapeRef = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#node'), defaultGraph());

            const path = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#path'), defaultGraph());

            if (path.length !== 1 || path[0].termType !== 'NamedNode') {
                console.warn('Unsupported path', path);
                continue;
            }

            let valueExpr: string | Record<string, string | string[]> = {
              "type": "NodeConstraint",
            }

            if (shape.nodeKind) {
              const val = {
                'IRI': 'iri',
                'Literal': 'literal',
                'BlankNode': 'bnode',
                'BlankNodeOrIRI': 'nonliteral',
              }[shape.nodeKind['@id'].replace('http://www.w3.org/ns/shacl#', '')];

              if (val) {
                valueExpr.nodeKind = val;
              }
            }
            if (inValues.length === 1) {
              const list = shapeStore.extractLists()[inValues[0].value];
              if (list) {
                // FIXME, make this work for literals
                // if (list.every(v => v.termType === 'NamedNode'))
                //   valueExpr.values = list.map(v => v.value);

                if (list.every(v => v.termType === 'Literal')) {
                  valueExpr.nodeKind = 'literal';
                } else if (list.every(v => v.termType === 'NamedNode')) {
                  valueExpr.nodeKind = 'iri';
                } else if (list.every(v => v.termType === 'BlankNode')) {
                  valueExpr.nodeKind = 'bnode';
                } else if (list.every(v => v.termType !== 'Literal')) {
                  valueExpr.nodeKind = 'nonliteral';
                }
              }
            }

            if (shape.datatype) {
                valueExpr.datatype = shape.datatype['@id'];
            } else if (shapeRef.length === 1) {
                // TODO: Error if there are any other constraints
                valueExpr = shapeRef[0].value;
            } else if (valueExpr.nodeKind) {

            }  else {
                console.warn('Unsupported property', property);
                continue;
            }

            eachOf.push({
              "type": "TripleConstraint",
              "predicate": path[0].value,
              "valueExpr": valueExpr,
              // FIXME: Int checks etc should be done here
              "min": shape.minCount ?? 0,
              "max": shape.maxCount ?? -1
            })
        }

        if (eachOf.length === 0) {
            console.warn('No properties found in shape', shape);
            continue;
        }

        shexShapes.push({
          "id": shape.value,
          "type": "ShapeDecl",
          "shapeExpr": {
            "type": "Shape",
            "expression": {
              "type": "EachOf",
              "expressions": eachOf
            }
          }
        })
    }

    const filteredShapes = [];

    const shapes = new Set(shexShapes.map(s => s.id));

    // TODO: Apply this recursively
    // TODO: Add warnings
    for (const shape of shexShapes) {
        shape.shapeExpr.expression.expressions = shape.shapeExpr.expression.expressions.filter(eachOf => typeof eachOf.valueExpr !== 'string' || shapes.has(eachOf.valueExpr))

        if (shape.shapeExpr.expression.expressions.length > 0) {
            filteredShapes.push(shape);
        }
    }

    return {
      "type": "Schema",
      "shapes": filteredShapes
    }
}

export function writeShexSchema(schema: any, prefixes?: Record<string, string>) {
    const shexWriter = new Writer({ prefixes }, {});
    return new Promise<string>((resolve, reject) => {
        shexWriter.writeSchema(
            schema,
            (error: any, text: string) => {
                if (error)
                    reject(error);
                else if (text !== undefined)
                  resolve(text);
            }
        )
    });
}
