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
const XONE_TO_OR_WARNING = 'sh:xone converted to ShEx OR (not exact semantics)';

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

/**
 * Process a constraint (property or node shape) and convert to ShEx value expression
 */
function processConstraintToValueExpr(
  shapeStore: Store,
  constraint: Term,
  shapeTargetMap: Map<string, string>,
): shapeExprOrRef | undefined {
  if (constraint.termType !== 'NamedNode' && constraint.termType !== 'BlankNode') {
    return undefined;
  }

  const shapeData = shapeFromDataset(ShapeShapeShapeType, shapeStore, constraint);
  const inValues = shapeStore.getObjects(constraint, namedNode(shacl.in__workaround), defaultGraph());
  const shapeRef = shapeStore.getObjects(constraint, namedNode(shacl.node), defaultGraph());
  const orValues = shapeStore.getObjects(constraint, namedNode(shacl.or), defaultGraph());
  const andValues = shapeStore.getObjects(constraint, namedNode(shacl.and), defaultGraph());
  const xoneValues = shapeStore.getObjects(constraint, namedNode(shacl.xone), defaultGraph());
  const notValues = shapeStore.getObjects(constraint, namedNode(shacl.not), defaultGraph());

  let valueExpr: shapeExprOrRef = {
    type: 'NodeConstraint',
  };

  // Handle sh:not
  if (notValues.length === 1) {
    const notExpr = processConstraintToValueExpr(shapeStore, notValues[0], shapeTargetMap);
    if (notExpr) {
      return {
        type: 'ShapeNot',
        shapeExpr: notExpr,
      };
    }
  }

  // Handle sh:or
  if (orValues.length === 1) {
    const list = shapeStore.extractLists()[orValues[0].value];
    if (list && list.length > 0) {
      const orExprs = list
        .map((item) => processConstraintToValueExpr(shapeStore, item, shapeTargetMap))
        .filter((expr): expr is shapeExprOrRef => expr !== undefined);

      if (orExprs.length > 0) {
        return {
          type: 'ShapeOr',
          shapeExprs: orExprs,
        };
      }
    }
  }

  // Handle sh:and
  if (andValues.length === 1) {
    const list = shapeStore.extractLists()[andValues[0].value];
    if (list && list.length > 0) {
      const andExprs = list
        .map((item) => processConstraintToValueExpr(shapeStore, item, shapeTargetMap))
        .filter((expr): expr is shapeExprOrRef => expr !== undefined);

      if (andExprs.length > 0) {
        return {
          type: 'ShapeAnd',
          shapeExprs: andExprs,
        };
      }
    }
  }

  // Handle sh:xone (exclusive or) - ShEx doesn't have native xone, so we can't perfectly represent it
  // For now, we'll treat it similar to sh:or with a note
  if (xoneValues.length === 1) {
    const list = shapeStore.extractLists()[xoneValues[0].value];
    if (list && list.length > 0) {
      const xoneExprs = list
        .map((item) => processConstraintToValueExpr(shapeStore, item, shapeTargetMap))
        .filter((expr): expr is shapeExprOrRef => expr !== undefined);

      if (xoneExprs.length > 0) {
        // Note: ShEx doesn't have xone, using OR as approximation
        console.warn(XONE_TO_OR_WARNING);
        return {
          type: 'ShapeOr',
          shapeExprs: xoneExprs,
        };
      }
    }
  }

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
  }

  // Add string constraints (minLength, maxLength, pattern)
  if (shapeData.minLength !== undefined && typeof valueExpr === 'object' && valueExpr.type === 'NodeConstraint') {
    valueExpr.minlength = Number(shapeData.minLength);
  }
  if (shapeData.maxLength !== undefined && typeof valueExpr === 'object' && valueExpr.type === 'NodeConstraint') {
    valueExpr.maxlength = Number(shapeData.maxLength);
  }
  if (shapeData.pattern && typeof valueExpr === 'object' && valueExpr.type === 'NodeConstraint') {
    valueExpr.pattern = shapeData.pattern;
    if (shapeData.flags) {
      valueExpr.flags = shapeData.flags;
    }
  }

  // Add numeric constraints (minInclusive, maxInclusive, minExclusive, maxExclusive)
  if (shapeData.minInclusive !== undefined && typeof valueExpr === 'object' && valueExpr.type === 'NodeConstraint') {
    valueExpr.mininclusive = Number(shapeData.minInclusive);
  }
  if (shapeData.maxInclusive !== undefined && typeof valueExpr === 'object' && valueExpr.type === 'NodeConstraint') {
    valueExpr.maxinclusive = Number(shapeData.maxInclusive);
  }
  if (shapeData.minExclusive !== undefined && typeof valueExpr === 'object' && valueExpr.type === 'NodeConstraint') {
    valueExpr.minexclusive = Number(shapeData.minExclusive);
  }
  if (shapeData.maxExclusive !== undefined && typeof valueExpr === 'object' && valueExpr.type === 'NodeConstraint') {
    valueExpr.maxexclusive = Number(shapeData.maxExclusive);
  }

  // Handle sh:hasValue
  const hasValueObjects = shapeStore.getObjects(constraint, namedNode(shacl.hasValue), defaultGraph());
  if (hasValueObjects.length === 1 && typeof valueExpr === 'object' && valueExpr.type === 'NodeConstraint') {
    const hasValueTerm = hasValueObjects[0];
    if (hasValueTerm.termType === 'Literal') {
      valueExpr.values = [{
        value: hasValueTerm.value,
        type: hasValueTerm.datatype?.value || 'http://www.w3.org/2001/XMLSchema#string',
      }];
    } else if (hasValueTerm.termType === 'NamedNode') {
      valueExpr.values = [hasValueTerm.value];
    }
  }

  if (shapeData.class && shapeData.class.length > 0) {
    const classIri = shapeData.class[0]['@id'];
    const targetShape = shapeTargetMap.get(classIri);

    if (targetShape && shapeData.class.length === 1) {
      if (valueExpr.nodeKind) {
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
        valueExpr = targetShape;
      }
    } else if (valueExpr.nodeKind) {
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
    valueExpr = shapeRef[0].value;
  } else if ((typeof valueExpr === 'object' && 'nodeKind' in valueExpr && valueExpr.nodeKind)
             || (typeof valueExpr === 'object' && 'values' in valueExpr && valueExpr.values)
             || (typeof valueExpr === 'object' && 'datatype' in valueExpr && valueExpr.datatype)) {
    // Keep the existing NodeConstraint
  } else {
    return undefined;
  }

  return valueExpr;
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
    const shapeOr = shapeStore.getObjects(shape, namedNode(shacl.or), defaultGraph());
    const shapeAnd = shapeStore.getObjects(shape, namedNode(shacl.and), defaultGraph());
    const shapeXone = shapeStore.getObjects(shape, namedNode(shacl.xone), defaultGraph());

    // Handle shape-level logical operators (sh:or, sh:and, sh:xone)
    if (shapeOr.length === 1 || shapeAnd.length === 1 || shapeXone.length === 1) {
      let logicalOp: string;
      let logicalValues: Term[];

      if (shapeOr.length === 1) {
        logicalOp = 'or';
        logicalValues = shapeOr;
      } else if (shapeAnd.length === 1) {
        logicalOp = 'and';
        logicalValues = shapeAnd;
      } else {
        logicalOp = 'xone';
        logicalValues = shapeXone;
      }

      const list = shapeStore.extractLists()[logicalValues[0].value];
      if (list && list.length > 0) {
        const logicalExprs = list
          .map((item) => {
            // Each item in the list can be a shape reference or an inline constraint
            if (item.termType === 'NamedNode') {
              // It's a shape reference
              return item.value;
            } if (item.termType === 'BlankNode') {
              // It's an inline constraint - process it
              const inlineExpr = processConstraintToValueExpr(shapeStore, item, shapeTargetMap);
              return inlineExpr;
            }
            return undefined;
          })
          .filter((expr): expr is shapeExprOrRef => expr !== undefined);

        if (logicalExprs.length > 0) {
          let shapeExpr: shapeExprOrRef;
          if (logicalOp === 'xone') {
            console.warn(XONE_TO_OR_WARNING);
          }

          if (logicalOp === 'or' || logicalOp === 'xone') {
            shapeExpr = {
              type: 'ShapeOr',
              shapeExprs: logicalExprs,
            };
          } else {
            shapeExpr = {
              type: 'ShapeAnd',
              shapeExprs: logicalExprs,
            };
          }

          shexShapes.push({
            id: shape.value,
            type: 'ShapeDecl',
            shapeExpr,
          });
          continue; // Skip normal property processing for this shape
        }
      }
    }

    const eachOf = [];
    for (const property of shapeStore.getObjects(shape, namedNode(shacl.property), defaultGraph())) {
      if (property.termType !== 'NamedNode' && property.termType !== 'BlankNode') {
        console.warn('Unsupported property', property);
        continue;
      }
      const shapeData = shapeFromDataset(ShapeShapeShapeType, shapeStore, property);
      const path = shapeStore.getObjects(property, namedNode(shacl.path), defaultGraph());

      const valueExpr = processConstraintToValueExpr(shapeStore, property, shapeTargetMap);

      if (!valueExpr) {
        console.warn('Unsupported property', property);
        continue;
      }

      // Capture valueExpr in a const to ensure TypeScript knows it's not undefined
      const safeValueExpr: shapeExprOrRef = valueExpr;

      function toTripleConstraint(pathElem: Term): TripleConstraint {
        if (pathElem.termType === 'NamedNode') {
          return {
            type: 'TripleConstraint',
            predicate: pathElem.value,
            valueExpr: safeValueExpr,
            // FIXME: Int checks etc should be done here
            min: shapeData.minCount ?? 0,
            max: shapeData.maxCount ?? -1,
          };
        }
        const inversePath = getSingleObjectOfType(shapeStore, pathElem, namedNode(shacl.inversePath));
        if (inversePath) {
          return {
            type: 'TripleConstraint',
            predicate: inversePath.value,
            valueExpr: safeValueExpr,
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
            predicate: oneOrMorePath.value,
            valueExpr: safeValueExpr,
            min: 1,
            max: -1,
          };
        }

        const zeroOrMorePath = getSingleObjectOfType(shapeStore, pathElem, namedNode(shacl.zeroOrMorePath));
        if (zeroOrMorePath) {
          return {
            type: 'TripleConstraint',
            predicate: zeroOrMorePath.value,
            valueExpr: safeValueExpr,
            min: 0,
            max: -1,
          };
        }

        const zeroOrOnePath = getSingleObjectOfType(shapeStore, pathElem, namedNode(shacl.zeroOrOnePath));
        if (zeroOrOnePath) {
          return {
            type: 'TripleConstraint',
            predicate: zeroOrOnePath.value,
            valueExpr: safeValueExpr,
            min: 0,
            max: 1,
          };
        }

        const alternativePath = getSingleObjectOfType(shapeStore, pathElem, namedNode(shacl.alternativePath));
        if (alternativePath) {
          const list = shapeStore.extractLists()[alternativePath.value];
          if (list && list.length > 0) {
            // For alternative paths, we can't directly represent them in ShEx
            // The best approximation is to use ShapeOr at the parent level, not as a TripleConstraint
            // So we'll log a warning and use the first path as a fallback
            console.warn('sh:alternativePath has limited ShEx support, using first alternative:', list[0].value);
            if (list[0].termType === 'NamedNode') {
              return {
                type: 'TripleConstraint',
                predicate: list[0].value,
                valueExpr: safeValueExpr,
                min: shapeData.minCount ?? 0,
                max: shapeData.maxCount ?? -1,
              };
            }
          }
        }

        // Handle sequence paths (lists)
        const sequencePath = shapeStore.extractLists()[pathElem.value];
        if (sequencePath && sequencePath.length > 0) {
          // For sequence paths, we need to create nested shapes
          // This is a simplified implementation
          console.warn('Sequence paths are not fully supported yet:', pathElem.value);
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
