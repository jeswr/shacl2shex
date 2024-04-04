import { Store } from 'n3';
import dereference from 'rdf-dereference';
import { promisifyEventEmitter } from 'event-emitter-promisify';

export async function dereferenceToStore(file: string) {
    const store = new Store();
    const prefixes: Record<string, string> = {};
    const { data } = (await dereference.dereference(file, { localFiles: true }));
    data.on('prefix', (prefix, ns) => { prefixes[prefix] = ns });
    return { store: await promisifyEventEmitter(data, store), prefixes };
}
