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
import { shaclStoreToShexSchema, writeShexSchema } from '@jeswr/shacl2shex';

// Creates the ShexJ schema
const schema = await shaclStoreToShexSchema(store);

// Writes the ShexJ schema to .shex
console.log(await writeShexSchema(schema, prefixes));
```

:warning: This library is hacked together. Unsupported features include:
 - `sh:or`, `sh:and` and `sh:xone`
 - Property paths

## CLI Usage

```
npx shacl2shex "input <filePath|directory|url>" "output <filePath|directory>"
```

e.g.

```
npx shacl2shex https://www.w3.org/ns/shacl-shacl#ShapeShape Shacl.shex"
```

## License
©2024–present
[Jesse Wright](https://github.com/jeswr),
[MIT License](https://github.com/jeswr/shacl2shex/blob/master/LICENSE).
