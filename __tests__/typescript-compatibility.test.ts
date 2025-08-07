import * as fs from 'fs';
import * as path from 'path';
import {
  shaclStoreToShexSchema,
  writeShexSchema,
  shapeMapFromDataset,
  writeShapeMap,
  ShapeMap,
  ShapeMapEntry,
} from '../lib';

describe('TypeScript Compatibility', () => {
  it('should have correct type definitions for main functions', () => {
    // This test verifies that TypeScript types are correctly exported
    // The actual type checking happens at compile time

    // These should compile without errors
    expect(typeof shaclStoreToShexSchema).toBe('function');
    expect(typeof writeShexSchema).toBe('function');
    expect(typeof shapeMapFromDataset).toBe('function');
    expect(typeof writeShapeMap).toBe('function');
  });

  it('should export correct types', () => {
    // Verify that types are available (this is a compile-time check)
    const shapeMap: ShapeMap = {
      entries: [],
    };

    const shapeMapEntry: ShapeMapEntry = {
      node: 'test',
      shape: 'test',
    };

    expect(shapeMap).toBeDefined();
    expect(shapeMapEntry).toBeDefined();
  });

  it('should allow async usage of main function', async () => {
    // Verify that shaclStoreToShexSchema returns a Promise
    // We can't actually call it without a proper Store, but we can verify it exists
    expect(shaclStoreToShexSchema).toBeDefined();
    expect(typeof shaclStoreToShexSchema).toBe('function');

    // The function should be async (returns a Promise)
    // We verify this by checking the function's toString includes 'async'
    expect(shaclStoreToShexSchema.constructor.name).toBe('AsyncFunction');
  });

  it('should have type definitions for both CJS and ESM builds', () => {
    // This test verifies that .d.ts files exist in both builds

    // Check CJS type definitions
    expect(fs.existsSync(path.join(__dirname, '../dist/cjs/index.d.ts'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../dist/cjs/shapeFromDataset.d.ts'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../dist/cjs/shapeMapFromDataset.d.ts'))).toBe(true);

    // Check ESM type definitions
    expect(fs.existsSync(path.join(__dirname, '../dist/esm/index.d.ts'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../dist/esm/shapeFromDataset.d.ts'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../dist/esm/shapeMapFromDataset.d.ts'))).toBe(true);
  });
});
