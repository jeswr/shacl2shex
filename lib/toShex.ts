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
  Annotation, NodeConstraint, Schema, Shape, ShapeDecl, TripleConstraint, shapeExpr, shapeExprOrRef, valueSetValue,
} from 'shexj';
import type {
  PropertyPath, ShaclNodeShape, ShaclProperty, ShaclSchema, ShaclShapeBody,
} from './model';
import { rdfType, rdfs } from './vocab';

/** Shared emission context. */
interface Context {
  /** Class IRI -> id of the shape that targets it (for `sh:class`). */
  targetShapes: Map<string, string>;
  /** Synthesized helper declarations (recursive path encodings). */
  helperDecls: ShapeDecl[];
  /** Mints deterministic ids for synthesized helper shapes. */
  nextGeneratedId: () => string;
}

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

/** A single path arc: one predicate, forward or inverse. */
interface PathStep {
  predicate: string;
  inverse: boolean;
}

/**
 * Normalizes a property path: inverses are pushed inwards (`^(p1/p2)` becomes
 * `^p2/^p1`, `^^p` becomes `p`, `^(p1|p2)` becomes `^p1|^p2`) and nested
 * sequences/alternatives are flattened, so that emission only has to deal
 * with steps and one level of composition.
 */
function normalizePath(path: PropertyPath): PropertyPath {
  switch (path.kind) {
    case 'predicate':
      return path;
    case 'inverse': {
      const inner = normalizePath(path.path);
      switch (inner.kind) {
        case 'predicate':
          return { kind: 'inverse', path: inner };
        case 'inverse':
          return inner.path;
        case 'sequence':
          return normalizePath({
            kind: 'sequence',
            paths: [...inner.paths].reverse().map((member): PropertyPath => ({ kind: 'inverse', path: member })),
          });
        case 'alternative':
          return normalizePath({
            kind: 'alternative',
            paths: inner.paths.map((member): PropertyPath => ({ kind: 'inverse', path: member })),
          });
        default:
          return { kind: inner.kind, path: normalizePath({ kind: 'inverse', path: inner.path }) };
      }
    }
    case 'sequence': {
      const paths = path.paths
        .map(normalizePath)
        .flatMap((member) => (member.kind === 'sequence' ? member.paths : [member]));
      return paths.length === 1 ? paths[0] : { kind: 'sequence', paths };
    }
    case 'alternative': {
      const paths = path.paths
        .map(normalizePath)
        .flatMap((member) => (member.kind === 'alternative' ? member.paths : [member]));
      return paths.length === 1 ? paths[0] : { kind: 'alternative', paths };
    }
    default:
      return { kind: path.kind, path: normalizePath(path.path) };
  }
}

/** The single arc a (normalized) path denotes, if it denotes one. */
function asStep(path: PropertyPath): PathStep | undefined {
  if (path.kind === 'predicate') {
    return { predicate: path.predicate, inverse: false };
  }
  if (path.kind === 'inverse' && path.path.kind === 'predicate') {
    return { predicate: path.path.predicate, inverse: true };
  }
  return undefined;
}

/** A triple constraint over one path step. */
function stepConstraint(
  step: PathStep,
  valueExpr: shapeExprOrRef | undefined,
  min: number,
  max: number,
): TripleConstraint {
  const constraint: TripleConstraint = {
    type: 'TripleConstraint', predicate: step.predicate, min, max,
  };
  if (step.inverse) {
    constraint.inverse = true;
  }
  // The writer requires the valueExpr key to be absent (not undefined) for an
  // unconstrained `.` value.
  if (valueExpr !== undefined) {
    constraint.valueExpr = valueExpr;
  }
  return constraint;
}

/**
 * The existential EXTRA idiom over one step: at least one arc has a
 * conforming value, other arcs stay unconstrained. (Unmatched inbound arcs
 * never violate a shape, so inverse steps need no EXTRA.)
 */
function extraShape(step: PathStep, valueExpr: shapeExprOrRef | undefined): Shape {
  const constraint = stepConstraint(step, valueExpr, 1, -1);
  if (step.inverse) {
    return { type: 'Shape', expression: constraint };
  }
  return { type: 'Shape', extra: [step.predicate], expression: constraint };
}

/**
 * Whether a shape expression contains negation anywhere; recursive helper
 * declarations must stay negation-free to keep the schema stratified.
 */
function containsNegation(expr: shapeExprOrRef | undefined): boolean {
  if (expr === undefined || typeof expr === 'string') {
    return false;
  }
  switch (expr.type) {
    case 'ShapeNot':
      return true;
    case 'ShapeAnd':
    case 'ShapeOr':
      return expr.shapeExprs.some(containsNegation);
    case 'Shape': {
      const { expression } = expr;
      if (typeof expression === 'object') {
        const children = expression.type === 'TripleConstraint' ? [expression] : expression.expressions;
        return children.some((child) => typeof child === 'object'
          && child.type === 'TripleConstraint'
          && containsNegation(child.valueExpr));
      }
      return false;
    }
    default:
      return false;
  }
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

/** An annotation carrying a literal (for `sh:name` / `sh:description`). */
function annotation(predicate: string, value: Term): Annotation {
  if (value.termType === 'Literal' && value.language !== '') {
    return { type: 'Annotation', predicate, object: { value: value.value, language: value.language } };
  }
  return { type: 'Annotation', predicate, object: { value: value.value } };
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

/** The result of converting a single shape into a shape expression. */
interface ExprResult {
  /** The converted expression, or `undefined` when nothing converted. */
  expr?: shapeExprOrRef;
  /** False when any constraint was skipped, weakened or approximated. */
  exact: boolean;
}

/**
 * Converts the shared constraint parameters of a shape body into a list of
 * ShEx shape-expression conjuncts. Also emits the warnings for inexpressible
 * components (`body.unsupported`).
 */
function bodyParts(body: ShaclShapeBody, ctx: Context, options: BodyOptions): PartsResult {
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
  if (nodeKindSwallowed) {
    exact = false;
  }
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
    // that neither form applies rdfs:subClassOf* entailment, and the nested
    // form does not accept multi-typed nodes (both documented in the README),
    // so the conversion is not exact.
    const targetShape = body.classes.length === 1 ? ctx.targetShapes.get(body.classes[0]) : undefined;
    parts.push(targetShape ?? classShape(body.classes));
    exact = false;
  }

  for (const nodeShape of body.nodeShapes) {
    parts.push(nodeShape);
  }

  // sh:or: all operands must convert, otherwise the disjunction as a whole is
  // skipped (dropping one operand would strengthen the constraint).
  for (const operands of body.ors) {
    // eslint-disable-next-line no-use-before-define
    const converted = operands.map((operand) => operandExpr(operand, ctx));
    const exprs = converted
      .map((result) => result.expr)
      .filter((expr): expr is shapeExprOrRef => expr !== undefined);
    if (exprs.length !== converted.length) {
      console.warn('Skipping sh:or with an unconvertible operand on', body.term);
      exact = false;
    } else {
      exact = exact && converted.every((result) => result.exact);
      parts.push(exprs.length === 1 ? exprs[0] : { type: 'ShapeOr', shapeExprs: exprs });
    }
  }

  // sh:and: an unconvertible operand may be dropped (a sound weakening).
  for (const operands of body.ands) {
    // eslint-disable-next-line no-use-before-define
    const converted = operands.map((operand) => operandExpr(operand, ctx));
    const exprs = converted
      .map((result) => result.expr)
      .filter((expr): expr is shapeExprOrRef => expr !== undefined);
    if (exprs.length !== converted.length) {
      console.warn('Dropping unconvertible sh:and operand(s) on', body.term);
      exact = false;
    }
    exact = exact && converted.every((result) => result.exact || result.expr === undefined);
    if (exprs.length === 1) {
      parts.push(exprs[0]);
    } else if (exprs.length > 1) {
      parts.push({ type: 'ShapeAnd', shapeExprs: exprs });
    }
  }

  // sh:xone: ShEx has no exclusive-or over shape expressions; approximated as
  // a plain disjunction (exclusivity is not enforced).
  for (const operands of body.xones) {
    // eslint-disable-next-line no-use-before-define
    const converted = operands.map((operand) => operandExpr(operand, ctx));
    const exprs = converted
      .map((result) => result.expr)
      .filter((expr): expr is shapeExprOrRef => expr !== undefined);
    if (exprs.length !== converted.length) {
      console.warn('Skipping sh:xone with an unconvertible operand on', body.term);
    } else {
      console.warn('Approximating sh:xone as a disjunction (exclusivity is not enforced) on', body.term);
      parts.push(exprs.length === 1 ? exprs[0] : { type: 'ShapeOr', shapeExprs: exprs });
    }
    exact = false;
  }

  // sh:not: only negate operands that converted exactly (negating a weakened
  // or strengthened operand is unsound) and that contain no shape references
  // (negated references risk unstratified negation).
  for (const operand of body.nots) {
    // eslint-disable-next-line no-use-before-define
    const converted = operandExpr(operand, ctx);
    const references: string[] = [];
    // eslint-disable-next-line no-use-before-define
    collectReferences(converted.expr, references);
    if (converted.expr === undefined || !converted.exact) {
      console.warn('Skipping sh:not over a shape that does not convert exactly on', body.term);
      exact = false;
    } else if (references.length > 0) {
      console.warn('Skipping sh:not over a shape reference on', body.term);
      exact = false;
    } else {
      parts.push({ type: 'ShapeNot', shapeExpr: converted.expr as shapeExpr });
    }
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

/** The result of converting a property shape's path + value constraint. */
interface PathConversion {
  constraints: TripleConstraint[];
  conjuncts: shapeExprOrRef[];
  exact: boolean;
}

/**
 * Builds the triple constraints (and shape-level conjuncts) that encode the
 * property shape's (normalized) `sh:path` together with its value constraint
 * and cardinalities.
 *
 * Cardinality over composite paths deserves care: SHACL counts DISTINCT nodes
 * reachable via the whole path, while ShEx counts triples matched by one
 * predicate — so `sh:maxCount` (and `sh:minCount > 1`) over
 * sequence/alternative/star paths is inexpressible and skipped with a
 * warning. `sh:minCount 1` is the salvageable existential fragment (via the
 * EXTRA/OneOf idioms), and universal value constraints transfer via nested or
 * recursive shapes.
 */
function pathTripleExprs(
  property: ShaclProperty,
  path: PropertyPath | undefined,
  valueExpr: shapeExprOrRef | undefined,
  ctx: Context,
): PathConversion | undefined {
  const min = property.minCount ?? 0;
  const max = property.maxCount ?? -1;
  const boundedCounts = property.maxCount !== undefined || min > 1;

  if (path !== undefined) {
    const step = asStep(path);
    if (step !== undefined) {
      return { constraints: [stepConstraint(step, valueExpr, min, max)], conjuncts: [], exact: true };
    }

    switch (path.kind) {
      case 'oneOrMore': {
        const inner = asStep(path.path);
        if (inner === undefined) {
          break;
        }
        if (valueExpr === undefined) {
          // Cardinality-only: sh:minCount over p+ is equivalent to a count of
          // direct p arcs when the bound is at most one.
          if (max === -1 && min <= 1) {
            return { constraints: [stepConstraint(inner, undefined, min, max)], conjuncts: [], exact: true };
          }
          console.warn('Skipping inexpressible cardinality over sh:oneOrMorePath on', property.term);
          return undefined;
        }
        // Approximated as `predicate (value | shape-that-repeats-the-path)`,
        // kept from the original implementation.
        const repeated: Shape = { type: 'Shape', expression: stepConstraint(inner, valueExpr, min, max) };
        return {
          constraints: [
            stepConstraint(inner, { type: 'ShapeOr', shapeExprs: [repeated, valueExpr] }, min, max),
          ],
          conjuncts: [],
          exact: false,
        };
      }

      case 'zeroOrMore': {
        const inner = asStep(path.path);
        if (inner === undefined) {
          break;
        }
        if (boundedCounts) {
          console.warn('Skipping inexpressible cardinality over sh:zeroOrMorePath on', property.term);
          return undefined;
        }
        if (valueExpr === undefined) {
          // minCount <= 1 over p* is vacuous: the focus node is always a
          // value node of the path.
          return { constraints: [], conjuncts: [], exact: true };
        }
        if (containsNegation(valueExpr)) {
          console.warn('Skipping sh:zeroOrMorePath whose value constraint contains negation'
            + ' (the recursive encoding must stay stratified) on', property.term);
          return undefined;
        }
        // Exact recursive encoding: <S> = V AND { p @<S> * }; the focus
        // conforming to <S> is equivalent to every p*-reachable node
        // satisfying V (ShEx recursion is coinductive, so cycles conform,
        // matching SHACL's reachable-set semantics).
        const id = ctx.nextGeneratedId();
        ctx.helperDecls.push({
          id,
          type: 'ShapeDecl',
          shapeExpr: {
            type: 'ShapeAnd',
            shapeExprs: [valueExpr, { type: 'Shape', expression: stepConstraint(inner, id, 0, -1) }],
          },
        });
        return { constraints: [], conjuncts: [id], exact: true };
      }

      case 'zeroOrOne': {
        const inner = asStep(path.path);
        if (inner === undefined) {
          break;
        }
        if (boundedCounts) {
          console.warn('Skipping inexpressible cardinality over sh:zeroOrOnePath on', property.term);
          return undefined;
        }
        if (valueExpr === undefined) {
          return { constraints: [], conjuncts: [], exact: true };
        }
        // Value nodes are the focus plus its direct p-values: V is hoisted
        // onto the enclosing shape and also constrains every p arc.
        return { constraints: [stepConstraint(inner, valueExpr, 0, -1)], conjuncts: [valueExpr], exact: true };
      }

      case 'sequence': {
        const steps = path.paths.map(asStep);
        if (!steps.every((member): member is PathStep => member !== undefined)) {
          break;
        }
        if (boundedCounts) {
          console.warn('Skipping inexpressible cardinality over a sequence sh:path on', property.term);
          return undefined;
        }
        const constraints: TripleConstraint[] = [];
        const conjuncts: shapeExprOrRef[] = [];
        if (valueExpr !== undefined) {
          // Universal fragment: every node reachable via the whole path
          // satisfies V, encoded by nesting shapes right-to-left.
          let value: shapeExprOrRef = valueExpr;
          for (let i = steps.length - 1; i > 0; i -= 1) {
            value = { type: 'Shape', expression: stepConstraint(steps[i], value, 0, -1) };
          }
          constraints.push(stepConstraint(steps[0], value, 0, -1));
        }
        if (min === 1) {
          // Existence (minCount 1): some end node exists, via nested EXTRA
          // shapes (distinct-counting collapses at one).
          let value: shapeExprOrRef | undefined = valueExpr;
          for (let i = steps.length - 1; i > 0; i -= 1) {
            value = extraShape(steps[i], value);
          }
          conjuncts.push(extraShape(steps[0], value));
        }
        return { constraints, conjuncts, exact: true };
      }

      case 'alternative': {
        const steps = path.paths.map(asStep);
        if (!steps.every((member): member is PathStep => member !== undefined)) {
          break;
        }
        if (boundedCounts) {
          console.warn('Skipping inexpressible cardinality over sh:alternativePath on', property.term);
          return undefined;
        }
        const constraints = valueExpr === undefined
          ? []
          : steps.map((member) => stepConstraint(member, valueExpr, 0, -1));
        const conjuncts: shapeExprOrRef[] = [];
        if (min === 1) {
          // Existence: one of the alternatives has a conforming value.
          const conjunct: Shape = {
            type: 'Shape',
            expression: {
              type: 'OneOf',
              expressions: steps.map((member) => stepConstraint(member, valueExpr, 1, -1)),
            },
          };
          const forward = steps.filter((member) => !member.inverse).map((member) => member.predicate);
          if (forward.length > 0) {
            conjunct.extra = forward;
          }
          conjuncts.push(conjunct);
        }
        return { constraints, conjuncts, exact: true };
      }

      default:
        break;
    }
  }

  console.warn('Unsupported sh:path on property', property.term);
  return undefined;
}

/** The result of converting one property shape. */
interface PropertyConversion {
  /** Triple constraints for the enclosing shape's `EachOf`. */
  constraints: TripleConstraint[];
  /** Shape-expression conjuncts for the enclosing `ShapeDecl` (EXTRA idioms). */
  conjuncts: shapeExprOrRef[];
  /**
   * Predicates that only occur in conjuncts and therefore must still be
   * mentioned in the main shape when it is CLOSED.
   */
  mentions: string[];
  /** False when any constraint was skipped, weakened or approximated. */
  exact: boolean;
}

/**
 * Converts one property shape, or returns `undefined` when nothing about it
 * can be represented (in which case it is skipped with a warning).
 */
function convertProperty(property: ShaclProperty, ctx: Context): PropertyConversion | undefined {
  // A deactivated shape validates nothing.
  if (property.deactivated) {
    return {
      constraints: [], conjuncts: [], mentions: [], exact: true,
    };
  }

  const { parts, exact: partsExact } = bodyParts(property, ctx, {
    focusConstraints: true,
    hasValuesAsSelf: false,
  });
  let exact = partsExact;
  const valueExpr = combineParts(parts);
  const conjuncts: shapeExprOrRef[] = [];
  const mentions: string[] = [];

  const path = property.path === undefined ? undefined : normalizePath(property.path);
  const step = path === undefined ? undefined : asStep(path);

  // sh:hasValue: at least one value equals v; other values stay unconstrained
  // thanks to EXTRA, so this must not live inside the main EachOf.
  if (property.hasValues.length > 0) {
    if (step !== undefined) {
      for (const value of property.hasValues) {
        const conjunct = hasValueConjunct(step.predicate, step.inverse, value, property.term);
        if (conjunct !== undefined) {
          conjuncts.push(conjunct);
          if (!step.inverse) {
            mentions.push(step.predicate);
          }
        } else {
          exact = false;
        }
      }
    } else {
      console.warn('Skipping sh:hasValue over an unsupported sh:path on', property.term);
      exact = false;
    }
  }

  // sh:qualifiedValueShape: some values match the qualified shape while
  // others need not — exactly ShEx's EXTRA mechanism.
  const hasQualified = property.qualifiedValueShape !== undefined
    || property.qualifiedMinCount !== undefined
    || property.qualifiedMaxCount !== undefined;
  if (hasQualified) {
    if (property.qualifiedValueShape === undefined) {
      console.warn('Skipping qualified cardinality without sh:qualifiedValueShape on', property.term);
      exact = false;
    } else if (step === undefined) {
      console.warn('Skipping sh:qualifiedValueShape over an unsupported sh:path on', property.term);
      exact = false;
    } else {
      const qualified: ExprResult = typeof property.qualifiedValueShape === 'string'
        ? { expr: property.qualifiedValueShape, exact: true }
        // eslint-disable-next-line no-use-before-define
        : operandExpr(property.qualifiedValueShape, ctx);
      if (qualified.expr === undefined) {
        console.warn('Skipping unconvertible sh:qualifiedValueShape on', property.term);
        exact = false;
      } else {
        exact = exact && qualified.exact;
        if (property.qualifiedValueShapesDisjoint) {
          console.warn('Ignoring sh:qualifiedValueShapesDisjoint (no ShEx counterpart) on', property.term);
          exact = false;
        }
        if (property.qualifiedMaxCount !== undefined) {
          console.warn('sh:qualifiedMaxCount is approximate under ShEx EXTRA semantics on', property.term);
          exact = false;
        }
        const constraint = stepConstraint(
          step,
          qualified.expr,
          property.qualifiedMinCount ?? 0,
          property.qualifiedMaxCount ?? -1,
        );
        if (step.inverse) {
          // Unmatched inbound arcs never violate a shape: no EXTRA needed.
          conjuncts.push({ type: 'Shape', expression: constraint });
        } else {
          conjuncts.push({ type: 'Shape', extra: [step.predicate], expression: constraint });
          mentions.push(step.predicate);
        }
      }
    }
  }

  const hasExplicitCounts = property.minCount !== undefined || property.maxCount !== undefined;
  if (valueExpr === undefined && !hasExplicitCounts) {
    if (conjuncts.length > 0) {
      return {
        constraints: [], conjuncts, mentions, exact,
      };
    }
    console.warn('Unsupported property', property.term);
    return undefined;
  }

  const main = pathTripleExprs(property, path, valueExpr, ctx);
  if (main === undefined) {
    if (conjuncts.length === 0) {
      return undefined;
    }
    return {
      constraints: [], conjuncts, mentions, exact: false,
    };
  }
  conjuncts.push(...main.conjuncts);

  // Non-validating metadata: sh:name / sh:description become annotations.
  const annotations = [
    ...(property.name === undefined ? [] : [annotation(rdfs.label, property.name)]),
    ...(property.description === undefined ? [] : [annotation(rdfs.comment, property.description)]),
  ];
  if (annotations.length > 0) {
    for (const constraint of main.constraints) {
      constraint.annotations = annotations;
    }
  }

  return {
    constraints: main.constraints, conjuncts, mentions, exact: exact && main.exact,
  };
}

/**
 * Merges triple constraints that share a predicate (and direction) into one:
 * SHACL evaluates every property shape against all values of its path, while
 * ShEx `EachOf` partitions the neighbourhood, so `p datatype xsd:string` and
 * `p minCount 1` in separate property shapes must become a single constraint
 * (conjoined value expression, strongest cardinality bounds).
 */
function mergeSamePredicate(constraints: TripleConstraint[]): TripleConstraint[] {
  const groups = new Map<string, TripleConstraint[]>();
  for (const constraint of constraints) {
    const key = `${constraint.inverse ? '^' : ''}${constraint.predicate}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [constraint]);
    } else {
      group.push(constraint);
    }
  }
  if (groups.size === constraints.length) {
    return constraints;
  }

  const result: TripleConstraint[] = [];
  const emitted = new Set<string>();
  for (const constraint of constraints) {
    const key = `${constraint.inverse ? '^' : ''}${constraint.predicate}`;
    if (!emitted.has(key)) {
      emitted.add(key);
      const group = groups.get(key) as TripleConstraint[];
      if (group.length === 1) {
        result.push(constraint);
      } else {
        const finiteMaxes = group.map((member) => member.max ?? -1).filter((max) => max !== -1);
        const merged: TripleConstraint = {
          type: 'TripleConstraint',
          predicate: constraint.predicate,
          min: Math.max(...group.map((member) => member.min ?? 0)),
          max: finiteMaxes.length > 0 ? Math.min(...finiteMaxes) : -1,
        };
        if (constraint.inverse) {
          merged.inverse = true;
        }
        const valueExprs = group
          .map((member) => member.valueExpr)
          .filter((valueExpr): valueExpr is shapeExprOrRef => valueExpr !== undefined);
        if (valueExprs.length === 1) {
          [merged.valueExpr] = valueExprs;
        } else if (valueExprs.length > 1) {
          merged.valueExpr = { type: 'ShapeAnd', shapeExprs: valueExprs };
        }
        result.push(merged);
      }
    }
  }
  return result;
}

/**
 * Converts the operand of a logical constraint component (`sh:or`, `sh:and`,
 * `sh:xone`, `sh:not`) into a shape expression. Operands may be property
 * shapes (`sh:path` present) or nested node shapes.
 */
function operandExpr(operand: ShaclProperty, ctx: Context): ExprResult {
  // A deactivated operand places no constraints: it converts to the empty
  // shape, which every node matches.
  if (operand.deactivated) {
    return { expr: { type: 'Shape' }, exact: true };
  }

  if (operand.path !== undefined) {
    const conversion = convertProperty(operand, ctx);
    if (conversion === undefined) {
      return { exact: false };
    }
    const parts: shapeExprOrRef[] = [];
    if (conversion.constraints.length > 0) {
      parts.push({ type: 'Shape', expression: { type: 'EachOf', expressions: conversion.constraints } });
    }
    parts.push(...conversion.conjuncts);
    return { expr: combineParts(parts), exact: conversion.exact };
  }

  const { parts, exact: partsExact } = bodyParts(operand, ctx, {
    focusConstraints: true,
    hasValuesAsSelf: true,
  });
  let exact = partsExact;

  // Nested sh:property shapes on a node-shape operand.
  const constraints: TripleConstraint[] = [];
  for (const property of operand.properties) {
    const conversion = convertProperty(property, ctx);
    if (conversion === undefined) {
      exact = false;
    } else {
      constraints.push(...conversion.constraints);
      parts.push(...conversion.conjuncts);
      exact = exact && conversion.exact;
    }
  }
  if (constraints.length > 0) {
    const nested: Shape = { type: 'Shape', expression: { type: 'EachOf', expressions: constraints } };
    if (operand.closed) {
      nested.closed = true;
    }
    parts.push(nested);
  } else if (operand.closed) {
    parts.push({ type: 'Shape', closed: true });
  }

  return { expr: combineParts(parts), exact };
}

/**
 * Converts one node shape into a `ShapeDecl`, or returns `undefined` when the
 * shape has no representable constraints at all.
 */
function nodeShapeDecl(shape: ShaclNodeShape, ctx: Context): ShapeDecl | undefined {
  // A deactivated shape conforms for every node: declare it as the empty
  // shape so that inbound references remain valid (its ShapeMap entries are
  // suppressed separately).
  if (shape.deactivated) {
    return { id: shape.id, type: 'ShapeDecl', shapeExpr: { type: 'Shape' } };
  }

  const expressions: TripleConstraint[] = [];
  const conjuncts: shapeExprOrRef[] = [];
  const mentions = new Set<string>();
  for (const property of shape.properties) {
    const conversion = convertProperty(property, ctx);
    const normalized = property.path === undefined ? undefined : normalizePath(property.path);
    if (conversion === undefined) {
      // Under CLOSED, SHACL still allows the (predicate) paths of skipped
      // property shapes, so they must stay mentioned.
      if (shape.closed && normalized?.kind === 'predicate') {
        mentions.add(normalized.predicate);
      }
    } else {
      expressions.push(...conversion.constraints);
      conjuncts.push(...conversion.conjuncts);
      for (const mention of conversion.mentions) {
        mentions.add(mention);
      }
    }
    if (shape.closed && normalized !== undefined
      && asStep(normalized) === undefined && normalized.kind !== 'zeroOrMore') {
      // SHACL's CLOSED allow-list only contains plain predicate paths; the
      // emitted constraints mention the leading predicates, which is weaker.
      console.warn('sh:closed combined with a non-predicate sh:path is approximate on', property.term);
    }
  }

  const merged = mergeSamePredicate(expressions);

  // Shape-level sh:class becomes a leading `a [<classes>]` triple constraint,
  // mirroring the property-level sh:class conversion.
  if (shape.classes.length > 0) {
    merged.unshift({
      type: 'TripleConstraint',
      predicate: rdfType,
      valueExpr: { type: 'NodeConstraint', values: shape.classes },
    });
  }

  // CLOSED: sh:ignoredProperties members and conjunct-only predicates must be
  // mentioned via unconstrained triple constraints, or the ShEx shape would
  // reject data that SHACL accepts. (EXTRA would not help: it only excuses
  // predicates that already appear in the expression.)
  if (shape.closed) {
    for (const ignored of shape.ignoredProperties) {
      mentions.add(ignored);
    }
    const covered = new Set(merged.filter((constraint) => !constraint.inverse)
      .map((constraint) => constraint.predicate));
    for (const mention of mentions) {
      if (!covered.has(mention)) {
        merged.push({
          type: 'TripleConstraint', predicate: mention, min: 0, max: -1,
        });
      }
    }
  }

  // Node-shape-level value constraints (sh:datatype, facets, sh:in,
  // sh:hasValue, sh:node, logical components, ...) constrain the focus node.
  const nodeLevel = bodyParts(shape, ctx, { focusConstraints: false, hasValuesAsSelf: true });

  const nodeKind = shape.nodeKind && NODE_KINDS[shape.nodeKind];
  const negatedKind = negatedNodeKind(shape.nodeKind);

  const exprs: shapeExprOrRef[] = [];
  if (nodeKind) {
    exprs.push({ type: 'NodeConstraint', nodeKind });
  }
  if (negatedKind) {
    exprs.push(negatedKind);
  }
  if (merged.length > 0) {
    const mainShape: Shape = { type: 'Shape', expression: { type: 'EachOf', expressions: merged } };
    if (shape.closed) {
      mainShape.closed = true;
    }
    exprs.push(mainShape);
  } else if (shape.closed) {
    // A closed shape with no representable properties rejects all outgoing
    // arcs, matching SHACL.
    exprs.push({ type: 'Shape', closed: true });
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
    // The implicit class target: a node shape that is also an rdfs:Class
    // targets (and therefore describes) its own instances.
    if (shape.implicitClassTarget) {
      targetShapes.set(shape.id, shape.id);
    }
  }

  const decls: ShapeDecl[] = [];
  for (const shape of schema.shapes) {
    // Helper declarations (recursive path encodings) get deterministic ids
    // derived from the shape they belong to, so output is stable.
    const helperDecls: ShapeDecl[] = [];
    let generated = 0;
    const ctx: Context = {
      targetShapes,
      helperDecls,
      nextGeneratedId: () => {
        const id = `${shape.id}__path_gen${generated}`;
        generated += 1;
        return id;
      },
    };
    const decl = nodeShapeDecl(shape, ctx);
    if (decl !== undefined) {
      decls.push(decl, ...helperDecls);
    }
  }

  return { type: 'Schema', shapes: pruneDanglingReferences(decls) };
}
