import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import dereferenceToStore from 'rdf-dereference-store';
import {
  shaclStoreToShexSchema, writeShexSchema, shapeMapFromDataset, writeShapeMap,
} from '../lib';

const files = fs.readdirSync(path.join(__dirname))
  .filter((file) => file.endsWith('.shaclc') || file.endsWith('.shce'));

it.each(files)('should convert %s', async (file) => {
  const store = await dereferenceToStore(path.join(__dirname, file), { localFiles: true });
  const expectedShex = fs.readFileSync(path.join(__dirname, file.replace(/\.(shaclc|shce)$/, '.shex')), 'utf-8');
  const shexSchema = await shaclStoreToShexSchema(store.store);
  await expect(writeShexSchema(shexSchema, store.prefixes)).resolves.toEqual(expectedShex);

  // Check if there's an expected ShapeMap file
  const shapeMapPath = path.join(__dirname, file.replace(/\.(shaclc|shce)$/, '.shapemap'));
  if (fs.existsSync(shapeMapPath)) {
    const expectedShapeMap = fs.readFileSync(shapeMapPath, 'utf-8');
    const shapeMap = shapeMapFromDataset(store.store);
    expect(writeShapeMap(shapeMap, store.prefixes)).toEqual(expectedShapeMap);
  }
});

// E2E CLI tests for all files
it.each(files)('should convert %s via CLI', async (file) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shacl2shex-e2e-test-'));
  const inputPath = path.resolve(__dirname, file);
  const outputPath = path.join(tempDir, 'output.shex');
  const outputShapeMapPath = path.join(tempDir, 'output.shapemap');

  try {
    // Test basic CLI conversion (without --shapemap flag)
    execSync(`node ${path.join(__dirname, '../dist/bin/index.js')} "${inputPath}" "${outputPath}"`, {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..'),
    });

    // Verify ShEx file was generated and matches expected output
    expect(fs.existsSync(outputPath)).toBe(true);
    const generatedShex = fs.readFileSync(outputPath, 'utf-8');
    const expectedShex = fs.readFileSync(path.join(__dirname, file.replace(/\.(shaclc|shce)$/, '.shex')), 'utf-8');
    expect(generatedShex).toEqual(expectedShex);

    // Test CLI with --shapemap flag if expected ShapeMap file exists
    const shapeMapPath = path.join(__dirname, file.replace(/\.(shaclc|shce)$/, '.shapemap'));
    if (fs.existsSync(shapeMapPath)) {
      // Clean up previous output files
      fs.unlinkSync(outputPath);

      // Run CLI command with --shapemap flag
      execSync(`node ${path.join(__dirname, '../dist/bin/index.js')} "${inputPath}" "${outputPath}" --shapemap`, {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..'),
      });

      // Verify ShEx output matches expected
      expect(fs.readFileSync(outputPath, 'utf-8')).toEqual(expectedShex);

      // Verify ShapeMap output matches expected
      const generatedShapeMap = fs.readFileSync(outputShapeMapPath, 'utf-8');
      const expectedShapeMap = fs.readFileSync(shapeMapPath, 'utf-8');
      expect(generatedShapeMap).toEqual(expectedShapeMap);
    }
  } finally {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
