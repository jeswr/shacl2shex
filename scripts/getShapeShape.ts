import { Store } from 'n3';
import dereference from 'rdf-dereference';
import { promisifyEventEmitter } from 'event-emitter-promisify';
import * as fs from 'fs';
import * as path from 'path';
import { shaclStoreToShexSchema, writeShexSchema } from '../lib';
import { dereferenceToStore } from '../lib/dereferenceToStore';
async function main() {
    const { store, prefixes } = await dereferenceToStore('https://www.w3.org/ns/shacl-shacl#ShapeShape');
    const schema = await shaclStoreToShexSchema(store);
    fs.writeFileSync(path.join(__dirname, 'Shacl.shex'), await writeShexSchema(schema, prefixes));
}

main();
