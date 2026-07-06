# shacl2shex

Convert basic SHACL shapes to ShEx

[![GitHub license](https://img.shields.io/github/license/jeswr/shacl2shex.svg)](https://github.com/jeswr/shacl2shex/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/@jeswr/shacl2shex.svg)](https://www.npmjs.com/package/@jeswr/shacl2shex)
[![build](https://img.shields.io/github/actions/workflow/status/jeswr/shacl2shex/nodejs.yml?branch=main)](https://github.com/jeswr/shacl2shex/tree/main/)
[![Dependabot](https://badgen.net/badge/Dependabot/enabled/green?icon=dependabot)](https://dependabot.com/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Usage
```ts
import { DatasetCore } from '@rdfjs/types';
import { shaclStoreToShexSchema, writeShexSchema, shapeMapFromDataset, writeShapeMap } from '@jeswr/shacl2shex';

// Creates the ShexJ schema
const schema = await shaclStoreToShexSchema(store);

// Writes the ShexJ schema to .shex
console.log(await writeShexSchema(schema, prefixes));

// Extract ShapeMap from SHACL target classes (resolves issue #283)
const shapeMap = shapeMapFromDataset(store);

// Write ShapeMap to string format
console.log(writeShapeMap(shapeMap, prefixes));
```

## Feature coverage

The converter maps the SHACL-core constraint components onto ShEx as faithfully as
the ShEx semantics allow. Anything it cannot express is **skipped with a
`console.warn`** naming the shape/property, never a crash; the rest of the shape
still converts.

| SHACL | ShEx mapping | Fidelity |
|---|---|---|
| `sh:minCount` / `sh:maxCount` | `TripleConstraint` min/max (absent → `0`/`*`) | exact for predicate & inverse paths |
| `sh:datatype` | `NodeConstraint` datatype | exact (several values: first wins, warns) |
| `sh:nodeKind` (all six kinds) | `IRI`/`LITERAL`/`BNODE`/`NONLITERAL`; `sh:IRIOrLiteral` → `NOT BNODE`, `sh:BlankNodeOrLiteral` → `NOT IRI` | exact |
| `sh:class` | reference to the shape whose `sh:targetClass` (or implicit class target) matches, else a nested `{ a [<classes>] }` shape | best-effort: **no `rdfs:subClassOf*` entailment**, and the nested form expects exactly one `rdf:type` arc, so multi-typed nodes fail it |
| `sh:node` | shape reference(s); several values conjoin via `AND` | bounded by the referenced shape's conversion |
| `sh:in` | value set (`[...]`); language-tagged members keep their tag | exact, except: blank-node members warn-and-drop, and with an explicit `sh:datatype` the legacy behaviour of widening to the bare datatype constraint is kept (warned) |
| `sh:hasValue` | `EXTRA <p>` + `<p> [v] +` conjunct shape | exact |
| `sh:pattern` + `sh:flags` | `/pattern/flags` string facet | exact (both use XPath `fn:matches`) |
| `sh:minLength` / `sh:maxLength` | `MINLENGTH` / `MAXLENGTH` | exact |
| `sh:minInclusive` etc. (4 range components) | numeric facets | exact for numeric operands; temporal/string/boolean operands warn-and-skip (ShEx facets are numbers-only) |
| `sh:languageIn` | value set of language stems (`[@en~ ...]`, `langMatches` semantics; `"*"` → any tag) | exact |
| `sh:or` | `OR` of the converted operands (value shapes *or* property shapes) | exact modulo operand fidelity; if **any** operand fails, the whole `sh:or` is skipped (dropping one operand would strengthen it) |
| `sh:and` | `AND` of the converted operands | unconvertible operands drop with a warning (sound weakening) |
| `sh:not` | `NOT`, only when the operand converted **exactly** and contains no shape references (stratified negation) | exact when emitted; otherwise warn-and-skip |
| `sh:xone` | `OR` + warning | exclusivity is **not** enforced |
| `sh:closed` + `sh:ignoredProperties` | `CLOSED`; ignored/skipped/conjunct-only predicates stay mentioned via `<p> . *` | exact for predicate paths |
| `sh:qualifiedValueShape` + min/max | triple constraint in an `EXTRA` conjunct shape | exact for `qualifiedMinCount`; `qualifiedMaxCount` approximate (warns); `sh:qualifiedValueShapesDisjoint` ignored (warns) |
| `sh:deactivated` | empty (match-anything) shape declaration; ShapeMap entries suppressed | exact |
| `sh:name` / `sh:description` | `rdfs:label` / `rdfs:comment` annotations (`// ...`) | non-validating metadata |
| several property shapes on one predicate | merged into one triple constraint (`AND` of value exprs, strongest bounds) | exact (avoids `EachOf` partition semantics) |
| targets (`sh:targetClass`, `sh:targetNode`, `sh:targetSubjectsOf`, `sh:targetObjectsOf`, implicit class target) | ShapeMap entries (`shapeMapFromDataset`) | exact — ShEx schemas have no targets |

Property paths (normalized first: `^^p` → `p`, `^(p1/p2)` → `^p2/^p1`, `^(p1\|p2)` → `^p1\|^p2`, nested sequences/alternatives flattened):

| Path | ShEx mapping | Fidelity |
|---|---|---|
| predicate / `sh:inversePath` over one | `TripleConstraint` (`inverse` for `^p`) | exact incl. cardinalities |
| sequence `p1/p2/...` | universal constraints via nested shapes; `minCount 1` via nested `EXTRA` shapes | exact; `maxCount` / `minCount > 1` warn-and-skip (SHACL counts distinct end nodes) |
| `sh:alternativePath` | universal: one constraint per branch; `minCount 1`: `OneOf` inside an `EXTRA` shape | exact; bounded counts warn-and-skip |
| `sh:zeroOrMorePath` | recursive helper shape `<S> = V AND { p @<S> * }` (deterministic `<shape>__path_gen<n>` ids) | exact for negation-free universal constraints; bounded counts warn-and-skip |
| `sh:oneOrMorePath` | historic one-level unrolling `p (V OR { p V })` | **approximation** (depth ≥ 2 chains are not fully checked) |
| `sh:zeroOrOnePath` | value constraint hoisted onto the focus + universal constraint on direct arcs | exact; `maxCount` warn-and-skip |
| other nested compositions | — | warn-and-skip |

**Not expressible in ShEx** (always warn-and-skip, the rest of the shape still
converts): `sh:equals`, `sh:disjoint`, `sh:lessThan`, `sh:lessThanOrEquals`,
`sh:uniqueLang`, `sh:sparql` / SHACL-SPARQL components, and the disjointness
semantics of `sh:qualifiedValueShapesDisjoint`. These all require cross-triple
value comparison or arbitrary computation, which ShEx does not have.
`sh:severity` / `sh:message` are not read: shapes with `sh:severity sh:Warning`
or `sh:Info` convert as hard constraints (ShEx conformance is boolean).

Two further global caveats: ShEx validates the data graph *as asserted* (no
RDFS/OWL entailment anywhere), and `sh:class` → target-shape references
substitute the full target shape for a plain type check.

## Architecture

The conversion is a two-stage pipeline with a plain-data intermediate model in between:

```
SHACL ingestion            intermediate model          ShEx emission
lib/parse.ts        →      lib/model.ts         →      lib/toShex.ts
(parseShaclSchema)         (ShaclSchema)               (shexSchemaFromShacl)
```

- `lib/parse.ts` reads `sh:NodeShape` declarations out of an N3 store with direct
  store lookups (RDF lists are extracted once per document, no per-shape validation).
- `lib/model.ts` is the typed intermediate model — plain data, no store access.
- `lib/toShex.ts` maps the model onto a ShexJ `Schema`.
- `lib/writeShex.ts` and `lib/shapeMap.ts` serialize schemas and ShapeMaps.
- `lib/bin/index.ts` is the CLI.

`parseShaclSchema` and `shexSchemaFromShacl` are exported for advanced use alongside
the main `shaclStoreToShexSchema` entry point.

## CLI Usage

```
npx @jeswr/shacl2shex "input <filePath|directory|url>" "output <filePath|directory>" [--shapemap|-s]
```

**Options:**
- `--shapemap, -s`: Generate a ShapeMap file alongside the ShEx output. The ShapeMap preserves SHACL target class information (from `sh:targetClass`) which is otherwise lost in the ShEx conversion.

e.g.

```
npx @jeswr/shacl2shex https://www.w3.org/ns/shacl-shacl#ShapeShape Shacl.shex
npx @jeswr/shacl2shex shapes.shaclc output.shex --shapemap
```

## ShapeMap Generation

As of version X.X.X, this library can generate ShapeMap files to preserve SHACL target information that would otherwise be lost during ShEx conversion.

SHACL's `sh:targetClass` specifies which RDF classes a shape should validate. Since ShEx doesn't have a direct equivalent, this information is typically lost. ShapeMaps provide a way to specify which nodes should be validated against which shapes.

### Example

Given this SHACL:
```shaclc
shape ex:PersonShape -> ex:Person {
    ex:name xsd:string [1..1] .
}
```

The tool generates:
1. **ShEx file** (`output.shex`):
```shex
ex:PersonShape {
    (ex:name xsd:string{1,1})
}
```

2. **ShapeMap file** (`output.shapemap`):
```
{FOCUS rdf:type ex:Person}@ex:PersonShape
```

The ShapeMap can be used with ShEx validators to specify that nodes of type `ex:Person` should be validated against `ex:PersonShape`.

## License
©2024–present
[Jesse Wright](https://github.com/jeswr),
[MIT License](https://github.com/jeswr/shacl2shex/blob/master/LICENSE).
