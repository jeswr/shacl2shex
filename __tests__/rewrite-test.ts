/**
 * Tests for behaviour added or hardened by the clean-slate rewrite:
 * - sh:inversePath / sh:oneOrMorePath produce valid predicates (previously
 *   they emitted blank-node identifiers as the triple-constraint predicate);
 * - sh:in value sets with mixed datatypes;
 * - ShapeMap entries for sh:targetSubjectsOf / sh:targetObjectsOf;
 * - conversion stays fast on large schemas (issues addressed by #685/#686);
 * - the published package cannot break consumers via @ldo/* resolution (#344).
 */
import * as fs from 'fs';
import * as path from 'path';
import { Parser, Store } from 'n3';
import {
  shaclStoreToShexSchema, writeShexSchema, shapeMapFromDataset, writeShapeMap,
} from '../lib';

const PREFIXES = `
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix ex: <http://example.org/>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
`;

function storeFromTurtle(turtle: string): Store {
  return new Store(new Parser().parse(PREFIXES + turtle));
}

it('converts sh:inversePath to an inverse triple constraint on the inner predicate', async () => {
  const store = storeFromTurtle(`
    ex:PersonShape a sh:NodeShape;
      sh:property [ sh:path [ sh:inversePath ex:child ]; sh:nodeKind sh:IRI; sh:minCount 2; sh:maxCount 2 ].
  `);
  const schema = await shaclStoreToShexSchema(store);
  expect(schema.shapes).toEqual([{
    id: 'http://example.org/PersonShape',
    type: 'ShapeDecl',
    shapeExpr: {
      type: 'Shape',
      expression: {
        type: 'EachOf',
        expressions: [{
          type: 'TripleConstraint',
          predicate: 'http://example.org/child',
          inverse: true,
          valueExpr: { type: 'NodeConstraint', nodeKind: 'iri' },
          min: 2,
          max: 2,
        }],
      },
    },
  }]);
  await expect(writeShexSchema(schema, { ex: 'http://example.org/' })).resolves.toContain('^');
});

it('converts sh:oneOrMorePath using the inner predicate', async () => {
  const store = storeFromTurtle(`
    ex:AncestorShape a sh:NodeShape;
      sh:property [ sh:path [ sh:oneOrMorePath ex:parent ]; sh:nodeKind sh:IRI ].
  `);
  const schema = await shaclStoreToShexSchema(store);
  expect(schema.shapes).toHaveLength(1);
  const shapeExpr = schema.shapes![0].shapeExpr as {
    type: string;
    expression: { type: string; expressions: { predicate: string; valueExpr: { type: string } }[] };
  };
  const [constraint] = shapeExpr.expression.expressions;
  // The predicate must be the path's inner predicate, not a blank-node identifier.
  expect(constraint.predicate).toEqual('http://example.org/parent');
  expect(constraint.valueExpr.type).toEqual('ShapeOr');
});

it('converts an sh:in list with mixed datatypes to a value set', async () => {
  const store = storeFromTurtle(`
    ex:StatusShape a sh:NodeShape;
      sh:property [ sh:path ex:status; sh:in ( "active" true ) ].
  `);
  const schema = await shaclStoreToShexSchema(store);
  const shapeExpr = schema.shapes![0].shapeExpr as {
    type: string;
    expression: { type: string; expressions: { valueExpr: { values: unknown[] } }[] };
  };
  expect(shapeExpr.expression.expressions[0].valueExpr.values).toEqual([
    { value: 'active', type: 'http://www.w3.org/2001/XMLSchema#string' },
    { value: 'true', type: 'http://www.w3.org/2001/XMLSchema#boolean' },
  ]);
});

it('generates ShapeMap entries for sh:targetSubjectsOf and sh:targetObjectsOf', () => {
  const store = storeFromTurtle(`
    ex:SubjectShape a sh:NodeShape; sh:targetSubjectsOf ex:knows.
    ex:ObjectShape a sh:NodeShape; sh:targetObjectsOf ex:knows.
  `);
  const shapeMap = shapeMapFromDataset(store);
  expect(shapeMap.entries).toEqual([
    { node: 'FOCUS <http://example.org/knows> _', shape: 'http://example.org/SubjectShape' },
    { node: '_ <http://example.org/knows> FOCUS', shape: 'http://example.org/ObjectShape' },
  ]);

  const written = writeShapeMap(shapeMap, { ex: 'http://example.org/' });
  expect(written).toContain('{FOCUS ex:knows _}@ex:SubjectShape');
  expect(written).toContain('{_ ex:knows FOCUS}@ex:ObjectShape');
});

it('writes a placeholder for an empty ShapeMap', () => {
  expect(writeShapeMap({ entries: [] })).toEqual('# No shape mappings found\n');
});

it('converts large schemas in linear time (perf guard for the 685/686 hot paths)', async () => {
  // 60 node shapes x 10 property shapes, each with an sh:in list: the shape
  // of the benchmark from the triage issue (#687). Before the rewrite this
  // took ~57s on a 2-core box; it should now complete in well under a second.
  let turtle = '';
  for (let shape = 0; shape < 60; shape += 1) {
    turtle += `ex:Shape${shape} a sh:NodeShape; sh:targetClass ex:Class${shape}`;
    for (let property = 0; property < 10; property += 1) {
      turtle += `; sh:property [ sh:path ex:p${shape}_${property}; sh:nodeKind sh:IRI; sh:in (ex:a ex:b ex:c ex:d) ]`;
    }
    turtle += '.\n';
  }
  const store = storeFromTurtle(turtle);

  const start = Date.now();
  const schema = await shaclStoreToShexSchema(store);
  const durationMs = Date.now() - start;

  expect(schema.shapes).toHaveLength(60);
  // Generous bound to absorb CI noise; the point is to fail on a return to
  // the previous O(shapes x store size) behaviour, which took tens of seconds.
  expect(durationMs).toBeLessThan(15000);
});

it('has no @ldo/* runtime dependencies (the failure class behind #344)', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
  expect(dependencies.filter((name) => name.startsWith('@ldo/'))).toEqual([]);
});
