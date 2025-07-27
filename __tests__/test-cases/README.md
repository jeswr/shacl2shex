# SHACL to ShEx Test Cases

This directory contains test cases for SHACL to ShEx conversion, including:

1. **SHACL 1.1 Test Suite Cases**: Based on the official W3C SHACL test suite
2. **Discovered Test Cases**: From other SHACL/ShEx converters and libraries
3. **Custom Test Cases**: Additional edge cases and complex scenarios

## Test Case Sources

### 1. W3C SHACL Test Suite
- Source: https://github.com/w3c/data-shapes
- Location: `data-shapes-gh-pages/shacl12-test-suite/tests/`
- Coverage: Core constraints, property shapes, node shapes, logical constraints

### 2. Rudof Library (Rust)
- Source: https://github.com/rudof-project/rudof
- Features: SHACL to ShEx conversion in Rust
- Notable test cases:
  - Complex property paths
  - Recursive shapes
  - SPARQL-based constraints

### 3. ShEx.js Library
- Source: https://github.com/shexjs/shex.js
- Features: ShEx validator and utilities
- Test cases for ShEx validation that can inform conversion

### 4. SHACL Playground
- Source: https://shacl.org/playground/
- Interactive examples of SHACL shapes

## Test Organization

Tests are organized by SHACL feature:

- `cardinality/` - minCount, maxCount constraints
- `datatype/` - datatype and nodeKind constraints
- `string/` - pattern, minLength, maxLength constraints
- `numeric/` - minInclusive, maxInclusive, etc.
- `logical/` - and, or, not, xone constraints
- `shape-reference/` - node constraints and shape references
- `closed/` - closed shapes with ignoredProperties
- `language/` - languageIn, uniqueLang constraints
- `complex/` - complex real-world examples

## Test Format

Each test case includes:
1. Input SHACL shape (JSON-LD format)
2. Expected ShEx output (JSON format)
3. Test data for validation (optional)
4. Notes on mapping decisions

## Running Tests

```bash
npm test                    # Run all tests
npm test -- --coverage     # Run with coverage
npm test -- --watch        # Run in watch mode
```

## Adding New Test Cases

When adding new test cases:
1. Create appropriate directory structure
2. Include both SHACL input and expected ShEx output
3. Document any special mapping considerations
4. Add to the test suite in `__tests__/converters/`