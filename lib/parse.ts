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
import { rdfType, sh } from './vocab';

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

/** The single NamedNode object of `subject predicate ?o`, if there is exactly one object. */
function singleNamedNodeValue(store: Store, subject: Term, predicate: string): string | undefined {
  const terms = objects(store, subject, predicate);
  if (terms.length === 1 && terms[0].termType === 'NamedNode') {
    return terms[0].value;
  }
  return undefined;
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

/**
 * Parses an `sh:path` object into a {@link PropertyPath}.
 *
 * Returns `undefined` for the path kinds this converter does not support
 * (sequence, alternative, `sh:zeroOrMorePath`, `sh:zeroOrOnePath`, and any
 * nested composition); the caller skips such property shapes with a warning.
 */
function parsePath(store: Store, term: Term | undefined): PropertyPath | undefined {
  if (term === undefined) {
    return undefined;
  }
  if (term.termType === 'NamedNode') {
    return { kind: 'predicate', predicate: term.value };
  }
  if (term.termType !== 'BlankNode') {
    return undefined;
  }
  const inverse = singleNamedNodeValue(store, term, sh.inversePath);
  if (inverse !== undefined) {
    return { kind: 'inverse', predicate: inverse };
  }
  const oneOrMore = singleNamedNodeValue(store, term, sh.oneOrMorePath);
  if (oneOrMore !== undefined) {
    return { kind: 'oneOrMore', predicate: oneOrMore };
  }
  return undefined;
}

/**
 * Parses the constraint parameters shared by node shapes and property shapes
 * (see {@link ShaclShapeBody}).
 */
function parseBody(store: Store, lists: Lists, term: Term): ShaclShapeBody {
  const unsupported = UNSUPPORTED_COMPONENTS
    .filter(([predicate]) => objects(store, term, predicate).length > 0)
    .map(([, label]) => label);
  if (booleanValue(store, term, sh.uniqueLang)) {
    unsupported.push('sh:uniqueLang');
  }

  return {
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
    unsupported,
  };
}

/** Parses a single property shape (the object of `sh:property`). */
function parseProperty(store: Store, lists: Lists, term: Term): ShaclProperty {
  return {
    ...parseBody(store, lists, term),
    path: parsePath(store, objects(store, term, sh.path)[0]),
    minCount: integerValue(store, term, sh.minCount),
    maxCount: integerValue(store, term, sh.maxCount),
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
    const properties: ShaclProperty[] = [];
    for (const property of objects(store, subject, sh.property)) {
      if (property.termType !== 'NamedNode' && property.termType !== 'BlankNode') {
        console.warn('Unsupported property', property);
      } else {
        properties.push(parseProperty(store, lists, property));
      }
    }

    shapes.push({
      ...parseBody(store, lists, subject),
      id: subject.value,
      targetClasses: namedNodeValues(store, subject, sh.targetClass),
      targetSubjectsOf: namedNodeValues(store, subject, sh.targetSubjectsOf),
      targetObjectsOf: namedNodeValues(store, subject, sh.targetObjectsOf),
      properties,
    });
  }

  return { shapes };
}
