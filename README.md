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

:warning: This library is hacked together. Unsupported features include:
 - Property paths
 - Some advanced SHACL features

## Supported Logical Constraints

As of version X.X.X, this library supports SHACL logical constraints with mappings to ShEx operators:

### SHACL to ShEx Mappings

| SHACL Constraint | ShEx Operator | Description |
|-----------------|---------------|-------------|
| `sh:and` | `AND` | All shapes must be satisfied (per [SHACL spec §4.6.2](https://www.w3.org/TR/shacl/#AndConstraintComponent)) |
| `sh:or` | `OR` | At least one shape must be satisfied (per [SHACL spec §4.6.3](https://www.w3.org/TR/shacl/#OrConstraintComponent)) |
| `sh:not` | `NOT` | The shape must not be satisfied (per [SHACL spec §4.6.1](https://www.w3.org/TR/shacl/#NotConstraintComponent)) |
| `sh:xone` | Complex expression | Exactly one shape must be satisfied (per [SHACL spec §4.6.4](https://www.w3.org/TR/shacl/#XoneConstraintComponent)) |

### Examples

**SHACL with `sh:and`:**
```turtle
ex:PersonShape a sh:NodeShape ;
  sh:and (ex:NameConstraint ex:AgeConstraint) .
```

**Converts to ShEx:**
```shex
ex:PersonShape @ex:NameConstraint AND @ex:AgeConstraint
```

**SHACL with `sh:xone` (exactly one):**
```turtle
ex:ContactShape a sh:NodeShape ;
  sh:xone (ex:EmailOnly ex:PhoneOnly ex:AddressOnly) .
```

**Converts to ShEx (using De Morgan's laws):**
```shex
ex:ContactShape @ex:EmailOnly AND NOT (@ex:PhoneOnly OR @ex:AddressOnly) OR 
                @ex:PhoneOnly AND NOT (@ex:EmailOnly OR @ex:AddressOnly) OR 
                @ex:AddressOnly AND NOT (@ex:EmailOnly OR @ex:PhoneOnly)
```

### Implementation Notes

- The implementation follows the SHACL specification for logical constraints ([§4.6](https://www.w3.org/TR/shacl/#core-components-logical))
- ShEx logical operators are used as defined in the [ShEx specification §5.3](https://shex.io/shex-semantics/#prod-shapeOr)
- `sh:xone` is implemented using a combination of AND, OR, and NOT operators since ShEx doesn't have a native XOR operator

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
