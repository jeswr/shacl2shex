import { Store } from 'n3';
import dereference from 'rdf-dereference';
import { promisifyEventEmitter } from 'event-emitter-promisify';
import * as fs from 'fs';
import * as path from 'path';
import { shaclStoreToShexSchema, writeShexSchema } from '../lib';

export async function dereferenceToStore(file: string) {
    const store = new Store();
    return promisifyEventEmitter(store.import((await dereference.dereference(file, { localFiles: true })).data), store);
}

async function main() {
    const schema = await shaclStoreToShexSchema(await dereferenceToStore('https://www.w3.org/ns/shacl-shacl#ShapeShape'));
    fs.writeFileSync(path.join(__dirname, 'Shacl.shex'), await writeShexSchema(schema, {
        sh: 'http://www.w3.org/ns/shacl#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        shsh: 'http://www.w3.org/ns/shacl-shacl#',
    }));
}

main();
