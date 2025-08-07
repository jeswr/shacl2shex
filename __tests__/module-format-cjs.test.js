/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-var-requires */

describe('CommonJS Module Format', () => {
  it('should load the library using require()', () => {
    const shacl2shex = require('../dist/cjs/index.js');
    expect(shacl2shex).toBeDefined();
  });

  it('should export all expected functions via require()', () => {
    const shacl2shex = require('../dist/cjs/index.js');
    
    // Check main functions
    expect(typeof shacl2shex.shaclStoreToShexSchema).toBe('function');
    expect(typeof shacl2shex.writeShexSchema).toBe('function');
    expect(typeof shacl2shex.shapeMapFromDataset).toBe('function');
    expect(typeof shacl2shex.writeShapeMap).toBe('function');
  });

  it('should allow destructuring with require()', () => {
    const { 
      shaclStoreToShexSchema, 
      writeShexSchema,
      shapeMapFromDataset,
      writeShapeMap
    } = require('../dist/cjs/index.js');
    
    expect(typeof shaclStoreToShexSchema).toBe('function');
    expect(typeof writeShexSchema).toBe('function');
    expect(typeof shapeMapFromDataset).toBe('function');
    expect(typeof writeShapeMap).toBe('function');
  });

  it('should load sub-modules correctly', () => {
    const shapeFromDataset = require('../dist/cjs/shapeFromDataset.js');
    expect(shapeFromDataset).toBeDefined();
    expect(typeof shapeFromDataset.shapeFromDataset).toBe('function');
    expect(typeof shapeFromDataset.getSubjects).toBe('function');
    expect(typeof shapeFromDataset.shapeMatches).toBe('function');
  });

  it('should have correct package.json type field', () => {
    const packageJson = require('../dist/cjs/package.json');
    expect(packageJson.type).toBe('commonjs');
  });

  it('should work with Node.js module caching', () => {
    // Clear the require cache
    delete require.cache[require.resolve('../dist/cjs/index.js')];
    
    const firstRequire = require('../dist/cjs/index.js');
    const secondRequire = require('../dist/cjs/index.js');
    
    // Should be the same object due to caching
    expect(firstRequire).toBe(secondRequire);
  });

  it('should handle circular dependencies gracefully', () => {
    // This tests that the CommonJS build doesn't have circular dependency issues
    expect(() => {
      require('../dist/cjs/index.js');
    }).not.toThrow();
  });
});