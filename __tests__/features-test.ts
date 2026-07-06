/**
 * Tests for the extended SHACL -> ShEx feature coverage (beyond the historic
 * subset that the fixture suite in main-test.ts pins byte-for-byte).
 *
 * Each block feeds inline Turtle through the full pipeline and asserts on the
 * resulting ShexJ structures and/or serialized ShExC.
 */
import { Parser, Store } from 'n3';
import type {
  Shape, ShapeAnd, ShapeDecl, TripleConstraint,
} from 'shexj';
import { shaclStoreToShexSchema, shapeMapFromDataset, writeShexSchema } from '../lib';

const PREFIXES = `
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix ex: <http://example.org/>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
`;

function storeFromTurtle(turtle: string): Store {
  return new Store(new Parser().parse(PREFIXES + turtle));
}

/** The valueExpr of the sole triple constraint of the sole shape. */
function soleValueExpr(schema: { shapes?: ShapeDecl[] }): unknown {
  expect(schema.shapes).toHaveLength(1);
  const shape = schema.shapes![0].shapeExpr as Shape;
  expect(shape.type).toEqual('Shape');
  const eachOf = shape.expression as { type: string, expressions: TripleConstraint[] };
  expect(eachOf.expressions).toHaveLength(1);
  return eachOf.expressions[0].valueExpr;
}

let warn: jest.SpyInstance;
beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockRestore(); });

describe('string facets', () => {
  it('converts sh:pattern and sh:flags to a ShEx pattern facet', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:pattern "^ab.*d$"; sh:flags "i" ].
    `));
    expect(soleValueExpr(schema)).toEqual({ type: 'NodeConstraint', pattern: '^ab.*d$', flags: 'i' });
    await expect(writeShexSchema(schema, { ex: 'http://example.org/' })).resolves.toContain('/^ab.*d$/i');
  });

  it('converts sh:minLength and sh:maxLength to length facets', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:minLength 2; sh:maxLength 10 ].
    `));
    expect(soleValueExpr(schema)).toEqual({ type: 'NodeConstraint', minlength: 2, maxlength: 10 });
  });

  it('combines facets with sh:datatype in one node constraint', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:datatype xsd:string; sh:pattern "^a" ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string', pattern: '^a',
    });
  });
});

describe('range facets', () => {
  it('converts numeric sh:minInclusive / sh:maxExclusive operands', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:minInclusive 1; sh:maxExclusive 5.5 ].
    `));
    expect(soleValueExpr(schema)).toEqual({ type: 'NodeConstraint', mininclusive: 1, maxexclusive: 5.5 });
  });

  it('converts sh:minExclusive / sh:maxInclusive operands', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:minExclusive 0; sh:maxInclusive 10 ].
    `));
    expect(soleValueExpr(schema)).toEqual({ type: 'NodeConstraint', minexclusive: 0, maxinclusive: 10 });
  });

  it('warns and skips non-numeric range operands (SPARQL orders them, ShEx cannot)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p; sh:datatype xsd:dateTime;
        sh:minInclusive "2020-01-01T00:00:00Z"^^xsd:dateTime ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#dateTime',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sh:minInclusive'), expect.anything());
  });
});

describe('sh:nodeKind unions', () => {
  it('expresses sh:IRIOrLiteral as NOT bnode', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:nodeKind sh:IRIOrLiteral ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'ShapeNot', shapeExpr: { type: 'NodeConstraint', nodeKind: 'bnode' },
    });
  });

  it('expresses sh:BlankNodeOrLiteral as NOT iri, including at the node-shape level', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:nodeKind sh:BlankNodeOrLiteral;
        sh:property [ sh:path ex:p; sh:datatype xsd:string ].
    `));
    const decl = schema.shapes![0].shapeExpr as ShapeAnd;
    expect(decl.type).toEqual('ShapeAnd');
    expect(decl.shapeExprs[0]).toEqual({
      type: 'ShapeNot', shapeExpr: { type: 'NodeConstraint', nodeKind: 'iri' },
    });
  });
});

describe('sh:in', () => {
  it('emits a full value set for same-datatype literal lists without sh:datatype', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:in ("a" "b") ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint',
      values: [
        { value: 'a', type: 'http://www.w3.org/2001/XMLSchema#string' },
        { value: 'b', type: 'http://www.w3.org/2001/XMLSchema#string' },
      ],
    });
  });

  it('keeps the legacy widening to a datatype constraint when sh:datatype is present', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:datatype xsd:string; sh:in ("a" "b") ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Widening sh:in'), expect.anything());
  });

  it('emits language-tagged members with a language field, not a datatype', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:in ("chat"@fr ex:iri "x") ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint',
      values: [
        { value: 'chat', language: 'fr' },
        'http://example.org/iri',
        { value: 'x', type: 'http://www.w3.org/2001/XMLSchema#string' },
      ],
    });
  });

  it('warns about unmatchable blank nodes in sh:in and keeps the rest', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:in ([] ex:iri) ].
    `));
    expect(soleValueExpr(schema)).toEqual({ type: 'NodeConstraint', values: ['http://example.org/iri'] });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('blank node in sh:in'), expect.anything());
  });
});

describe('sh:languageIn', () => {
  it('converts language tags to LanguageStem entries (langMatches semantics)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:languageIn ("en" "fr-BE") ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint',
      values: [{ type: 'LanguageStem', stem: 'en' }, { type: 'LanguageStem', stem: 'fr-BE' }],
    });
    const shexc = await writeShexSchema(schema, { ex: 'http://example.org/' });
    expect(shexc).toContain('@en~');
  });

  it('maps the "*" wildcard to a stem matching any language-tagged literal', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:languageIn ("*") ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', values: [{ type: 'LanguageStem', stem: '' }],
    });
  });

  it('keeps sh:languageIn as a separate conjunct when sh:in is also present', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:in ("a"@en "b"@fr); sh:languageIn ("en" "fr") ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'ShapeAnd',
      shapeExprs: [
        { type: 'NodeConstraint', values: [{ value: 'a', language: 'en' }, { value: 'b', language: 'fr' }] },
        {
          type: 'NodeConstraint',
          values: [{ type: 'LanguageStem', stem: 'en' }, { type: 'LanguageStem', stem: 'fr' }],
        },
      ],
    });
  });
});

describe('sh:hasValue', () => {
  it('uses the EXTRA idiom so other values of the predicate stay unconstrained', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:gender; sh:hasValue "male" ].
    `));
    expect(schema.shapes![0].shapeExpr).toEqual({
      type: 'Shape',
      extra: ['http://example.org/gender'],
      expression: {
        type: 'TripleConstraint',
        predicate: 'http://example.org/gender',
        valueExpr: {
          type: 'NodeConstraint',
          values: [{ value: 'male', type: 'http://www.w3.org/2001/XMLSchema#string' }],
        },
        min: 1,
        max: -1,
      },
    });
    const shexc = await writeShexSchema(schema, { ex: 'http://example.org/' });
    expect(shexc).toContain('EXTRA');
  });

  it('conjoins the hasValue shape with the universal constraint on the same property', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:datatype xsd:string; sh:hasValue "male" ].
    `));
    const decl = schema.shapes![0].shapeExpr as ShapeAnd;
    expect(decl.type).toEqual('ShapeAnd');
    expect(decl.shapeExprs).toHaveLength(2);
    const [universal, existence] = decl.shapeExprs as [Shape, Shape];
    expect(universal.type).toEqual('Shape');
    expect((universal.expression as { type: string }).type).toEqual('EachOf');
    expect(existence.extra).toEqual(['http://example.org/p']);
  });

  it('applies node-shape-level sh:hasValue to the focus node itself', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:hasValue ex:me; sh:property [ sh:path ex:p; sh:nodeKind sh:IRI ].
    `));
    const decl = schema.shapes![0].shapeExpr as ShapeAnd;
    expect(decl.type).toEqual('ShapeAnd');
    expect(decl.shapeExprs[1]).toEqual({ type: 'NodeConstraint', values: ['http://example.org/me'] });
  });
});

describe('sh:node', () => {
  it('conjoins multiple sh:node references with ShapeAnd', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:A a sh:NodeShape; sh:property [ sh:path ex:x; sh:minCount 1 ].
      ex:B a sh:NodeShape; sh:property [ sh:path ex:y; sh:minCount 1 ].
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:node ex:A, ex:B ].
    `));
    const decl = schema.shapes!.find((shape) => shape.id === 'http://example.org/S')!;
    const shape = decl.shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions[0].valueExpr).toEqual({
      type: 'ShapeAnd',
      shapeExprs: ['http://example.org/A', 'http://example.org/B'],
    });
  });
});

describe('cardinality-only property shapes', () => {
  it('emits an unconstrained triple constraint for bare sh:minCount/sh:maxCount', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:minCount 1; sh:maxCount 4 ].
    `));
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions[0]).toEqual({
      type: 'TripleConstraint', predicate: 'http://example.org/p', valueExpr: undefined, min: 1, max: 4,
    });
    const shexc = await writeShexSchema(schema, { ex: 'http://example.org/' });
    expect(shexc).toContain('ex:p .');
  });
});

describe('inexpressible constraint components', () => {
  it.each([
    ['sh:equals', 'sh:equals ex:other'],
    ['sh:disjoint', 'sh:disjoint ex:other'],
    ['sh:lessThan', 'sh:lessThan ex:other'],
    ['sh:lessThanOrEquals', 'sh:lessThanOrEquals ex:other'],
    ['sh:uniqueLang', 'sh:uniqueLang true'],
  ])('warns and skips %s while converting the rest of the property', async (label, constraint) => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:datatype xsd:string; ${constraint} ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(label), expect.anything());
  });

  it('warns and skips sh:sparql on a node shape without dropping the shape', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape;
        sh:sparql [ sh:select "SELECT $this WHERE { $this ex:p ex:bad }" ];
        sh:property [ sh:path ex:p; sh:nodeKind sh:IRI ].
    `));
    expect(soleValueExpr(schema)).toEqual({ type: 'NodeConstraint', nodeKind: 'iri' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sh:sparql'), expect.anything());
  });
});

describe('sh:datatype multiplicity', () => {
  it('warns when several sh:datatype values are present and uses the first', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path ex:p; sh:datatype xsd:string, xsd:integer ].
    `));
    const valueExpr = soleValueExpr(schema) as { datatype: string };
    expect(['http://www.w3.org/2001/XMLSchema#string', 'http://www.w3.org/2001/XMLSchema#integer'])
      .toContain(valueExpr.datatype);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sh:datatype'), expect.anything());
  });
});

describe('node-shape-level value constraints', () => {
  it('applies node-level sh:datatype and facets to the focus node', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:datatype xsd:string; sh:pattern "^a".
    `));
    expect(schema.shapes![0].shapeExpr).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string', pattern: '^a',
    });
  });
});

describe('sh:or', () => {
  it('converts the datatype-union idiom to a ShapeOr of node constraints', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:or ([ sh:datatype xsd:string ] [ sh:datatype xsd:integer ])
      ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'ShapeOr',
      shapeExprs: [
        { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
        { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#integer' },
      ],
    });
  });

  it('converts property-shape operands (the one-of-these-properties idiom)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape;
        sh:or ([ sh:path ex:a; sh:minCount 1 ] [ sh:path ex:b; sh:minCount 1 ]).
    `));
    expect(schema.shapes![0].shapeExpr).toEqual({
      type: 'ShapeOr',
      shapeExprs: [
        {
          type: 'Shape',
          expression: {
            type: 'EachOf',
            expressions: [{
              type: 'TripleConstraint', predicate: 'http://example.org/a', min: 1, max: -1,
            }],
          },
        },
        {
          type: 'Shape',
          expression: {
            type: 'EachOf',
            expressions: [{
              type: 'TripleConstraint', predicate: 'http://example.org/b', min: 1, max: -1,
            }],
          },
        },
      ],
    });
  });

  it('skips the whole sh:or when an operand cannot convert (never strengthen)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:datatype xsd:string;
        sh:or ([ sh:datatype xsd:integer ] [ sh:equals ex:other ])
      ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sh:or'), expect.anything());
  });
});

describe('sh:and', () => {
  it('converts to a ShapeAnd of the operand shapes', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:and ([ sh:minLength 2 ] [ sh:maxLength 4 ])
      ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'ShapeAnd',
      shapeExprs: [
        { type: 'NodeConstraint', minlength: 2 },
        { type: 'NodeConstraint', maxlength: 4 },
      ],
    });
  });

  it('drops an unconvertible operand with a warning (a sound weakening)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:and ([ sh:minLength 2 ] [ sh:equals ex:other ])
      ].
    `));
    expect(soleValueExpr(schema)).toEqual({ type: 'NodeConstraint', minlength: 2 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sh:and'), expect.anything());
  });
});

describe('sh:not', () => {
  it('converts to ShapeNot for exactly-convertible operands', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:not [ sh:datatype xsd:string ]
      ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'ShapeNot',
      shapeExpr: { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
    });
  });

  it('refuses to negate operands that only convert approximately', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:datatype xsd:string;
        sh:not [ sh:class ex:C ]
      ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sh:not'), expect.anything());
  });
});

describe('sh:xone', () => {
  it('approximates as a ShapeOr with a warning (exclusivity is lost)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:xone ([ sh:datatype xsd:string ] [ sh:nodeKind sh:IRI ])
      ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'ShapeOr',
      shapeExprs: [
        { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
        { type: 'NodeConstraint', nodeKind: 'iri' },
      ],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sh:xone'), expect.anything());
  });
});

describe('sh:deactivated', () => {
  it('converts a deactivated node shape to the empty (match-anything) shape', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:deactivated true;
        sh:property [ sh:path ex:p; sh:minCount 5 ].
    `));
    expect(schema.shapes).toEqual([{
      id: 'http://example.org/S', type: 'ShapeDecl', shapeExpr: { type: 'Shape' },
    }]);
  });

  it('suppresses ShapeMap entries for deactivated shapes', () => {
    const store = storeFromTurtle(`
      ex:S a sh:NodeShape; sh:deactivated true; sh:targetClass ex:C.
      ex:T a sh:NodeShape; sh:targetClass ex:D.
    `);
    expect(shapeMapFromDataset(store).entries).toEqual([
      { node: 'FOCUS rdf:type <http://example.org/D>', shape: 'http://example.org/T' },
    ]);
  });

  it('skips deactivated property shapes without warnings', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape;
        sh:property [ sh:path ex:p; sh:datatype xsd:string ];
        sh:property [ sh:path ex:q; sh:deactivated true; sh:minCount 3 ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string',
    });
  });
});

describe('sh:closed', () => {
  it('emits CLOSED with sh:ignoredProperties mentioned as unconstrained constraints', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:closed true;
        sh:ignoredProperties (ex:ignored);
        sh:property [ sh:path ex:p; sh:datatype xsd:string ].
    `));
    expect(schema.shapes![0].shapeExpr).toEqual({
      type: 'Shape',
      closed: true,
      expression: {
        type: 'EachOf',
        expressions: [
          {
            type: 'TripleConstraint',
            predicate: 'http://example.org/p',
            valueExpr: { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
            min: 0,
            max: -1,
          },
          {
            type: 'TripleConstraint', predicate: 'http://example.org/ignored', min: 0, max: -1,
          },
        ],
      },
    });
    const shexc = await writeShexSchema(schema, { ex: 'http://example.org/' });
    expect(shexc).toContain('CLOSED');
  });

  it('keeps the predicates of skipped property shapes mentioned under CLOSED', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:closed true;
        sh:property [ sh:path ex:p; sh:datatype xsd:string ];
        sh:property [ sh:path ex:q; sh:equals ex:p ].
    `));
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions.map((constraint) => constraint.predicate)).toEqual([
      'http://example.org/p', 'http://example.org/q',
    ]);
    expect(eachOf.expressions[1]).toEqual({
      type: 'TripleConstraint', predicate: 'http://example.org/q', min: 0, max: -1,
    });
  });

  it('keeps hasValue-only predicates mentioned under CLOSED', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:closed true;
        sh:property [ sh:path ex:p; sh:hasValue "v" ].
    `));
    const decl = schema.shapes![0].shapeExpr as ShapeAnd;
    expect(decl.type).toEqual('ShapeAnd');
    const [main, existence] = decl.shapeExprs as [Shape, Shape];
    expect(main.closed).toBe(true);
    const eachOf = main.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions).toEqual([{
      type: 'TripleConstraint', predicate: 'http://example.org/p', min: 0, max: -1,
    }]);
    expect(existence.extra).toEqual(['http://example.org/p']);
  });
});

describe('sh:qualifiedValueShape', () => {
  it('converts qualified cardinalities via the EXTRA idiom', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:qualifiedValueShape [ sh:datatype xsd:string ];
        sh:qualifiedMinCount 1
      ].
    `));
    expect(schema.shapes![0].shapeExpr).toEqual({
      type: 'Shape',
      extra: ['http://example.org/p'],
      expression: {
        type: 'TripleConstraint',
        predicate: 'http://example.org/p',
        valueExpr: { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
        min: 1,
        max: -1,
      },
    });
  });

  it('references declared node shapes and coexists with universal constraints', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:Q a sh:NodeShape; sh:property [ sh:path ex:x; sh:minCount 1 ].
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:nodeKind sh:IRI;
        sh:qualifiedValueShape ex:Q;
        sh:qualifiedMinCount 2
      ].
    `));
    const decl = schema.shapes!.find((shape) => shape.id === 'http://example.org/S')!;
    const { shapeExprs } = decl.shapeExpr as ShapeAnd;
    expect(shapeExprs).toHaveLength(2);
    const [main, qualified] = shapeExprs as [Shape, Shape];
    const eachOf = main.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions[0].valueExpr).toEqual({ type: 'NodeConstraint', nodeKind: 'iri' });
    expect(qualified.extra).toEqual(['http://example.org/p']);
    expect(qualified.expression).toEqual({
      type: 'TripleConstraint',
      predicate: 'http://example.org/p',
      valueExpr: 'http://example.org/Q',
      min: 2,
      max: -1,
    });
  });

  it('warns that sh:qualifiedValueShapesDisjoint is ignored', async () => {
    await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path ex:p;
        sh:qualifiedValueShape [ sh:nodeKind sh:IRI ];
        sh:qualifiedMinCount 1;
        sh:qualifiedValueShapesDisjoint true
      ].
    `));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('sh:qualifiedValueShapesDisjoint'),
      expect.anything(),
    );
  });
});

describe('property paths', () => {
  it('normalizes a double inverse to a plain predicate', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path [ sh:inversePath [ sh:inversePath ex:p ] ]; sh:nodeKind sh:IRI ].
    `));
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions[0]).toEqual({
      type: 'TripleConstraint',
      predicate: 'http://example.org/p',
      min: 0,
      max: -1,
      valueExpr: { type: 'NodeConstraint', nodeKind: 'iri' },
    });
  });

  it('converts a sequence path with a universal value constraint via nested shapes', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path (ex:a ex:b); sh:datatype xsd:string ].
    `));
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions[0]).toEqual({
      type: 'TripleConstraint',
      predicate: 'http://example.org/a',
      min: 0,
      max: -1,
      valueExpr: {
        type: 'Shape',
        expression: {
          type: 'TripleConstraint',
          predicate: 'http://example.org/b',
          min: 0,
          max: -1,
          valueExpr: { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
        },
      },
    });
  });

  it('adds an EXTRA existence conjunct for a sequence path with sh:minCount 1', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [ sh:path (ex:a ex:b); sh:nodeKind sh:IRI; sh:minCount 1 ].
    `));
    const decl = schema.shapes![0].shapeExpr as ShapeAnd;
    expect(decl.type).toEqual('ShapeAnd');
    const [, existence] = decl.shapeExprs as [Shape, Shape];
    expect(existence).toEqual({
      type: 'Shape',
      extra: ['http://example.org/a'],
      expression: {
        type: 'TripleConstraint',
        predicate: 'http://example.org/a',
        min: 1,
        max: -1,
        valueExpr: {
          type: 'Shape',
          extra: ['http://example.org/b'],
          expression: {
            type: 'TripleConstraint',
            predicate: 'http://example.org/b',
            min: 1,
            max: -1,
            valueExpr: { type: 'NodeConstraint', nodeKind: 'iri' },
          },
        },
      },
    });
  });

  it('warns and skips sh:maxCount over a sequence path (distinct-node counting)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape;
        sh:property [ sh:path (ex:a ex:b); sh:nodeKind sh:IRI; sh:maxCount 2 ];
        sh:property [ sh:path ex:q; sh:nodeKind sh:IRI ].
    `));
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions.map((constraint) => constraint.predicate)).toEqual(['http://example.org/q']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cardinality'), expect.anything());
  });

  it('pushes inversion inside a sequence (inverse of sequence = reversed inverses)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path [ sh:inversePath (ex:a ex:b) ]; sh:nodeKind sh:IRI ].
    `));
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions[0]).toEqual({
      type: 'TripleConstraint',
      predicate: 'http://example.org/b',
      inverse: true,
      min: 0,
      max: -1,
      valueExpr: {
        type: 'Shape',
        expression: {
          type: 'TripleConstraint',
          predicate: 'http://example.org/a',
          inverse: true,
          min: 0,
          max: -1,
          valueExpr: { type: 'NodeConstraint', nodeKind: 'iri' },
        },
      },
    });
  });

  it('converts an alternative path universally as one constraint per branch', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path [ sh:alternativePath (ex:a ex:b) ]; sh:datatype xsd:string ].
    `));
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions).toEqual([
      {
        type: 'TripleConstraint',
        predicate: 'http://example.org/a',
        min: 0,
        max: -1,
        valueExpr: { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
      },
      {
        type: 'TripleConstraint',
        predicate: 'http://example.org/b',
        min: 0,
        max: -1,
        valueExpr: { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
      },
    ]);
  });

  it('encodes alternative-path existence with a OneOf inside an EXTRA shape', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path [ sh:alternativePath (ex:a ex:b) ]; sh:minCount 1 ].
    `));
    expect(schema.shapes![0].shapeExpr).toEqual({
      type: 'Shape',
      extra: ['http://example.org/a', 'http://example.org/b'],
      expression: {
        type: 'OneOf',
        expressions: [
          {
            type: 'TripleConstraint', predicate: 'http://example.org/a', min: 1, max: -1,
          },
          {
            type: 'TripleConstraint', predicate: 'http://example.org/b', min: 1, max: -1,
          },
        ],
      },
    });
    const shexc = await writeShexSchema(schema, { ex: 'http://example.org/' });
    expect(shexc).toContain('|');
  });

  it('encodes sh:zeroOrMorePath universally via a recursive helper shape', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path [ sh:zeroOrMorePath ex:p ]; sh:nodeKind sh:IRI ].
    `));
    const helperId = 'http://example.org/S__path_gen0';
    expect(schema.shapes!.map((decl) => decl.id)).toEqual(['http://example.org/S', helperId]);
    expect(schema.shapes![0].shapeExpr).toEqual(helperId);
    expect(schema.shapes![1].shapeExpr).toEqual({
      type: 'ShapeAnd',
      shapeExprs: [
        { type: 'NodeConstraint', nodeKind: 'iri' },
        {
          type: 'Shape',
          expression: {
            type: 'TripleConstraint',
            predicate: 'http://example.org/p',
            min: 0,
            max: -1,
            valueExpr: helperId,
          },
        },
      ],
    });
    await expect(writeShexSchema(schema, { ex: 'http://example.org/' })).resolves.toBeDefined();
  });

  it('warns and skips sh:zeroOrMorePath with bounded cardinality', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape;
        sh:property [ sh:path [ sh:zeroOrMorePath ex:p ]; sh:nodeKind sh:IRI; sh:maxCount 3 ];
        sh:property [ sh:path ex:q; sh:nodeKind sh:IRI ].
    `));
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions.map((constraint) => constraint.predicate)).toEqual(['http://example.org/q']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cardinality'), expect.anything());
  });

  it('converts sh:zeroOrOnePath by constraining the focus node and the direct values', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape; sh:property [
        sh:path [ sh:zeroOrOnePath ex:p ]; sh:datatype xsd:string ].
    `));
    const decl = schema.shapes![0].shapeExpr as ShapeAnd;
    expect(decl.type).toEqual('ShapeAnd');
    const [main, hoisted] = decl.shapeExprs as [Shape, unknown];
    const eachOf = main.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions[0]).toEqual({
      type: 'TripleConstraint',
      predicate: 'http://example.org/p',
      min: 0,
      max: -1,
      valueExpr: { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
    });
    expect(hoisted).toEqual({ type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' });
  });
});

describe('property shapes sharing a predicate', () => {
  it('merges them into one triple constraint (EachOf partitioning is weaker)', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape;
        sh:property [ sh:path ex:p; sh:datatype xsd:string ];
        sh:property [ sh:path ex:p; sh:minCount 1; sh:maxCount 5 ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string',
    });
    const shape = schema.shapes![0].shapeExpr as Shape;
    const eachOf = shape.expression as { expressions: TripleConstraint[] };
    expect(eachOf.expressions[0].min).toEqual(1);
    expect(eachOf.expressions[0].max).toEqual(5);
  });

  it('conjoins value expressions when several property shapes constrain the values', async () => {
    const schema = await shaclStoreToShexSchema(storeFromTurtle(`
      ex:S a sh:NodeShape;
        sh:property [ sh:path ex:p; sh:datatype xsd:string ];
        sh:property [ sh:path ex:p; sh:minLength 3 ].
    `));
    expect(soleValueExpr(schema)).toEqual({
      type: 'ShapeAnd',
      shapeExprs: [
        { type: 'NodeConstraint', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
        { type: 'NodeConstraint', minlength: 3 },
      ],
    });
  });
});
