#!/usr/bin/env node
/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import type { Store } from 'n3';
import dereferenceToStore from 'rdf-dereference-store';
import { shaclStoreToShexSchema, writeShexSchema } from '..';

async function convertToShex(inPath: string, outPath: string) {
  const { store, prefixes } = await dereferenceToStore(inPath);
  const schema = await shaclStoreToShexSchema(store as Store);
  if (!schema.shapes || schema.shapes.length === 0) {
    throw new Error(`No shapes found in ${inPath}`);
  }
  fs.writeFileSync(outPath, await writeShexSchema(schema, prefixes));
}

const uriInput = /^https?:\/\//.test(process.argv[2]);
const i = uriInput ? process.argv[2] : path.join(process.cwd(), process.argv[2]);
const o = path.join(process.cwd(), process.argv[3] ?? process.argv[2]);

if (uriInput || fs.existsSync(i)) {
  if (uriInput || fs.statSync(i).isFile()) {
    // i is a file
    convertToShex(i, o).catch((e) => console.warn(e));
  } else if (fs.statSync(i).isDirectory()) {
    // i is a directory
    // Get all shacl files in the shapes directory
    const shaclcFiles = fs.readdirSync(i, { withFileTypes: true, recursive: true })
      .filter((dirent) => dirent.isFile())
      .map((dirent) => path.join(dirent.path, dirent.name));

    // Process each shacl file
    shaclcFiles.forEach((filePath) => {
      convertToShex(filePath, filePath.replace(/\.[a-z]+$/i, '.shex')).catch((e) => console.warn(e));
    });
  } else {
    console.log('Invalid input');
  }
} else {
  console.log('Input does not exist');
}
