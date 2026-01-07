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

## Supported Features

This library now supports comprehensive SHACL to ShEx conversion including:

- **Logical operators**: `sh:or`, `sh:and`, `sh:xone` (xone approximated as OR), `sh:not`
- **Property paths**: `sh:inversePath`, `sh:alternativePath`, `sh:oneOrMorePath`, `sh:zeroOrMorePath`, `sh:zeroOrOnePath`
- **Value constraints**: `sh:datatype`, `sh:class`, `sh:nodeKind`, `sh:in`, `sh:hasValue`
- **String constraints**: `sh:minLength`, `sh:maxLength`, `sh:pattern` (with `sh:flags`)
- **Numeric constraints**: `sh:minInclusive`, `sh:maxInclusive`, `sh:minExclusive`, `sh:maxExclusive`
- **Cardinality constraints**: `sh:minCount`, `sh:maxCount`
- **Target definitions**: `sh:targetClass`, `sh:targetNode`, `sh:targetObjectsOf`, `sh:targetSubjectsOf`

**Note**: Some SHACL features have semantic differences when mapped to ShEx:
- `sh:xone` (exclusive or) is approximated using ShEx OR, as ShEx doesn't have native exclusive or semantics
- Sequence property paths have limited support
- SHACL comparison constraints (`sh:equals`, `sh:disjoint`, `sh:lessThan`, etc.) are not directly expressible in ShEx
- `sh:closed` and `sh:uniqueLang` have limited ShEx equivalents

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
