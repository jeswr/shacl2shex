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

    // E2E CLI test: Test the actual CLI with --shapemap flag
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shacl2shex-test-'));
    const inputPath = path.resolve(__dirname, file);
    const outputPath = path.join(tempDir, 'output.shex');
    const outputShapeMapPath = path.join(tempDir, 'output.shapemap');

    try {
      // Run the CLI command
      execSync(`node ${path.join(__dirname, '../dist/bin/index.js')} "${inputPath}" "${outputPath}" --shapemap`, {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..'),
      });

      // Verify ShapeMap file was generated and matches expected output
      expect(fs.existsSync(outputShapeMapPath)).toBe(true);
      const generatedShapeMap = fs.readFileSync(outputShapeMapPath, 'utf-8');
      expect(generatedShapeMap).toEqual(expectedShapeMap);
    } finally {
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});
