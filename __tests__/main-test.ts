import * as path from 'path';
import * as fs from 'fs';
import dereferenceToStore from 'rdf-dereference-store';
import { shaclStoreToShexSchema, writeShexSchema } from '../lib';

const files = fs.readdirSync(path.join(__dirname))
  .filter((file) => file.endsWith('.shaclc'));

it.each(files)('should convert %s', async (file) => {
  const store = await dereferenceToStore(path.join(__dirname, file), { localFiles: true });
  const expectedShex = fs.readFileSync(path.join(__dirname, file.replace('.shaclc', '.shex')), 'utf-8');
  const shexSchema = await shaclStoreToShexSchema(store.store);
  await expect(writeShexSchema(shexSchema, store.prefixes)).resolves.toEqual(expectedShex);
});
