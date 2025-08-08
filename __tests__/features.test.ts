import { Parser, Store, DataFactory } from 'n3';
import { shaclStoreToShexSchema, writeShexSchema, shapeMapFromDataset, writeShapeMap } from '../lib';

const { namedNode } = DataFactory;

async function shexFromTtl(ttl: string, prefixes?: Record<string, string>) {
  const parser = new Parser({ format: 'text/turtle' });
  const quads = parser.parse(ttl);
  const store = new Store(quads);
  const schema = await shaclStoreToShexSchema(store as any);
  const defaultPrefixes = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
  };
  return writeShexSchema(schema, { ...defaultPrefixes, ...(prefixes || {}) });
}

describe('SHACL → ShEx features coverage', () => {
  it('maps inverse path (^)', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:TestShape a sh:NodeShape ;
        sh:property [
          sh:path [ sh:inversePath ex:child ] ;
          sh:minCount 2
        ] .
    `;
    const shex = await shexFromTtl(ttl, { ex: 'http://example.org/' });
    expect(shex.replace(/\s+/g, ' ')).toMatch(/\(\^\s*ex:child\s*\{2,\*\}\)/);
  });

  it('handles complex path (zeroOrMore) as simple predicate with cardinality', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .

      ex:TestShape a sh:NodeShape ;
        sh:property [
          sh:path [ sh:zeroOrMorePath ex:p ]
        ] .
    `;
    const shex = await shexFromTtl(ttl, { ex: 'http://example.org/' });
    expect(shex).toContain('ex:p *');
  });

  it('annotates property pair constraints (equals)', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:S a sh:NodeShape ;
        sh:property [
          sh:path ex:p1 ;
          sh:equals ex:p2 ;
          sh:datatype xsd:string
        ] .
    `;
    const shex = await shexFromTtl(ttl, { ex: 'http://example.org/' });
    expect(shex).toContain('ex:p1 xsd:string*');
    expect(shex).toContain('rdfs:comment "http://www.w3.org/ns/shacl#equals <http://example.org/p2>');
  });

  it('maps qualified value shape with annotations', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .

      ex:S a sh:NodeShape ;
        sh:property [
          sh:path ex:member ;
          sh:qualifiedValueShape [ sh:class ex:Person ] ;
          sh:qualifiedMinCount 2 ;
          sh:qualifiedValueShapesDisjoint true
        ] .
    `;
    const shex = await shexFromTtl(ttl, { ex: 'http://example.org/' });
    expect(shex).toContain('ex:member {');
    expect(shex).toContain('a [ex:Person]');
    expect(shex).toContain('{2,*}');
    expect(shex).toContain('Approximation of sh:qualified*');
    expect(shex).toContain('qualifiedValueShapesDisjoint true');
  });

  it('maps CLOSED + nodeKind with properties via ShapeAnd', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:S a sh:NodeShape ;
        sh:closed true ;
        sh:nodeKind sh:IRI ;
        sh:property [ sh:path ex:name ; sh:datatype xsd:string ] .
    `;
    const shex = await shexFromTtl(ttl, { ex: 'http://example.org/' });
    expect(shex).toContain('CLOSED');
    expect(shex).toContain('IRI  AND CLOSED {');
    expect(shex).toContain('ex:name xsd:string*');
  });

  it('maps pattern and flags and numeric facets', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:S a sh:NodeShape ;
        sh:property [ sh:path ex:code ; sh:datatype xsd:string ; sh:pattern "^[A-Z]+$" ; sh:flags "i" ] ;
        sh:property [ sh:path ex:age ; sh:datatype xsd:integer ; sh:minInclusive 3 ] .
    `;
    const shex = await shexFromTtl(ttl, { ex: 'http://example.org/' });
    expect(shex).toContain('ex:code xsd:string/^[A-Z]+$/i *');
    expect(shex).toContain('ex:age xsd:integer mininclusive 3*');
  });

  it('prefers class→shape reference via targetClass', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property [ sh:path ex:name ; sh:datatype xsd:string ] .

      ex:CompanyShape a sh:NodeShape ;
        sh:property [ sh:path ex:employees ; sh:class ex:Person ] .
    `;
    const parser = new Parser({ format: 'text/turtle' });
    const store = new Store(parser.parse(ttl));
    const schema = await shaclStoreToShexSchema(store as any);
    const text = await writeShexSchema(schema, { ex: 'http://example.org/', xsd: 'http://www.w3.org/2001/XMLSchema#' });
    expect(text).toContain('ex:employees @ex:PersonShape*');
  });

  it('emits annotation-only for deactivated shape', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .

      ex:Old a sh:NodeShape ; sh:deactivated true .
    `;
    const shex = await shexFromTtl(ttl, { ex: 'http://example.org/' });
    expect(shex).toContain('ex:Old {');
    expect(shex).toContain('rdfs:comment "sh:deactivated true');
  });

  it('shapeMapFromDataset extracts targets', async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .

      ex:S a sh:NodeShape ;
        sh:targetClass ex:A ;
        sh:targetSubjectsOf ex:likes ;
        sh:targetObjectsOf ex:knows .
    `;
    const parser = new Parser({ format: 'text/turtle' });
    const store = new Store(parser.parse(ttl));
    const sm = shapeMapFromDataset(store as any);
    const out = writeShapeMap(sm, { ex: 'http://example.org/' });
    expect(out).toContain('{FOCUS rdf:type ex:A}@ex:S');
    expect(out).toContain('{FOCUS ex:likes _}@ex:S');
    expect(out).toContain('{_ ex:knows FOCUS}@ex:S');
  });
});