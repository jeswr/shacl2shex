/* eslint-disable no-console, no-continue, no-inner-declarations */
import { DatasetCore, NamedNode, Term } from '@rdfjs/types';
import Writer from '@shexjs/writer';
import { DataFactory, Store } from 'n3';
import { rdf, shacl } from 'rdf-namespaces';
import type {
  Schema, ShapeDecl,
  TripleConstraint, shapeExprOrRef,
} from 'shexj';
import { ShapeShapeShapeType } from './ldo/Shacl.shapeTypes';
import { shapeFromDataset } from './shapeFromDataset';

export { shapeMapFromDataset, writeShapeMap } from './shapeMapFromDataset';
export type { ShapeMap, ShapeMapEntry } from './shapeMapFromDataset';

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

export async function shaclStoreToShexSchema(shapeStore: Store): Promise<Schema> {
  const shexShapes: ShapeDecl[] = [];

  // First pass: collect all shapes and their target classes for reference resolution
  const shapeTargetMap = new Map<string, string>(); // target class -> shape IRI
  for (const { subject: shape } of
    shapeStore.match(null, namedNode(rdf.type), namedNode(shacl.NodeShape), defaultGraph())
  ) {
    const targetClasses = shapeStore.getObjects(shape, namedNode(shacl.targetClass), defaultGraph());
    for (const targetClass of targetClasses) {
      if (targetClass.termType === 'NamedNode') {
        shapeTargetMap.set(targetClass.value, shape.value);
      }
    }
  }

  for (const { subject: shape } of
    shapeStore.match(null, namedNode(rdf.type), namedNode(shacl.NodeShape), defaultGraph())
  ) {
    // Extract shape-level constraints
    const shapeNodeKind = shapeStore.getObjects(shape, namedNode(shacl.nodeKind), defaultGraph());

    const eachOf = [];
    for (const property of shapeStore.getObjects(shape, namedNode(shacl.property), defaultGraph())) {
      if (property.termType !== 'NamedNode' && property.termType !== 'BlankNode') {
        console.warn('Unsupported property', property);
        continue;
      }
      const shapeData = shapeFromDataset(ShapeShapeShapeType, shapeStore, property);
      const inValues = shapeStore.getObjects(property, namedNode(shacl.in__workaround), defaultGraph());
      const shapeRef = shapeStore.getObjects(property, namedNode(shacl.node), defaultGraph());
      const path = shapeStore.getObjects(property, namedNode(shacl.path), defaultGraph());

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
          if (firstTerm
              && firstTerm.termType === 'Literal'
              && list.every((v) => v.termType === 'Literal' && v.datatype.equals(firstTerm.datatype))) {
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
      } else if (shapeData.class && shapeData.class.length > 0) {
        // Check if there's a shape that targets this class
        const classIri = shapeData.class[0]['@id'];
        const targetShape = shapeTargetMap.get(classIri);

        if (targetShape && shapeData.class.length === 1) {
          // Use shape reference if there's a shape targeting this class
          if (valueExpr.nodeKind) {
            // Combine nodeKind constraint with shape reference
            valueExpr = {
              type: 'ShapeAnd',
              shapeExprs: [
                {
                  type: 'NodeConstraint',
                  nodeKind: valueExpr.nodeKind,
                },
                targetShape,
              ],
            };
          } else {
            // Just the shape reference
            valueExpr = targetShape;
          }
        } else
          // Handle sh:class constraint by creating a nested shape with rdf:type
          // If there's also a nodeKind constraint, we need to combine them
          if (valueExpr.nodeKind) {
            // Create a ShapeAnd that combines the nodeKind constraint with the class shape
            valueExpr = {
              type: 'ShapeAnd',
              shapeExprs: [
                {
                  type: 'NodeConstraint',
                  nodeKind: valueExpr.nodeKind,
                },
                {
                  type: 'Shape',
                  expression: {
                    type: 'TripleConstraint',
                    predicate: rdf.type,
                    valueExpr: {
                      type: 'NodeConstraint',
                      values: shapeData.class.map((cls) => cls['@id']),
                    },
                  },
                },
              ],
            };
          } else {
            // Just the class constraint without nodeKind
            valueExpr = {
              type: 'Shape',
              expression: {
                type: 'TripleConstraint',
                predicate: rdf.type,
                valueExpr: {
                  type: 'NodeConstraint',
                  values: shapeData.class.map((cls) => cls['@id']),
                },
              },
            };
          }
      } else if (shapeRef.length === 1) {
        // TODO: Error if there are any other constraints
        valueExpr = shapeRef[0].value;
      } else if ((typeof valueExpr === 'object' && 'nodeKind' in valueExpr && valueExpr.nodeKind)
                 || (typeof valueExpr === 'object' && 'values' in valueExpr && valueExpr.values)) {
        // Noop - keep the existing NodeConstraint
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
        const inversePath = getSingleObjectOfType(shapeStore, pathElem, namedNode(shacl.inversePath));
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
        const oneOrMorePath = getSingleObjectOfType(shapeStore, pathElem, namedNode(shacl.oneOrMorePath));
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

    // Handle shape-level nodeKind constraint
    let shapeNodeKindConstraint;
    if (shapeNodeKind.length === 1 && shapeNodeKind[0].termType === 'NamedNode') {
      const nodeKindValue = shapeNodeKind[0].value;
      const nodeKindMapping = {
        'http://www.w3.org/ns/shacl#IRI': 'iri',
        'http://www.w3.org/ns/shacl#Literal': 'literal',
        'http://www.w3.org/ns/shacl#BlankNode': 'bnode',
        'http://www.w3.org/ns/shacl#BlankNodeOrIRI': 'nonliteral',
      } as const;

      if (nodeKindValue in nodeKindMapping) {
        shapeNodeKindConstraint = nodeKindMapping[nodeKindValue as keyof typeof nodeKindMapping];
      }
    }

    // Create the shape expression
    let shapeExpr: any;

    if (eachOf.length === 0) {
      // If there are no properties but there is a nodeKind constraint, create a simple nodeKind constraint
      if (shapeNodeKindConstraint) {
        shapeExpr = {
          type: 'NodeConstraint',
          nodeKind: shapeNodeKindConstraint,
        };
      } else {
        console.warn('No properties found in shape', shape);
        continue;
      }
    } else {
      // If there are properties, create the shape with properties
      const shapeWithProperties: any = {
        type: 'Shape',
        expression: {
          type: 'EachOf',
          expressions: eachOf,
        },
      };

      // If there's a nodeKind constraint, wrap with ShapeAnd
      if (shapeNodeKindConstraint) {
        shapeExpr = {
          type: 'ShapeAnd',
          shapeExprs: [
            {
              type: 'NodeConstraint',
              nodeKind: shapeNodeKindConstraint,
            },
            shapeWithProperties,
          ],
        };
      } else {
        shapeExpr = shapeWithProperties;
      }
    }

    // ---------------------------------------------------------------------------
    // Logical constraints: sh:and, sh:or, sh:not, sh:xone  (SHACL §2.3 Logical)
    // ---------------------------------------------------------------------------
    // According to the SHACL specification (https://www.w3.org/TR/shacl/#logical-constraint-components),
    // a NodeShape may include logical constraint components. ShEx provides equivalent
    // logical shape expressions (https://shex.io/shex-semantics/) – namely ShapeAnd,
    // ShapeOr and ShapeNot – that can be used to express these constraints.
    //
    // Mapping rationale:
    //   * sh:and  -> ShEx ShapeAnd (node must satisfy *all* listed shapes).
    //   * sh:or   -> ShEx ShapeOr  (node must satisfy *at least one* listed shape).
    //   * sh:not  -> ShEx ShapeNot (node must *not* satisfy the given shape).
    //   * sh:xone -> There is no direct equivalent in ShEx2. We approximate it
    //                using ShapeOr (same as sh:or). This ensures *at least* one
    //                shape holds; exclusivity cannot currently be enforced in ShEx.
    //                The relevant part of the SHACL spec is
    //                https://www.w3.org/TR/shacl/#XoneConstraintComponent.
    //
    // After constructing the property-based shapeExpr above, we inspect the current
    // shape for logical constraints and combine them with the property expression
    // using an outer ShapeAnd (since both the property constraints *and* the logical
    // constraint component must hold for the SHACL shape to validate).

    const logicalAnd = shapeStore.getObjects(shape, namedNode(shacl.and), defaultGraph());
    const logicalOr = shapeStore.getObjects(shape, namedNode(shacl.or), defaultGraph());
    const logicalNot = shapeStore.getObjects(shape, namedNode(shacl.not), defaultGraph());
    const logicalXone = shapeStore.getObjects(shape, namedNode(shacl.xone), defaultGraph());

    // Helper to convert an RDF term to a ShEx shape expression reference
    function termToShapeExpr(t: Term): shapeExprOrRef {
      if (t.termType === 'NamedNode' || t.termType === 'BlankNode') {
        return t.value;
      }
      console.warn('Unsupported term in logical constraint', t);
      return t.value as any;
    }

    let logicalExpr: any;

    if (logicalAnd.length === 1) {
      const list = shapeStore.extractLists()[logicalAnd[0].value];
      if (list) {
        logicalExpr = {
          type: 'ShapeAnd',
          shapeExprs: list.map(termToShapeExpr),
        };
      }
    } else if (logicalOr.length === 1) {
      const list = shapeStore.extractLists()[logicalOr[0].value];
      if (list) {
        logicalExpr = {
          type: 'ShapeOr',
          shapeExprs: list.map(termToShapeExpr),
        };
      }
    } else if (logicalNot.length === 1) {
      logicalExpr = {
        type: 'ShapeNot',
        shapeExpr: termToShapeExpr(logicalNot[0]),
      };
    } else if (logicalXone.length === 1) {
      // Note: Exclusivity cannot be guaranteed in ShEx2 – we degrade gracefully.
      const list = shapeStore.extractLists()[logicalXone[0].value];
      if (list) {
        logicalExpr = {
          type: 'ShapeOr',
          shapeExprs: list.map(termToShapeExpr),
        };
      }
    }

    // Combine the logical expression with the previously computed shapeExpr
    if (logicalExpr) {
      if (shapeExpr) {
        shapeExpr = {
          type: 'ShapeAnd',
          shapeExprs: [shapeExpr, logicalExpr],
        };
      } else {
        shapeExpr = logicalExpr;
      }
    }

    shexShapes.push({
      id: shape.value,
      type: 'ShapeDecl',
      shapeExpr,
    });
  }

  const filteredShapes: ShapeDecl[] = [];

  const shapes = new Set(shexShapes.map((s) => s.id));

  // TODO: Apply this recursively
  // TODO: Add warnings
  for (const shape of shexShapes) {
    let shouldInclude = true;

    // Handle different shape types
    if (shape.shapeExpr.type === 'NodeConstraint') {
      // NodeConstraint shapes are always included
      shouldInclude = true;
    } else if (shape.shapeExpr.type === 'ShapeAnd') {
      // ShapeAnd shapes need to check their component shapes
      // For now, we'll include them all, but this could be refined
      shouldInclude = true;
    } else if (shape.shapeExpr.type === 'Shape'
      && shape.shapeExpr?.expression
      && typeof shape.shapeExpr?.expression === 'object'
      && shape.shapeExpr?.expression.type === 'EachOf'
      && shape.shapeExpr?.expression.expressions
    ) {
      // Original logic for Shape with EachOf expressions
      shape.shapeExpr.expression.expressions = shape.shapeExpr.expression.expressions.filter(
        (eachOf) => typeof eachOf !== 'string'
          && eachOf.type === 'TripleConstraint'
          && ((typeof eachOf.valueExpr !== 'string') || shapes.has(eachOf.valueExpr)),
      );

      shouldInclude = shape.shapeExpr.expression.expressions.length > 0;
    }

    if (shouldInclude) {
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
