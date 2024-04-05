import * as path from 'path';
import * as fs from 'fs';
import { shaclStoreToShexSchema, writeShexSchema } from '../lib';
import { dereferenceToStore } from '../lib/dereferenceToStore';

it('should be able to convert a shacl shape to a shex shape', async () => {
  const store = await dereferenceToStore(path.join(__dirname, 'test.shaclc'));

  // Fixme: convert both to shexj and do an equality check on the schema so that
  // this still passes after minor syntactical changes
  expect(
    await writeShexSchema(await shaclStoreToShexSchema(store.store), store.prefixes),
  ).toEqual(fs.readFileSync(path.join(__dirname, 'test.shex'), 'utf-8'));
});
