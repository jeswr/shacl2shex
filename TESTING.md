# Testing Guide

This library includes comprehensive tests to ensure both CommonJS and ESM builds work correctly.

## Test Structure

### Main Tests
- `npm test` - Runs the main test suite including functionality tests and CLI tests
- `npm run test:coverage` - Runs main tests with coverage reporting

### Module Format Tests
These tests verify that the dual package setup works correctly:

- `npm run test:cjs` - Tests CommonJS module format
  - Verifies `require()` works correctly
  - Tests destructuring imports
  - Validates sub-module loading
  - Checks module caching behavior

- `npm run test:esm` - Tests ES Module format
  - Verifies `import` statements work correctly
  - Tests named imports
  - Validates relative imports have `.js` extensions
  - Tests dynamic imports

- `npm run test:exports` - Tests package.json exports field
  - Verifies correct module resolution
  - Tests main/module/types fields
  - Validates exports field structure

- `npm run test:typescript` - Tests TypeScript compatibility
  - Verifies type definitions are available
  - Tests type exports
  - Validates .d.ts files exist in both builds

### Running All Tests
- `npm run test:modules` - Runs all module format tests
- `npm run test:all` - Runs main tests followed by module format tests

## Test Files

- `__tests__/main-test.ts` - Main functionality and CLI tests
- `__tests__/module-format-cjs.test.js` - CommonJS specific tests
- `__tests__/module-format-esm.test.mjs` - ESM specific tests
- `__tests__/package-exports.test.js` - Package exports field tests
- `__tests__/typescript-compatibility.test.ts` - TypeScript compatibility tests

## Module Support

The library supports both CommonJS and ES Modules:

### CommonJS
```javascript
const { shaclStoreToShexSchema, writeShexSchema } = require('@jeswr/shacl2shex');
```

### ES Modules
```javascript
import { shaclStoreToShexSchema, writeShexSchema } from '@jeswr/shacl2shex';
```

Both formats are fully tested and supported.