/* eslint-disable no-console */
/**
 * ShEx emission: converts the intermediate SHACL model ({@link ShaclSchema})
 * into a ShexJ `Schema`.
 *
 * The mapping intentionally reproduces the behaviour of the original
 * implementation (the existing fixture suite is the equivalence oracle):
 *
 * - each node shape becomes a `ShapeDecl` whose expression is an `EachOf` of
 *   one `TripleConstraint` per supported property shape;
 * - `sh:class` becomes a reference to the shape targeting that class when one
 *   exists, and a nested `{ a [<classes>] }` shape otherwise;
 * - shape-level `sh:nodeKind` wraps the shape in a `ShapeAnd`;
 * - constraints that cannot be represented cause the property (or shape) to
 *   be skipped with a warning rather than failing the conversion.
 */
import type { Term } from '@rdfjs/types';
import type {
  NodeConstraint, Schema, Shape, ShapeDecl, TripleConstraint, shapeExprOrRef, valueSetValue,
} from 'shexj';
import type { ShaclNodeShape, ShaclProperty, ShaclSchema } from './model';
import { rdfType } from './vocab';

/**
 * SHACL node kinds mapped onto ShEx node kinds. The two SHACL union kinds
 * without a ShEx equivalent (`sh:IRIOrLiteral`, `sh:BlankNodeOrLiteral`) map
 * to `undefined` and result in no node-kind constraint.
 */
const NODE_KINDS = {
  IRI: 'iri',
  Literal: 'literal',
  BlankNode: 'bnode',
  BlankNodeOrIRI: 'nonliteral',
  IRIOrLiteral: undefined,
  BlankNodeOrLiteral: undefined,
} as const;

/** A nested shape requiring `rdf:type` to be one of `classes` (for `sh:class`). */
function classShape(classes: string[]): Shape {
  return {
    type: 'Shape',
    expression: {
      type: 'TripleConstraint',
      predicate: rdfType,
      valueExpr: { type: 'NodeConstraint', values: classes },
    },
  };
}

/** Maps the members of an `sh:in` list onto a ShexJ value set. */
function valueSet(values: Term[]): valueSetValue[] {
  return values.map((value): valueSetValue => (value.termType === 'Literal'
    ? { value: value.value, type: value.datatype.value }
    : value.value));
}

/**
 * Builds the value expression for a property shape, or returns `undefined`
 * when none of the property's constraints can be represented (in which case
 * the property is skipped, matching the historic behaviour).
 */
function propertyValueExpr(
  property: ShaclProperty,
  targetShapes: Map<string, string>,
): shapeExprOrRef | undefined {
  const constraint: NodeConstraint = { type: 'NodeConstraint' };

  const nodeKind = property.nodeKind && NODE_KINDS[property.nodeKind];
  if (nodeKind) {
    constraint.nodeKind = nodeKind;
  }

  if (property.inValues) {
    const [first] = property.inValues;
    // Workaround kept from the original implementation: a value set in which
    // every member is a literal of one datatype is emitted as a datatype
    // constraint instead of a value set.
    if (first !== undefined
      && first.termType === 'Literal'
      && property.inValues.every((value) => value.termType === 'Literal' && value.datatype.equals(first.datatype))) {
      constraint.datatype = first.datatype.value;
    } else {
      constraint.values = valueSet(property.inValues);
    }
  }

  if (property.datatype) {
    constraint.datatype = property.datatype;
    return constraint;
  }

  if (property.classes.length > 0) {
    // A single sh:class targeted by some shape becomes a reference to that
    // shape; anything else becomes a nested `{ a [<classes>] }` shape.
    const targetShape = property.classes.length === 1 ? targetShapes.get(property.classes[0]) : undefined;
    const classExpr: shapeExprOrRef = targetShape ?? classShape(property.classes);
    if (constraint.nodeKind) {
      return {
        type: 'ShapeAnd',
        shapeExprs: [{ type: 'NodeConstraint', nodeKind: constraint.nodeKind }, classExpr],
      };
    }
    return classExpr;
  }

  if (property.nodeShapes.length === 1) {
    return property.nodeShapes[0];
  }

  if (constraint.nodeKind || constraint.values) {
    return constraint;
  }

  return undefined;
}

/**
 * Builds the triple constraint for a property shape, or returns `undefined`
 * when its `sh:path` is missing or unsupported.
 */
function tripleConstraint(property: ShaclProperty, valueExpr: shapeExprOrRef): TripleConstraint | undefined {
  const { path } = property;
  const min = property.minCount ?? 0;
  const max = property.maxCount ?? -1;

  switch (path?.kind) {
    case 'predicate':
      return {
        type: 'TripleConstraint', predicate: path.predicate, valueExpr, min, max,
      };
    case 'inverse':
      return {
        type: 'TripleConstraint', predicate: path.predicate, inverse: true, valueExpr, min, max,
      };
    case 'oneOrMore':
      // Approximated as `predicate (value | shape-that-repeats-the-path)`.
      return {
        type: 'TripleConstraint',
        predicate: path.predicate,
        valueExpr: {
          type: 'ShapeOr',
          shapeExprs: [
            {
              type: 'Shape',
              expression: {
                type: 'TripleConstraint', predicate: path.predicate, valueExpr, min, max,
              },
            },
            valueExpr,
          ],
        },
        min,
        max,
      };
    default:
      console.warn('Unsupported sh:path on property', property.term);
      return undefined;
  }
}

/**
 * Converts one node shape into a `ShapeDecl`, or returns `undefined` when the
 * shape has no representable constraints at all.
 */
function nodeShapeDecl(shape: ShaclNodeShape, targetShapes: Map<string, string>): ShapeDecl | undefined {
  const expressions: TripleConstraint[] = [];
  for (const property of shape.properties) {
    const valueExpr = propertyValueExpr(property, targetShapes);
    if (valueExpr === undefined) {
      console.warn('Unsupported property', property.term);
    } else {
      const constraint = tripleConstraint(property, valueExpr);
      if (constraint !== undefined) {
        expressions.push(constraint);
      }
    }
  }

  // Shape-level sh:class becomes a leading `a [<classes>]` triple constraint,
  // mirroring the property-level sh:class conversion.
  if (shape.classes.length > 0) {
    expressions.unshift({
      type: 'TripleConstraint',
      predicate: rdfType,
      valueExpr: { type: 'NodeConstraint', values: shape.classes },
    });
  }

  const nodeKind = shape.nodeKind && NODE_KINDS[shape.nodeKind];

  if (expressions.length === 0) {
    if (!nodeKind) {
      console.warn('No properties found in shape', shape.id);
      return undefined;
    }
    return { id: shape.id, type: 'ShapeDecl', shapeExpr: { type: 'NodeConstraint', nodeKind } };
  }

  const withProperties: Shape = { type: 'Shape', expression: { type: 'EachOf', expressions } };
  return {
    id: shape.id,
    type: 'ShapeDecl',
    shapeExpr: nodeKind
      ? { type: 'ShapeAnd', shapeExprs: [{ type: 'NodeConstraint', nodeKind }, withProperties] }
      : withProperties,
  };
}

/**
 * Removes triple constraints that reference shapes which are not declared in
 * the schema, and drops shapes that become empty as a result.
 */
function pruneDanglingReferences(decls: ShapeDecl[]): ShapeDecl[] {
  const ids = new Set(decls.map((decl) => decl.id));
  return decls.filter((decl) => {
    const expr = decl.shapeExpr;
    if (typeof expr !== 'object' || expr.type !== 'Shape'
      || typeof expr.expression !== 'object' || expr.expression?.type !== 'EachOf') {
      return true;
    }
    expr.expression.expressions = expr.expression.expressions.filter(
      (tripleExpr) => typeof tripleExpr !== 'string'
        && tripleExpr.type === 'TripleConstraint'
        && (typeof tripleExpr.valueExpr !== 'string' || ids.has(tripleExpr.valueExpr)),
    );
    return expr.expression.expressions.length > 0;
  });
}

/** Converts a parsed SHACL schema into a ShexJ `Schema`. */
export function shexSchemaFromShacl(schema: ShaclSchema): Schema {
  // Later shapes win when several shapes target the same class, matching the
  // historic first-pass map construction.
  const targetShapes = new Map<string, string>();
  for (const shape of schema.shapes) {
    for (const targetClass of shape.targetClasses) {
      targetShapes.set(targetClass, shape.id);
    }
  }

  const decls: ShapeDecl[] = [];
  for (const shape of schema.shapes) {
    const decl = nodeShapeDecl(shape, targetShapes);
    if (decl !== undefined) {
      decls.push(decl);
    }
  }

  return { type: 'Schema', shapes: pruneDanglingReferences(decls) };
}
