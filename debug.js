const path = require('path');
const fs = require('fs');
const dereferenceToStore = require('rdf-dereference-store').default;
const { shaclStoreToShexSchema, writeShexSchema } = require('./dist');

(async () => {
  try {
    const inPath = process.argv[2] || path.join(__dirname, '__tests__/catalog-shacl.shce');
    const { store, prefixes } = await dereferenceToStore(inPath, { localFiles: true });
    const schema = await shaclStoreToShexSchema(store);
    fs.writeFileSync('/workspace/tmp.json', JSON.stringify(schema, null, 2));
    try {
      const text = await writeShexSchema(schema, prefixes);
      fs.writeFileSync('/workspace/tmp.shex', text);
      console.log('OK');
    } catch (e) {
      console.error('Writer error:', e && e.stack ? e.stack : e);
    }
  } catch (e) {
    console.error('Build error:', e && e.stack ? e.stack : e);
  }
})();