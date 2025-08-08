import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import dereferenceToStore from 'rdf-dereference-store';
import { pathToFileURL } from 'url';
import { execSync } from 'child_process';

const fixture = 'test.shaclc';

it('CJS build (dist/index.js) works', async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const cjs = require('../dist/index.js') as typeof import('../lib');
  const inputPath = path.join(__dirname, fixture);
  const expectedShex = fs.readFileSync(path.join(__dirname, fixture.replace(/\.(shaclc|shce)$/, '.shex')), 'utf-8');

  const { store, prefixes } = await dereferenceToStore(inputPath, { localFiles: true });
  const schema = await cjs.shaclStoreToShexSchema(store as any);
  await expect(cjs.writeShexSchema(schema, prefixes)).resolves.toEqual(expectedShex);
});

it('ESM build (dist/index.mjs) works', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shacl2shex-esm-test-'));
  const runnerPath = path.join(tempDir, 'runner.mjs');
  const esmUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.mjs')).href;
  const inputPath = path.join(__dirname, fixture);
  const expectedShexPath = path.join(__dirname, fixture.replace(/\.(shaclc|shce)$/, '.shex'));

  const runner = `
import fs from 'node:fs';
import { createRequire } from 'node:module';
const [inputPath, expectedPath] = process.argv.slice(2);
const mod = await import(process.env.MODULE_URL);
const require = createRequire(process.env.PROJECT_ROOT + '/package.json');
const deref = require('rdf-dereference-store').default;
const { store, prefixes } = await deref(inputPath, { localFiles: true });
const schema = await mod.shaclStoreToShexSchema(store);
const shex = await mod.writeShexSchema(schema, prefixes);
const expected = fs.readFileSync(expectedPath, 'utf-8');
if (shex !== expected) {
  console.error('Mismatch between ESM output and expected');
  process.exit(1);
}
console.log('ok');
`;
  fs.writeFileSync(runnerPath, runner, 'utf-8');

  const out = execSync(`node ${runnerPath} "${inputPath}" "${expectedShexPath}"`, {
    env: { ...process.env, MODULE_URL: esmUrl, PROJECT_ROOT: path.join(__dirname, '..') },
  }).toString();
  expect(out.trim()).toBe('ok');
});
