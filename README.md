# SHACL to ShEx Converter

A feature-complete TypeScript library for converting SHACL (Shapes Constraint Language) shapes to ShEx (Shape Expressions) schemas.

## Features

- **Comprehensive SHACL Support**: Converts all major SHACL constructs to their ShEx equivalents
- **Functional Programming Approach**: Clean, composable functions with proper error handling
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Well-Documented**: Extensive inline documentation with links to specifications
- **Test Coverage**: Based on the official SHACL 1.1 test suite

## Installation

```bash
npm install shacl-to-shex
```

## Usage

### Basic Example

```typescript
import { convert } from 'shacl-to-shex';

const shaclShape = {
  shapes: [{
    type: "sh:NodeShape",
    id: "ex:PersonShape",
    targetClass: ["ex:Person"],
    property: [{
      type: "sh:PropertyShape",
      path: "ex:name",
      datatype: "xsd:string",
      minCount: 1,
      maxCount: 1
    }]
  }]
};

const result = convert(shaclShape);

if (result.kind === 'ok') {
  console.log(JSON.stringify(result.value, null, 2));
} else {
  console.error('Conversion failed:', result.error);
}
```

### Quick Conversion

```typescript
import { quickConvert } from 'shacl-to-shex';

const shexSchema = quickConvert(shaclShape);
console.log(shexSchema);
```

### Advanced Usage

```typescript
import { convertShaclToShex, Result } from 'shacl-to-shex';
import type { ShapesGraph } from 'shacl-to-shex/types';

const shapesGraph: ShapesGraph = {
  prefixes: [
    { prefix: "ex", namespace: "http://example.org/" },
    { prefix: "xsd", namespace: "http://www.w3.org/2001/XMLSchema#" }
  ],
  shapes: [
    // Your SHACL shapes here
  ]
};

const result = convertShaclToShex(shapesGraph);

Result.map(result, schema => {
  // Process the ShEx schema
  console.log(schema);
});
```

## Supported SHACL Features

### Core Constraints
- ✅ `sh:NodeShape` and `sh:PropertyShape`
- ✅ `sh:targetClass`, `sh:targetNode`, `sh:targetObjectsOf`, `sh:targetSubjectsOf`
- ✅ `sh:path` (predicate paths and inverse paths)
- ✅ `sh:minCount` and `sh:maxCount`
- ✅ `sh:datatype`
- ✅ `sh:nodeKind` (IRI, BlankNode, Literal, etc.)
- ✅ `sh:class`

### Value Constraints
- ✅ `sh:in` (value sets)
- ✅ `sh:hasValue`
- ✅ `sh:minInclusive`, `sh:maxInclusive`
- ✅ `sh:minExclusive`, `sh:maxExclusive`

### String Constraints
- ✅ `sh:pattern` with `sh:flags`
- ✅ `sh:minLength` and `sh:maxLength`
- ✅ `sh:languageIn`
- ✅ `sh:uniqueLang`

### Logical Constraints
- ✅ `sh:and`
- ✅ `sh:or`
- ✅ `sh:not`
- ✅ `sh:xone` (approximated)

### Shape-based Constraints
- ✅ `sh:node` (shape references)
- ✅ `sh:closed` with `sh:ignoredProperties`
- ⚠️ `sh:qualifiedValueShape` (partial support)

### Property Pair Constraints
- ⚠️ `sh:equals`, `sh:disjoint`, `sh:lessThan`, `sh:lessThanOrEquals` (mapped to semantic actions)

### Advanced Features
- ⚠️ Complex property paths (sequence, alternative, zero-or-more, etc.)
- ⚠️ SPARQL-based constraints (mapped to semantic actions)

Legend:
- ✅ Full support
- ⚠️ Partial support or requires additional processing

## Mapping Documentation

The library includes comprehensive mapping documentation between SHACL and ShEx constructs:

```typescript
import { SHACL_TO_SHEX_MAPPINGS, getMappingForShaclConstruct } from 'shacl-to-shex';

// Get mapping for a specific SHACL construct
const mapping = getMappingForShaclConstruct('sh:minCount');
console.log(mapping);
// {
//   shaclConstruct: "sh:minCount",
//   shexConstruct: "min cardinality",
//   shaclSpec: "https://www.w3.org/TR/shacl/#MinCountConstraintComponent",
//   shexSpec: "http://shex.io/shex-semantics/#cardinality",
//   notes: "sh:minCount N maps to {N,}"
// }
```

## API Reference

### Main Functions

#### `convert(input, options?)`
Converts SHACL shapes to ShEx schema.

- `input`: SHACL shapes graph (string or object)
- `options`: Optional conversion options
- Returns: `Result<Schema, ConversionError>`

#### `quickConvert(input)`
Simple conversion function that returns a string.

- `input`: SHACL shapes (string or object)
- Returns: ShEx schema as JSON string or error message

#### `isSupportedConstruct(construct)`
Check if a SHACL construct is supported.

- `construct`: SHACL construct name (e.g., "sh:minCount")
- Returns: boolean

### Types

The library exports comprehensive TypeScript types for both SHACL and ShEx:

```typescript
import type { 
  NodeShape, 
  PropertyShape, 
  ShapesGraph 
} from 'shacl-to-shex/types';

import type { 
  Schema, 
  Shape, 
  TripleConstraint 
} from 'shacl-to-shex/types';
```

### Functional Utilities

The library includes functional programming utilities:

```typescript
import { Result, Maybe, pipe, compose } from 'shacl-to-shex/utils';
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test                    # Run all tests
npm run test:coverage      # Run tests with coverage
npm run test:watch         # Run tests in watch mode
```

### Linting and Formatting

```bash
npm run lint               # Check for linting errors
npm run lint:fix          # Fix linting errors
npm run format            # Format code with Prettier
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © Jesse Wright

## References

- [SHACL 1.1 Specification](https://www.w3.org/TR/shacl/)
- [ShEx 2.1 Specification](http://shex.io/shex-semantics/)
- [SHACL Test Suite](https://github.com/w3c/data-shapes)
- [Awesome Semantic Shapes](https://github.com/janeirodigital/awesome-semantic-shapes)

## Related Projects

- [shex.js](https://github.com/shexjs/shex.js) - JavaScript implementation of ShEx
- [rudof](https://github.com/rudof-project/rudof) - Rust implementation with SHACL/ShEx support
- [SHACL Playground](https://shacl.org/playground/) - Online SHACL validator
