/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Package Exports Field', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shacl2shex-exports-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should resolve CommonJS when using require from a CommonJS context', () => {
    const testFile = path.join(tempDir, 'test-cjs.js');
    const testContent = `
      const path = require('path');
      const shacl2shex = require(path.join('${__dirname}', '../dist/cjs/index.js'));
      console.log(JSON.stringify({
        hasFunctions: typeof shacl2shex.shaclStoreToShexSchema === 'function',
        hasAllExports: !!(shacl2shex.shaclStoreToShexSchema && shacl2shex.writeShexSchema && shacl2shex.shapeMapFromDataset && shacl2shex.writeShapeMap)
      }));
    `;
    
    fs.writeFileSync(testFile, testContent);
    
    const output = execSync(`node ${testFile}`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    
    const result = JSON.parse(output);
    expect(result.hasFunctions).toBe(true);
    expect(result.hasAllExports).toBe(true);
  });

  it('should resolve ESM when using import from an ESM context', () => {
    const testFile = path.join(tempDir, 'test-esm.mjs');
    const testContent = `
      import { shaclStoreToShexSchema, writeShexSchema, shapeMapFromDataset, writeShapeMap } from '${path.join(__dirname, '../dist/esm/index.js').replace(/\\/g, '/')}';
      
      console.log(JSON.stringify({
        hasFunctions: typeof shaclStoreToShexSchema === 'function',
        hasAllExports: !!(shaclStoreToShexSchema && writeShexSchema && shapeMapFromDataset && writeShapeMap)
      }));
    `;
    
    fs.writeFileSync(testFile, testContent);
    
    const output = execSync(`node ${testFile}`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    
    const result = JSON.parse(output);
    expect(result.hasFunctions).toBe(true);
    expect(result.hasAllExports).toBe(true);
  });

  it('should have correct main and module fields in package.json', () => {
    const packageJson = require('../package.json');
    
    expect(packageJson.main).toBe('./dist/cjs/index.js');
    expect(packageJson.module).toBe('./dist/esm/index.js');
    expect(packageJson.types).toBe('./dist/cjs/index.d.ts');
  });

  it('should have correct exports field structure', () => {
    const packageJson = require('../package.json');
    
    expect(packageJson.exports).toBeDefined();
    expect(packageJson.exports['.']).toBeDefined();
    expect(packageJson.exports['.'].import).toBeDefined();
    expect(packageJson.exports['.'].require).toBeDefined();
    
    // Check import condition
    expect(packageJson.exports['.'].import.types).toBe('./dist/esm/index.d.ts');
    expect(packageJson.exports['.'].import.default).toBe('./dist/esm/index.js');
    
    // Check require condition
    expect(packageJson.exports['.'].require.types).toBe('./dist/cjs/index.d.ts');
    expect(packageJson.exports['.'].require.default).toBe('./dist/cjs/index.js');
  });

  it('should allow access to package.json via exports', () => {
    const packageJson = require('../package.json');
    
    expect(packageJson.exports['./package.json']).toBe('./package.json');
  });
});