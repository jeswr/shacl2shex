import { DatasetCore } from '@rdfjs/types';
import { rdf } from "rdf-namespaces";
import { DataFactory, Store } from 'n3';
import { ShapeShapeShapeType } from "./ldo/Shacl.shapeTypes";
import Writer from "@shexjs/writer";
import { shapeMatches } from './shapeFromDataset';
const { namedNode, defaultGraph } = DataFactory;

export async function shaclStoreToShexSchema(shapeStore: DatasetCore) {
    const shexShapes = [];
    for (const shape of shapeMatches(ShapeShapeShapeType, shapeStore)) {
        shape.
    }
    
    
    
    for (const shape of shapeStore.match(null, namedNode(rdf.type), namedNode('http://www.w3.org/ns/shacl#NodeShape'), defaultGraph())) {
        const eachOf = [];
        for (const property of shapeStore.getObjects(shape, namedNode('http://www.w3.org/ns/shacl#property'), defaultGraph())) {
            const minCount = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#minCount'), defaultGraph());
            const maxCount = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#maxCount'), defaultGraph());
            const datatype = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#datatype'), defaultGraph());
            const nodeKind = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#nodeKind'), defaultGraph());
            const pattern = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#pattern'), defaultGraph());
            const minLength = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#minLength'), defaultGraph());
            const maxLength = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#maxLength'), defaultGraph());
            const inValues = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#in'), defaultGraph());
            const hasValue = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#hasValue'), defaultGraph());
            const shapeRef = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#node'), defaultGraph());

            const path = shapeStore.getObjects(property, namedNode('http://www.w3.org/ns/shacl#path'), defaultGraph());

            if (path.length !== 1 || path[0].termType !== 'NamedNode') {
                console.warn('Unsupported path', path);
                continue;
            }

            let valueExpr: string | Record<string, string | string[]> = {
              "type": "NodeConstraint",
            }

            if (nodeKind.length === 1) {
              const kind = nodeKind[0].value.split('#')[1].toLowerCase();
              if (kind !== 'iri' && kind !== 'literal' && kind !== 'blanknode') {
                console.warn('Unsupported nodeKind', kind);
                continue;
              }
              valueExpr.nodeKind = kind;
            }
            if (inValues.length === 1) {
              const list = shapeStore.extractLists()[inValues[0].value];
              if (list) {
                // FIXME, make this work for literals
                valueExpr.values = list.map(v => v.value);
              }
            }

            if (datatype.length === 1) {
                valueExpr.datatype = datatype[0].value;
            } else if (shapeRef.length === 1) {
                  // TODO: Error if there are any other constraints
                  valueExpr = shapeRef[0].value;
            } else {
                console.warn('Unsupported property', property);
                continue;
            }

            eachOf.push({
              "type": "TripleConstraint",
              "predicate": path[0].value,
              "valueExpr": valueExpr,
              // FIXME: Int checks etc should be done here
              "min": minCount[0]?.value ?? 0,
              "max": maxCount[0]?.value ?? -1
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
