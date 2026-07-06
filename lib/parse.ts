/* eslint-disable no-console */
/**
 * SHACL ingestion: reads `sh:NodeShape` declarations out of an RDF store and
 * produces the intermediate model ({@link ShaclSchema}).
 *
 * All reads are direct store lookups. In particular, RDF lists are extracted
 * once per document (rather than once per property shape) and no per-shape
 * validation or dataset copying takes place, which keeps parsing linear in
 * the size of the store.
 */
import type { Term } from '@rdfjs/types';
import { DataFactory, Store } from 'n3';
import type {
  PropertyPath, ShaclNodeKind, ShaclNodeShape, ShaclProperty, ShaclSchema, ShaclShapeBody,
} from './model';
import { rdfType, rdfs, sh } from './vocab';

const { namedNode, defaultGraph } = DataFactory;

/** RDF lists in the store, keyed by the term value of the list head. */
type Lists = Record<string, Term[]>;

const NODE_KINDS: Record<string, ShaclNodeKind> = {
  [sh.IRI]: 'IRI',
  [sh.Literal]: 'Literal',
  [sh.BlankNode]: 'BlankNode',
  [sh.BlankNodeOrIRI]: 'BlankNodeOrIRI',
  [sh.IRIOrLiteral]: 'IRIOrLiteral',
  [sh.BlankNodeOrLiteral]: 'BlankNodeOrLiteral',
};

/**
 * Constraint components that ShEx has no counterpart for (cross-triple value
 * comparison and arbitrary SPARQL). Their presence is recorded on the model
 * so that emission can warn and skip them without failing the conversion.
 */
const UNSUPPORTED_COMPONENTS: [predicate: string, label: string][] = [
  [sh.equals, 'sh:equals'],
  [sh.disjoint, 'sh:disjoint'],
  [sh.lessThan, 'sh:lessThan'],
  [sh.lessThanOrEquals, 'sh:lessThanOrEquals'],
  [sh.sparql, 'sh:sparql'],
];

/** All objects of `subject predicate ?o` in the default graph, in store order. */
function objects(store: Store, subject: Term, predicate: string): Term[] {
  return store.getObjects(subject, namedNode(predicate), defaultGraph());
}

/** The values of all NamedNode objects of `subject predicate ?o`. */
function namedNodeValues(store: Store, subject: Term, predicate: string): string[] {
  return objects(store, subject, predicate)
    .filter((term) => term.termType === 'NamedNode')
    .map((term) => term.value);
}

/** The first NamedNode object of `subject predicate ?o`; warns when there are several. */
function firstNamedNodeValue(store: Store, subject: Term, predicate: string, label: string): string | undefined {
  const terms = objects(store, subject, predicate).filter((term) => term.termType === 'NamedNode');
  if (terms.length > 1) {
    console.warn(`Expected at most one ${label} on`, subject);
  }
  return terms.length > 0 ? terms[0].value : undefined;
}

/** The first Literal object of `subject predicate ?o`, as a string. */
function literalValue(store: Store, subject: Term, predicate: string): string | undefined {
  const term = objects(store, subject, predicate).find((object) => object.termType === 'Literal');
  return term?.value;
}

/** The first Literal object of `subject predicate ?o`, as a term. */
function literalTerm(store: Store, subject: Term, predicate: string): Term | undefined {
  return objects(store, subject, predicate).find((object) => object.termType === 'Literal');
}

/** The first object of `subject predicate ?o` parsed as an integer, if possible. */
function integerValue(store: Store, subject: Term, predicate: string): number | undefined {
  const [term] = objects(store, subject, predicate);
  if (term === undefined || term.termType !== 'Literal') {
    return undefined;
  }
  const value = Number.parseInt(term.value, 10);
  return Number.isNaN(value) ? undefined : value;
}

/** Whether `subject predicate true` is asserted. */
function booleanValue(store: Store, subject: Term, predicate: string): boolean {
  return objects(store, subject, predicate)
    .some((term) => term.termType === 'Literal' && term.value === 'true');
}

/** The recognised `sh:nodeKind` of a shape, when exactly one is present. */
function parseNodeKind(store: Store, subject: Term): ShaclNodeKind | undefined {
  const terms = objects(store, subject, sh.nodeKind);
  if (terms.length === 1 && terms[0].termType === 'NamedNode') {
    return NODE_KINDS[terms[0].value];
  }
  if (terms.length > 1) {
    console.warn('Expected at most one sh:nodeKind on', subject);
  }
  return undefined;
}

/** The members of the first resolvable RDF list object of `subject predicate ?o`. */
function listMembers(store: Store, lists: Lists, subject: Term, predicate: string): Term[] | undefined {
  const heads = objects(store, subject, predicate);
  return heads.length === 1 ? lists[heads[0].value] : undefined;
}

/** The unary SHACL path constructors. */
const UNARY_PATHS: [predicate: string, kind: 'inverse' | 'zeroOrMore' | 'oneOrMore' | 'zeroOrOne'][] = [
  [sh.inversePath, 'inverse'],
  [sh.zeroOrMorePath, 'zeroOrMore'],
  [sh.oneOrMorePath, 'oneOrMore'],
  [sh.zeroOrOnePath, 'zeroOrOne'],
];

/**
 * Parses an `sh:path` object into a {@link PropertyPath}, or returns
 * `undefined` when the path is not well-formed; the caller skips such
 * property shapes with a warning.
 */
function parsePath(store: Store, lists: Lists, term: Term | undefined): PropertyPath | undefined {
  if (term === undefined) {
    return undefined;
  }
  if (term.termType === 'NamedNode') {
    return { kind: 'predicate', predicate: term.value };
  }
  if (term.termType !== 'BlankNode') {
    return undefined;
  }

  // A sequence path is an RDF list of paths.
  const members = lists[term.value];
  if (members !== undefined) {
    const paths = members.map((member) => parsePath(store, lists, member));
    return paths.every((path): path is PropertyPath => path !== undefined) && paths.length > 0
      ? { kind: 'sequence', paths }
      : undefined;
  }

  for (const [predicate, kind] of UNARY_PATHS) {
    const [inner] = objects(store, term, predicate);
    if (inner !== undefined) {
      const path = parsePath(store, lists, inner);
      return path === undefined ? undefined : { kind, path };
    }
  }

  const [alternatives] = objects(store, term, sh.alternativePath);
  if (alternatives !== undefined) {
    const alternativeMembers = lists[alternatives.value];
    if (alternativeMembers === undefined) {
      return undefined;
    }
    const paths = alternativeMembers.map((member) => parsePath(store, lists, member));
    return paths.every((path): path is PropertyPath => path !== undefined) && paths.length > 0
      ? { kind: 'alternative', paths }
      : undefined;
  }

  return undefined;
}

/**
 * Parses the constraint parameters shared by node shapes and property shapes
 * (see {@link ShaclShapeBody}). `seen` guards the recursion into the logical
 * components against cyclic shape definitions.
 */
function parseBody(store: Store, lists: Lists, term: Term, seen: Set<string>): ShaclShapeBody {
  const unsupported = UNSUPPORTED_COMPONENTS
    .filter(([predicate]) => objects(store, term, predicate).length > 0)
    .map(([, label]) => label);
  if (booleanValue(store, term, sh.uniqueLang)) {
    unsupported.push('sh:uniqueLang');
  }

  seen.add(term.value);

  // The operands of the logical components are themselves shapes; each list
  // of operands is parsed recursively, cutting off on cycles.
  const operandLists = (predicate: string, label: string): ShaclProperty[][] => {
    const result: ShaclProperty[][] = [];
    for (const head of objects(store, term, predicate)) {
      const members = lists[head.value];
      if (members === undefined) {
        console.warn(`Could not resolve the ${label} operand list on`, term);
        unsupported.push(label);
      } else if (members.some((member) => seen.has(member.value))) {
        console.warn(`Skipping cyclic ${label} on`, term);
        unsupported.push(label);
      } else {
        // eslint-disable-next-line no-use-before-define
        result.push(members.map((member) => parseProperty(store, lists, member, seen)));
      }
    }
    return result;
  };

  const nots: ShaclProperty[] = [];
  for (const operand of objects(store, term, sh.not)) {
    if (seen.has(operand.value)) {
      console.warn('Skipping cyclic sh:not on', term);
      unsupported.push('sh:not');
    } else {
      // eslint-disable-next-line no-use-before-define
      nots.push(parseProperty(store, lists, operand, seen));
    }
  }

  const properties: ShaclProperty[] = [];
  for (const property of objects(store, term, sh.property)) {
    if (property.termType !== 'NamedNode' && property.termType !== 'BlankNode') {
      console.warn('Unsupported property', property);
    } else if (seen.has(property.value)) {
      console.warn('Skipping cyclic sh:property on', term);
    } else {
      // eslint-disable-next-line no-use-before-define
      properties.push(parseProperty(store, lists, property, seen));
    }
  }

  const body: ShaclShapeBody = {
    term,
    nodeKind: parseNodeKind(store, term),
    datatype: firstNamedNodeValue(store, term, sh.datatype, 'sh:datatype'),
    classes: namedNodeValues(store, term, sh.class),
    nodeShapes: objects(store, term, sh.node).map((node) => node.value),
    inValues: listMembers(store, lists, term, sh.in),
    hasValues: objects(store, term, sh.hasValue),
    pattern: literalValue(store, term, sh.pattern),
    flags: literalValue(store, term, sh.flags),
    minLength: integerValue(store, term, sh.minLength),
    maxLength: integerValue(store, term, sh.maxLength),
    minInclusive: literalTerm(store, term, sh.minInclusive),
    minExclusive: literalTerm(store, term, sh.minExclusive),
    maxInclusive: literalTerm(store, term, sh.maxInclusive),
    maxExclusive: literalTerm(store, term, sh.maxExclusive),
    languageIn: listMembers(store, lists, term, sh.languageIn)
      ?.filter((member) => member.termType === 'Literal')
      .map((member) => member.value),
    ors: operandLists(sh.or, 'sh:or'),
    ands: operandLists(sh.and, 'sh:and'),
    xones: operandLists(sh.xone, 'sh:xone'),
    nots,
    properties,
    deactivated: booleanValue(store, term, sh.deactivated) || undefined,
    closed: booleanValue(store, term, sh.closed) || undefined,
    ignoredProperties: listMembers(store, lists, term, sh.ignoredProperties)
      ?.filter((member) => member.termType === 'NamedNode')
      .map((member) => member.value) ?? [],
    unsupported,
  };

  seen.delete(term.value);
  return body;
}

/**
 * Parses the object of `sh:qualifiedValueShape`: a reference when it names a
 * declared node shape, otherwise the inline shape.
 */
function parseQualifiedValueShape(
  store: Store,
  lists: Lists,
  term: Term,
  seen: Set<string>,
): ShaclProperty | string | undefined {
  const [shape] = objects(store, term, sh.qualifiedValueShape);
  if (shape === undefined) {
    return undefined;
  }
  if (shape.termType === 'NamedNode'
    && store.countQuads(shape, namedNode(rdfType), namedNode(sh.NodeShape), defaultGraph()) > 0) {
    return shape.value;
  }
  if (seen.has(shape.value)) {
    console.warn('Skipping cyclic sh:qualifiedValueShape on', term);
    return undefined;
  }
  // eslint-disable-next-line no-use-before-define
  return parseProperty(store, lists, shape, seen);
}

/**
 * Parses a single shape that may carry an `sh:path` (a property shape or a
 * logical-component operand).
 */
function parseProperty(store: Store, lists: Lists, term: Term, seen: Set<string>): ShaclProperty {
  seen.add(term.value);
  const qualifiedValueShape = parseQualifiedValueShape(store, lists, term, seen);
  seen.delete(term.value);
  return {
    ...parseBody(store, lists, term, seen),
    path: parsePath(store, lists, objects(store, term, sh.path)[0]),
    minCount: integerValue(store, term, sh.minCount),
    maxCount: integerValue(store, term, sh.maxCount),
    qualifiedValueShape,
    qualifiedMinCount: integerValue(store, term, sh.qualifiedMinCount),
    qualifiedMaxCount: integerValue(store, term, sh.qualifiedMaxCount),
    qualifiedValueShapesDisjoint: booleanValue(store, term, sh.qualifiedValueShapesDisjoint) || undefined,
    name: literalTerm(store, term, sh.name),
    description: literalTerm(store, term, sh.description),
  };
}

/**
 * Parses every `sh:NodeShape` in the default graph of `store` into the
 * intermediate model. Shapes and their properties are returned in store
 * order, so downstream output is deterministic for a given input document.
 */
export function parseShaclSchema(store: Store): ShaclSchema {
  const lists: Lists = store.extractLists();
  const shapes: ShaclNodeShape[] = [];

  for (const { subject } of store.match(null, namedNode(rdfType), namedNode(sh.NodeShape), defaultGraph())) {
    shapes.push({
      ...parseBody(store, lists, subject, new Set()),
      id: subject.value,
      targetClasses: namedNodeValues(store, subject, sh.targetClass),
      targetSubjectsOf: namedNodeValues(store, subject, sh.targetSubjectsOf),
      targetObjectsOf: namedNodeValues(store, subject, sh.targetObjectsOf),
      targetNodes: objects(store, subject, sh.targetNode)
        .filter((node) => node.termType === 'NamedNode' || node.termType === 'Literal'),
      implicitClassTarget: subject.termType === 'NamedNode'
        && store.countQuads(subject, namedNode(rdfType), namedNode(rdfs.Class), defaultGraph()) > 0
        ? true
        : undefined,
    });
  }

  return { shapes };
}
