/* eslint-disable no-console */
/**
 * ShEx emission: converts the intermediate SHACL model ({@link ShaclSchema})
 * into a ShexJ `Schema`.
 *
 * The mapping preserves the behaviour of the original implementation for the
 * historic feature subset (the existing fixture suite is the equivalence
 * oracle) and extends it with the wider SHACL-core coverage documented in the
 * README feature matrix:
 *
 * - each node shape becomes a `ShapeDecl` whose expression is an `EachOf` of
 *   one `TripleConstraint` per supported property shape;
 * - `sh:class` becomes a reference to the shape targeting that class when one
 *   exists, and a nested `{ a [<classes>] }` shape otherwise;
 * - shape-level `sh:nodeKind` wraps the shape in a `ShapeAnd`;
 * - string/numeric facets, `sh:languageIn` and `sh:in` map onto ShEx node
 *   constraints; `sh:hasValue` uses the ShEx `EXTRA` idiom;
 * - constraints that cannot be represented cause the property (or the
 *   individual constraint) to be skipped with a warning rather than failing
 *   the conversion.
 */
import type { Term } from '@rdfjs/types';
import type {
  NodeConstraint, Schema, Shape, ShapeDecl, TripleConstraint, shapeExpr, shapeExprOrRef, valueSetValue,
} from 'shexj';
import type {
  ShaclNodeShape, ShaclProperty, ShaclSchema, ShaclShapeBody,
} from './model';
import { rdfType } from './vocab';

/**
 * SHACL node kinds mapped onto ShEx node kinds. The two SHACL union kinds
 * without a direct ShEx equivalent (`sh:IRIOrLiteral`,
 * `sh:BlankNodeOrLiteral`) are handled separately via `ShapeNot` (see
 * {@link negatedNodeKind}).
 */
const NODE_KINDS = {
  IRI: 'iri',
  Literal: 'literal',
  BlankNode: 'bnode',
  BlankNodeOrIRI: 'nonliteral',
  IRIOrLiteral: undefined,
  BlankNodeOrLiteral: undefined,
} as const;

const XSD = 'http://www.w3.org/2001/XMLSchema#';

/** The XSD datatypes whose values ShEx numeric facets can compare. */
const NUMERIC_DATATYPES = new Set([
  'integer', 'decimal', 'float', 'double',
  'byte', 'int', 'long', 'short',
  'negativeInteger', 'nonNegativeInteger', 'nonPositiveInteger', 'positiveInteger',
  'unsignedByte', 'unsignedInt', 'unsignedLong', 'unsignedShort',
].map((local) => XSD + local));

/**
 * The two SHACL node-kind unions without a ShEx `nodeKind`, expressed exactly
 * by negating the excluded kind.
 */
function negatedNodeKind(kind: ShaclShapeBody['nodeKind']): shapeExpr | undefined {
  if (kind === 'IRIOrLiteral') {
    return { type: 'ShapeNot', shapeExpr: { type: 'NodeConstraint', nodeKind: 'bnode' } };
  }
  if (kind === 'BlankNodeOrLiteral') {
    return { type: 'ShapeNot', shapeExpr: { type: 'NodeConstraint', nodeKind: 'iri' } };
  }
  return undefined;
}

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

/**
 * Maps one RDF term onto a ShexJ value-set value; blank nodes have no
 * value-set counterpart and yield `undefined`.
 */
function valueSetValueOf(term: Term): valueSetValue | undefined {
  if (term.termType === 'NamedNode') {
    return term.value;
  }
  if (term.termType === 'Literal') {
    return term.language !== ''
      ? { value: term.value, language: term.language }
      : { value: term.value, type: term.datatype.value };
  }
  return undefined;
}

/** Maps the members of an `sh:in` list onto a ShexJ value set. */
function valueSet(values: Term[], diagnostic: Term): valueSetValue[] {
  const result: valueSetValue[] = [];
  for (const value of values) {
    const mapped = valueSetValueOf(value);
    if (mapped === undefined) {
      console.warn('Skipping unmatchable blank node in sh:in list on', diagnostic);
    } else {
      result.push(mapped);
    }
  }
  return result;
}

/** `sh:languageIn` members as ShEx language stems (`*` matches any tag). */
function languageStems(tags: string[]): valueSetValue[] {
  return tags.map((tag) => ({ type: 'LanguageStem', stem: tag === '*' ? '' : tag }));
}

/**
 * A numeric-facet operand as a number, or `undefined` (with a warning) when
 * the operand is not numeric: SHACL orders temporals/strings/booleans via
 * SPARQL operators, but ShEx range facets are numbers-only.
 */
function numericFacetValue(term: Term | undefined, component: string, diagnostic: Term): number | undefined {
  if (term === undefined) {
    return undefined;
  }
  if (term.termType === 'Literal' && NUMERIC_DATATYPES.has(term.datatype.value)) {
    const value = Number(term.value);
    if (!Number.isNaN(value)) {
      return value;
    }
  }
  console.warn(`Skipping ${component} with non-numeric operand on`, diagnostic);
  return undefined;
}

/** How {@link bodyParts} should treat the constraints of a shape body. */
interface BodyOptions {
  /**
   * Whether `sh:nodeKind` and `sh:class` contribute parts. At the node-shape
   * level they are instead handled by the historic conversion (a `ShapeAnd`
   * wrapper and a leading `a [<classes>]` triple constraint).
   */
  focusConstraints: boolean;
  /**
   * Whether `sh:hasValue` maps to a value-set constraint on the node itself
   * (true in node/value positions) rather than being handled by the caller
   * via the `EXTRA` triple-constraint idiom (property shapes).
   */
  hasValuesAsSelf: boolean;
}

/** The result of converting constraints: ShEx conjuncts plus an exactness flag. */
interface PartsResult {
  parts: shapeExprOrRef[];
  /** False when any constraint was skipped or weakened during conversion. */
  exact: boolean;
}

/**
 * Converts the shared constraint parameters of a shape body into a list of
 * ShEx shape-expression conjuncts. Also emits the warnings for inexpressible
 * components (`body.unsupported`).
 */
function bodyParts(body: ShaclShapeBody, targetShapes: Map<string, string>, options: BodyOptions): PartsResult {
  let exact = true;
  const parts: shapeExprOrRef[] = [];
  const constraint: NodeConstraint = { type: 'NodeConstraint' };

  if (body.unsupported.length > 0) {
    console.warn(`Skipping constraint(s) ShEx cannot express (${body.unsupported.join(', ')}) on`, body.term);
    exact = false;
  }

  const nodeKind = options.focusConstraints && body.nodeKind ? NODE_KINDS[body.nodeKind] : undefined;
  if (nodeKind) {
    constraint.nodeKind = nodeKind;
  }

  if (body.inValues) {
    const [first] = body.inValues;
    const commonDatatype = first !== undefined
      && first.termType === 'Literal'
      && first.language === ''
      && body.inValues.every((value) => value.termType === 'Literal' && value.datatype.equals(first.datatype));
    if (commonDatatype && body.datatype !== undefined) {
      // Workaround kept from the original implementation: when an explicit
      // sh:datatype accompanies a value set whose members are all literals of
      // one datatype, only the datatype constraint is emitted. This widens
      // the constraint (any literal of the datatype is accepted).
      console.warn('Widening sh:in to its member datatype (legacy behaviour) on', body.term);
      exact = false;
    } else {
      const values = valueSet(body.inValues, body.term);
      if (values.length !== body.inValues.length) {
        exact = false;
      }
      constraint.values = values;
    }
  }

  if (body.languageIn !== undefined) {
    const stems = languageStems(body.languageIn);
    if (constraint.values === undefined) {
      constraint.values = stems;
    } else {
      parts.push({ type: 'NodeConstraint', values: stems });
    }
  }

  if (body.datatype) {
    constraint.datatype = body.datatype;
  }

  if (body.pattern !== undefined) {
    constraint.pattern = body.pattern;
    if (body.flags !== undefined) {
      constraint.flags = body.flags;
    }
  }
  if (body.minLength !== undefined) {
    constraint.minlength = body.minLength;
  }
  if (body.maxLength !== undefined) {
    constraint.maxlength = body.maxLength;
  }

  const minInclusive = numericFacetValue(body.minInclusive, 'sh:minInclusive', body.term);
  if (minInclusive !== undefined) {
    constraint.mininclusive = minInclusive;
  }
  const minExclusive = numericFacetValue(body.minExclusive, 'sh:minExclusive', body.term);
  if (minExclusive !== undefined) {
    constraint.minexclusive = minExclusive;
  }
  const maxInclusive = numericFacetValue(body.maxInclusive, 'sh:maxInclusive', body.term);
  if (maxInclusive !== undefined) {
    constraint.maxinclusive = maxInclusive;
  }
  const maxExclusive = numericFacetValue(body.maxExclusive, 'sh:maxExclusive', body.term);
  if (maxExclusive !== undefined) {
    constraint.maxexclusive = maxExclusive;
  }
  exact = exact
    && (body.minInclusive === undefined) === (minInclusive === undefined)
    && (body.minExclusive === undefined) === (minExclusive === undefined)
    && (body.maxInclusive === undefined) === (maxInclusive === undefined)
    && (body.maxExclusive === undefined) === (maxExclusive === undefined);

  // Workaround kept from the original implementation: a property with exactly
  // one sh:node reference and a bare sh:nodeKind emits only the reference
  // (the target shape is taken to imply the node kind).
  const nodeKindSwallowed = body.nodeShapes.length === 1
    && body.classes.length === 0
    && constraint.nodeKind !== undefined
    && Object.keys(constraint).length === 2;
  if (Object.keys(constraint).length > 1 && !nodeKindSwallowed) {
    parts.unshift(constraint);
  }

  const negated = options.focusConstraints ? negatedNodeKind(body.nodeKind) : undefined;
  if (negated) {
    parts.push(negated);
  }

  if (options.hasValuesAsSelf) {
    for (const value of body.hasValues) {
      const mapped = valueSetValueOf(value);
      if (mapped === undefined) {
        console.warn('Skipping unmatchable blank node sh:hasValue on', body.term);
        exact = false;
      } else {
        parts.push({ type: 'NodeConstraint', values: [mapped] });
      }
    }
  }

  if (options.focusConstraints && body.classes.length > 0) {
    // A single sh:class targeted by some shape becomes a reference to that
    // shape; anything else becomes a nested `{ a [<classes>] }` shape. Note
    // that neither form applies rdfs:subClassOf* entailment (see README).
    const targetShape = body.classes.length === 1 ? targetShapes.get(body.classes[0]) : undefined;
    parts.push(targetShape ?? classShape(body.classes));
  }

  for (const nodeShape of body.nodeShapes) {
    parts.push(nodeShape);
  }

  return { parts, exact };
}

/** Combines conjuncts into a single shape expression (`ShapeAnd` when several). */
function combineParts(parts: shapeExprOrRef[]): shapeExprOrRef | undefined {
  if (parts.length === 0) {
    return undefined;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return { type: 'ShapeAnd', shapeExprs: parts };
}

/**
 * The `EXTRA` idiom for `sh:hasValue` on a property shape: a conjunct shape
 * asserting that at least one value of the predicate equals `value`, while
 * other values remain unconstrained.
 */
function hasValueConjunct(predicate: string, inverse: boolean, value: Term, diagnostic: Term): Shape | undefined {
  const mapped = valueSetValueOf(value);
  if (mapped === undefined) {
    console.warn('Skipping unmatchable blank node sh:hasValue on', diagnostic);
    return undefined;
  }
  const constraint: TripleConstraint = {
    type: 'TripleConstraint',
    predicate,
    valueExpr: { type: 'NodeConstraint', values: [mapped] },
    min: 1,
    max: -1,
  };
  if (inverse) {
    constraint.inverse = true;
    // Unmatched inbound arcs never violate a shape, so no EXTRA is needed.
    return { type: 'Shape', expression: constraint };
  }
  return { type: 'Shape', extra: [predicate], expression: constraint };
}

/**
 * Builds the triple constraint for a property shape. `valueExpr` may be
 * `undefined` (an unconstrained `.`), e.g. for a property shape carrying only
 * cardinality constraints.
 */
function tripleConstraint(
  property: ShaclProperty,
  valueExpr: shapeExprOrRef | undefined,
): TripleConstraint | undefined {
  const { path } = property;
  const min = property.minCount ?? 0;
  const max = property.maxCount ?? -1;

  // The writer requires the valueExpr key to be absent (not undefined) for an
  // unconstrained `.` value.
  const valueExprField = valueExpr === undefined ? {} : { valueExpr };

  switch (path?.kind) {
    case 'predicate':
      return {
        type: 'TripleConstraint', predicate: path.predicate, ...valueExprField, min, max,
      };
    case 'inverse':
      return {
        type: 'TripleConstraint', predicate: path.predicate, inverse: true, ...valueExprField, min, max,
      };
    case 'oneOrMore':
      if (valueExpr === undefined) {
        // Cardinality-only: sh:minCount over p+ is equivalent to a count of
        // direct p arcs when the bound is at most one.
        if (max === -1 && min <= 1) {
          return {
            type: 'TripleConstraint', predicate: path.predicate, min, max,
          };
        }
        console.warn('Skipping inexpressible cardinality over sh:oneOrMorePath on', property.term);
        return undefined;
      }
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

/** The result of converting one property shape. */
interface PropertyConversion {
  /** Triple constraints for the enclosing shape's `EachOf`. */
  constraints: TripleConstraint[];
  /** Shape-expression conjuncts for the enclosing `ShapeDecl` (EXTRA idioms). */
  conjuncts: shapeExprOrRef[];
}

/**
 * Converts one property shape, or returns `undefined` when nothing about it
 * can be represented (in which case it is skipped with a warning).
 */
function convertProperty(property: ShaclProperty, targetShapes: Map<string, string>): PropertyConversion | undefined {
  const { parts } = bodyParts(property, targetShapes, { focusConstraints: true, hasValuesAsSelf: false });
  const valueExpr = combineParts(parts);
  const conjuncts: shapeExprOrRef[] = [];

  // sh:hasValue: at least one value equals v; other values stay unconstrained
  // thanks to EXTRA, so this must not live inside the main EachOf.
  if (property.hasValues.length > 0) {
    const { path } = property;
    if (path?.kind === 'predicate' || path?.kind === 'inverse') {
      for (const value of property.hasValues) {
        const conjunct = hasValueConjunct(path.predicate, path.kind === 'inverse', value, property.term);
        if (conjunct !== undefined) {
          conjuncts.push(conjunct);
        }
      }
    } else {
      console.warn('Skipping sh:hasValue over an unsupported sh:path on', property.term);
    }
  }

  const hasExplicitCounts = property.minCount !== undefined || property.maxCount !== undefined;
  if (valueExpr === undefined && !hasExplicitCounts) {
    if (conjuncts.length > 0) {
      return { constraints: [], conjuncts };
    }
    console.warn('Unsupported property', property.term);
    return undefined;
  }

  const constraint = tripleConstraint(property, valueExpr);
  if (constraint === undefined) {
    return conjuncts.length > 0 ? { constraints: [], conjuncts } : undefined;
  }
  return { constraints: [constraint], conjuncts };
}

/**
 * Converts one node shape into a `ShapeDecl`, or returns `undefined` when the
 * shape has no representable constraints at all.
 */
function nodeShapeDecl(shape: ShaclNodeShape, targetShapes: Map<string, string>): ShapeDecl | undefined {
  const expressions: TripleConstraint[] = [];
  const conjuncts: shapeExprOrRef[] = [];
  for (const property of shape.properties) {
    const conversion = convertProperty(property, targetShapes);
    if (conversion !== undefined) {
      expressions.push(...conversion.constraints);
      conjuncts.push(...conversion.conjuncts);
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

  // Node-shape-level value constraints (sh:datatype, facets, sh:in,
  // sh:hasValue, sh:node, ...) constrain the focus node itself.
  const nodeLevel = bodyParts(shape, targetShapes, { focusConstraints: false, hasValuesAsSelf: true });

  const nodeKind = shape.nodeKind && NODE_KINDS[shape.nodeKind];
  const negatedKind = negatedNodeKind(shape.nodeKind);

  const exprs: shapeExprOrRef[] = [];
  if (nodeKind) {
    exprs.push({ type: 'NodeConstraint', nodeKind });
  }
  if (negatedKind) {
    exprs.push(negatedKind);
  }
  if (expressions.length > 0) {
    exprs.push({ type: 'Shape', expression: { type: 'EachOf', expressions } });
  }
  exprs.push(...nodeLevel.parts, ...conjuncts);

  if (exprs.length === 0) {
    console.warn('No properties found in shape', shape.id);
    return undefined;
  }
  return { id: shape.id, type: 'ShapeDecl', shapeExpr: combineParts(exprs) as shapeExpr };
}

/** Collects every shape-expression reference used inside `expr`. */
function collectReferences(expr: shapeExprOrRef | undefined, into: string[]): void {
  if (expr === undefined) {
    return;
  }
  if (typeof expr === 'string') {
    into.push(expr);
    return;
  }
  switch (expr.type) {
    case 'ShapeAnd':
    case 'ShapeOr':
      for (const child of expr.shapeExprs) {
        collectReferences(child, into);
      }
      return;
    case 'ShapeNot':
      collectReferences(expr.shapeExpr, into);
      return;
    case 'Shape': {
      const { expression } = expr;
      if (typeof expression === 'object') {
        const children = expression.type === 'TripleConstraint' ? [expression] : expression.expressions;
        for (const child of children) {
          if (typeof child === 'object' && child.type === 'TripleConstraint') {
            collectReferences(child.valueExpr, into);
          }
        }
      }
      break;
    }
    default:
  }
}

/** Whether every shape reference inside `expr` is declared. */
function referencesResolve(expr: shapeExprOrRef | undefined, ids: Set<string>): boolean {
  const references: string[] = [];
  collectReferences(expr, references);
  return references.every((reference) => ids.has(reference));
}

/**
 * Removes triple constraints (and conjunct shapes) that reference shapes
 * which are not declared in the schema, and drops shapes that become empty
 * as a result.
 */
function pruneDanglingReferences(decls: ShapeDecl[]): ShapeDecl[] {
  const ids = new Set(decls.map((decl) => decl.id));

  const pruneShape = (expr: shapeExprOrRef): shapeExprOrRef | undefined => {
    if (typeof expr !== 'object') {
      return expr;
    }
    if (expr.type === 'Shape'
      && typeof expr.expression === 'object' && expr.expression?.type === 'EachOf') {
      const eachOf = expr.expression;
      eachOf.expressions = eachOf.expressions.filter(
        (tripleExpr) => typeof tripleExpr !== 'string'
          && tripleExpr.type === 'TripleConstraint'
          && referencesResolve(tripleExpr.valueExpr, ids),
      );
      return eachOf.expressions.length > 0 ? expr : undefined;
    }
    if (expr.type === 'ShapeAnd') {
      const pruned = expr.shapeExprs
        .map(pruneShape)
        .filter((child): child is shapeExprOrRef => child !== undefined && referencesResolve(child, ids));
      if (pruned.length === 0) {
        return undefined;
      }
      if (pruned.length === 1) {
        return pruned[0];
      }
      return { ...expr, shapeExprs: pruned };
    }
    return expr;
  };

  const result: ShapeDecl[] = [];
  for (const decl of decls) {
    const pruned = pruneShape(decl.shapeExpr);
    if (pruned !== undefined) {
      result.push({ ...decl, shapeExpr: pruned as shapeExpr });
    }
  }
  return result;
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
