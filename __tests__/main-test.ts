import * as path from 'path';
import * as fs from 'fs';
import dereferenceToStore from 'rdf-dereference-store';
import type { Store } from 'n3';
import { shaclStoreToShexSchema, writeShexSchema } from '../lib';

it('should be able to convert a shacl shape to a shex shape', async () => {
  const store = await dereferenceToStore(path.join(__dirname, 'test.shaclc'), { localFiles: true });
  const packageShape = await dereferenceToStore(path.join(__dirname, 'package.shaclc'), { localFiles: true });
  const webidShape = await dereferenceToStore(path.join(__dirname, 'webid.shaclc'), { localFiles: true });

  // Fixme: convert both to shexj and do an equality check on the schema so that
  // this still passes after minor syntactical changes
  expect(
    await writeShexSchema(await shaclStoreToShexSchema(store.store as Store), store.prefixes),
  ).toEqual(fs.readFileSync(path.join(__dirname, 'test.shex'), 'utf-8'));

  expect(
    await writeShexSchema(
      await shaclStoreToShexSchema(packageShape.store as Store),
      packageShape.prefixes,
    ),
  ).toEqual(fs.readFileSync(path.join(__dirname, 'package.shex'), 'utf-8'));

  expect(
    await writeShexSchema(
      await shaclStoreToShexSchema(webidShape.store as Store),
      webidShape.prefixes,
    ),
  ).toEqual(fs.readFileSync(path.join(__dirname, 'webid.shex'), 'utf-8'));
});
