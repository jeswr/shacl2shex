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
  PropertyPath, ShaclNodeKind, ShaclNodeShape, ShaclProperty, ShaclSchema,
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

/** The first object of `subject predicate ?o` parsed as an integer, if possible. */
function integerValue(store: Store, subject: Term, predicate: string): number | undefined {
  const [term] = objects(store, subject, predicate);
  if (term === undefined || term.termType !== 'Literal') {
    return undefined;
  }
  const value = Number.parseInt(term.value, 10);
  return Number.isNaN(value) ? undefined : value;
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

/** Parses a single property shape (the object of `sh:property`). */
function parseProperty(store: Store, lists: Lists, term: Term): ShaclProperty {
  const inObjects = objects(store, term, sh.in);
  return {
    term,
    path: parsePath(store, objects(store, term, sh.path)[0]),
    nodeKind: parseNodeKind(store, term),
    datatype: singleNamedNodeValue(store, term, sh.datatype),
    classes: namedNodeValues(store, term, sh.class),
    nodeShapes: objects(store, term, sh.node).map((node) => node.value),
    inValues: inObjects.length === 1 ? lists[inObjects[0].value] : undefined,
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
      id: subject.value,
      targetClasses: namedNodeValues(store, subject, sh.targetClass),
      targetSubjectsOf: namedNodeValues(store, subject, sh.targetSubjectsOf),
      targetObjectsOf: namedNodeValues(store, subject, sh.targetObjectsOf),
      nodeKind: parseNodeKind(store, subject),
      classes: namedNodeValues(store, subject, sh.class),
      properties,
    });
  }

  return { shapes };
}
