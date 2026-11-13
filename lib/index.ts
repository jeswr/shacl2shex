/* eslint-disable no-console, no-continue, no-inner-declarations */
import { DatasetCore, NamedNode, Term } from '@rdfjs/types';
import Writer from '@shexjs/writer';
import { DataFactory, Store } from 'n3';
import { rdf, shacl } from 'rdf-namespaces';
import type {
  Schema, ShapeDecl,
  TripleConstraint, shapeExprOrRef, shapeExpr,
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

function extractRdfList(store: DatasetCore, listNode: Term): Term[] {
  const result: Term[] = [];
  let current = listNode;
  
  while (current && current.termType === 'BlankNode') {
    const firstTriples = store.match(current, namedNode(rdf.first), null, defaultGraph());
    const restTriples = store.match(current, namedNode(rdf.rest), null, defaultGraph());
    
    if (firstTriples.size === 0) break;
    
    const first = [...firstTriples][0].object;
    const rest = restTriples.size > 0 ? [...restTriples][0].object : null;
    
    if (first) {
      result.push(first);
    }
    
    if (!rest || rest.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil') {
      break;
    }
    
    current = rest;
  }
  
  return result;
}

function processLogicalConstraints(
  shapeStore: DatasetCore,
  shape: Term,
  shapeTargetMap: Map<string, string>
): shapeExprOrRef | undefined {
  // Only process NamedNode or BlankNode terms
  if (shape.termType !== 'NamedNode' && shape.termType !== 'BlankNode') {
    return undefined;
  }
  
  // Check for sh:and
  const andTriples = shapeStore.match(shape, namedNode(shacl.and), null, defaultGraph());
  if (andTriples.size > 0) {
    const andList = [...andTriples][0].object;
    const andShapes = extractRdfList(shapeStore, andList);
    
    if (andShapes.length > 0) {
      const andExprs: shapeExprOrRef[] = [];
      for (const andShape of andShapes) {
        if (andShape.termType !== 'NamedNode') continue;
        
        // Check if it's a reference to an existing shape
        if (shapeStore.match(andShape, namedNode(rdf.type), namedNode(shacl.NodeShape), defaultGraph()).size > 0) {
          andExprs.push(andShape.value);
        } else {
          // Process inline shape
          const expr = processLogicalConstraints(shapeStore, andShape, shapeTargetMap);
          if (expr) {
            andExprs.push(expr);
          }
        }
      }
      
      if (andExprs.length > 0) {
        return {
          type: 'ShapeAnd',
          shapeExprs: andExprs,
        };
      }
    }
  }
  
  // Check for sh:or
  const orTriples = shapeStore.match(shape, namedNode(shacl.or), null, defaultGraph());
  if (orTriples.size > 0) {
    const orList = [...orTriples][0].object;
    const orShapes = extractRdfList(shapeStore, orList);
    
    if (orShapes.length > 0) {
      const orExprs: shapeExprOrRef[] = [];
      for (const orShape of orShapes) {
        if (orShape.termType !== 'NamedNode') continue;
        
        // Check if it's a reference to an existing shape
        if (shapeStore.match(orShape, namedNode(rdf.type), namedNode(shacl.NodeShape), defaultGraph()).size > 0) {
          orExprs.push(orShape.value);
        } else {
          // Process inline shape
          const expr = processLogicalConstraints(shapeStore, orShape, shapeTargetMap);
          if (expr) {
            orExprs.push(expr);
          }
        }
      }
      
      if (orExprs.length > 0) {
        return {
          type: 'ShapeOr',
          shapeExprs: orExprs,
        };
      }
    }
  }
  
  // Check for sh:not
  const notTriples = shapeStore.match(shape, namedNode(shacl.not), null, defaultGraph());
  if (notTriples.size > 0) {
    const notShape = [...notTriples][0].object;
    if (notShape.termType !== 'NamedNode') return undefined;
    
    let notExpr: shapeExprOrRef;
    // Check if it's a reference to an existing shape
    if (shapeStore.match(notShape, namedNode(rdf.type), namedNode(shacl.NodeShape), defaultGraph()).size > 0) {
      notExpr = notShape.value;
    } else {
      // Process inline shape
      const expr = processLogicalConstraints(shapeStore, notShape, shapeTargetMap);
      if (expr) {
        notExpr = expr;
      } else {
        return undefined;
      }
    }
    
    return {
      type: 'ShapeNot',
      shapeExpr: notExpr,
    };
  }
  
  // Check for sh:xone
  const xoneTriples = shapeStore.match(shape, namedNode(shacl.xone), null, defaultGraph());
  if (xoneTriples.size > 0) {
    const xoneList = [...xoneTriples][0].object;
    const xoneShapes = extractRdfList(shapeStore, xoneList);
    
    if (xoneShapes.length > 0) {
      const xoneExprs: shapeExprOrRef[] = [];
      for (const xoneShape of xoneShapes) {
        if (xoneShape.termType !== 'NamedNode') continue;
        
        let expr: shapeExprOrRef;
        // Check if it's a reference to an existing shape
        if (shapeStore.match(xoneShape, namedNode(rdf.type), namedNode(shacl.NodeShape), defaultGraph()).size > 0) {
          expr = xoneShape.value;
        } else {
          // Process inline shape
          const processed = processLogicalConstraints(shapeStore, xoneShape, shapeTargetMap);
          if (processed) {
            expr = processed;
          } else {
            continue;
          }
        }
        xoneExprs.push(expr);
      }
      
      if (xoneExprs.length > 0) {
        // Implement xone as (A AND NOT (B OR C)) OR (B AND NOT (A OR C)) OR (C AND NOT (A OR B))
        const xoneTerms: shapeExprOrRef[] = [];
        
        for (let i = 0; i < xoneExprs.length; i++) {
          const others = xoneExprs.filter((_, j) => j !== i);
          if (others.length === 0) {
            xoneTerms.push(xoneExprs[i]);
          } else {
            const notOthers: shapeExprOrRef = others.length === 1 
              ? { type: 'ShapeNot', shapeExpr: others[0] }
              : { type: 'ShapeNot', shapeExpr: { type: 'ShapeOr', shapeExprs: others } };
            
            xoneTerms.push({
              type: 'ShapeAnd',
              shapeExprs: [xoneExprs[i], notOthers],
            });
          }
        }
        
        return xoneTerms.length === 1 ? xoneTerms[0] : {
          type: 'ShapeOr',
          shapeExprs: xoneTerms,
        };
      }
    }
  }
  
  return undefined;
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
    // First check if this shape has logical constraints
    const logicalExpr = processLogicalConstraints(shapeStore, shape, shapeTargetMap);
    if (logicalExpr) {
      // If the shape has logical constraints, use them as the shape expression
      shexShapes.push({
        id: shape.value,
        type: 'ShapeDecl',
        shapeExpr: logicalExpr as any,
      });
      continue;
    }
    
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
        const nodeKindId = shapeData.nodeKind['@id'];
        const nodeKindShortName = nodeKindId.startsWith('http://www.w3.org/ns/shacl#') 
          ? nodeKindId.substring('http://www.w3.org/ns/shacl#'.length)
          : nodeKindId;
        
        const nodeKindMap = {
          IRI: 'iri',
          Literal: 'literal',
          BlankNode: 'bnode',
          BlankNodeOrIRI: 'nonliteral',
          IRIOrLiteral: undefined,
          BlankNodeOrLiteral: undefined,
        } as const;
        
        valueExpr.nodeKind = nodeKindMap[nodeKindShortName as keyof typeof nodeKindMap];
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
    } else if (shape.shapeExpr.type === 'ShapeOr') {
      // ShapeOr shapes are always included
      shouldInclude = true;
    } else if (shape.shapeExpr.type === 'ShapeNot') {
      // ShapeNot shapes are always included
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
