/* eslint-env jest */
import { jest } from '@jest/globals';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('ESM Module Format', () => {
  it('should load the library using import', async () => {
    const shacl2shex = await import('../dist/esm/index.js');
    expect(shacl2shex).toBeDefined();
  });

  it('should export all expected functions via import', async () => {
    const shacl2shex = await import('../dist/esm/index.js');
    
    // Check main functions
    expect(typeof shacl2shex.shaclStoreToShexSchema).toBe('function');
    expect(typeof shacl2shex.writeShexSchema).toBe('function');
    expect(typeof shacl2shex.shapeMapFromDataset).toBe('function');
    expect(typeof shacl2shex.writeShapeMap).toBe('function');
  });

  it('should allow named imports', async () => {
    const { 
      shaclStoreToShexSchema, 
      writeShexSchema,
      shapeMapFromDataset,
      writeShapeMap
    } = await import('../dist/esm/index.js');
    
    expect(typeof shaclStoreToShexSchema).toBe('function');
    expect(typeof writeShexSchema).toBe('function');
    expect(typeof shapeMapFromDataset).toBe('function');
    expect(typeof writeShapeMap).toBe('function');
  });

  it('should load sub-modules correctly', async () => {
    const shapeFromDataset = await import('../dist/esm/shapeFromDataset.js');
    expect(shapeFromDataset).toBeDefined();
    expect(typeof shapeFromDataset.shapeFromDataset).toBe('function');
    expect(typeof shapeFromDataset.getSubjects).toBe('function');
    expect(typeof shapeFromDataset.shapeMatches).toBe('function');
  });

  it('should have correct package.json type field', () => {
    const packageJson = require('../dist/esm/package.json');
    expect(packageJson.type).toBe('module');
  });

  it('should have proper relative imports with .js extensions', async () => {
    // This will fail if the imports don't have .js extensions
    expect(async () => {
      await import('../dist/esm/index.js');
    }).not.toThrow();
  });

  it('should support dynamic imports', async () => {
    const modulePath = '../dist/esm/index.js';
    const dynamicImport = await import(modulePath);
    
    expect(dynamicImport).toBeDefined();
    expect(typeof dynamicImport.shaclStoreToShexSchema).toBe('function');
  });

  it('should not pollute global scope', async () => {
    await import('../dist/esm/index.js');
    
    // Check that nothing is added to global
    expect(typeof global.shaclStoreToShexSchema).toBe('undefined');
    expect(typeof global.writeShexSchema).toBe('undefined');
  });

  it('should work with import.meta', async () => {
    // Just verify that ESM context is available
    expect(import.meta).toBeDefined();
    expect(import.meta.url).toBeDefined();
  });
});