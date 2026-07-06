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

:warning: This library converts a pragmatic subset of SHACL. Unsupported features include:
 - `sh:or`, `sh:and` and `sh:xone`
 - Property paths other than plain predicates, `sh:inversePath` over a predicate,
   and `sh:oneOrMorePath` over a predicate (sequence, alternative, `sh:zeroOrMorePath`
   and `sh:zeroOrOnePath` paths cause the property to be skipped with a warning)

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
