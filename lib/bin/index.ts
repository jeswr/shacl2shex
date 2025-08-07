#!/usr/bin/env node
/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import type { Store } from 'n3';
import dereferenceToStore from 'rdf-dereference-store';
import {
  shaclStoreToShexSchema, writeShexSchema, shapeMapFromDataset, writeShapeMap,
} from '..';

// Import version from package.json
const packageJsonPath = path.join(__dirname, '../../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const { version } = packageJson;

async function convertToShex(inPath: string, outPath: string, generateShapeMap: boolean = false) {
  const { store, prefixes } = await dereferenceToStore(inPath, { localFiles: true });
  const schema = await shaclStoreToShexSchema(store as Store);
  if (!schema.shapes || schema.shapes.length === 0) {
    throw new Error(`No shapes found in ${inPath}`);
  }
  fs.writeFileSync(outPath, await writeShexSchema(schema, prefixes));

  // Generate ShapeMap if requested
  if (generateShapeMap) {
    const shapeMap = shapeMapFromDataset(store as Store);
    const shapeMapPath = outPath.replace(/\.shex$/, '.shapemap') + (outPath.endsWith('.shex') ? '' : '.shapemap');
    fs.writeFileSync(shapeMapPath, writeShapeMap(shapeMap, prefixes));
    console.log(`Generated ShapeMap: ${shapeMapPath}`);
  }
}

// Set up command line interface with commander
const program = new Command();

program
  .name('shacl2shex')
  .description('Convert SHACL shapes to ShEx schema')
  .version(version)
  .argument('<input>', 'input SHACL file or directory')
  .argument('[output]', 'output ShEx file (defaults to input with .shex extension)')
  .option('-s, --shapemap', 'generate ShapeMap file alongside ShEx output')
  .addHelpText('after', `
Examples:
  $ shacl2shex shapes.shaclc
  $ shacl2shex shapes.shaclc output.shex --shapemap
  $ shacl2shex shapes/ --shapemap`)
  .action(async (input: string, output?: string, options?: { shapemap?: boolean }) => {
    try {
      const uriInput = /^https?:\/\//.test(input);
      const inputPath = uriInput ? input : path.resolve(process.cwd(), input);
      // eslint-disable-next-line no-nested-ternary
      const outputPath = output ? path.resolve(process.cwd(), output) : (
        /\.[^./\\]+$/.test(inputPath)
          ? inputPath.replace(/\.[^./\\]+$/, '.shex')
          : `${inputPath}.shex`
      );

      if (uriInput || fs.existsSync(inputPath)) {
        if (uriInput || fs.statSync(inputPath).isFile()) {
          // Input is a file
          // eslint-disable-next-line no-await-in-loop
          await convertToShex(inputPath, outputPath, options?.shapemap || false);
        } else if (fs.statSync(inputPath).isDirectory()) {
          // Input is a directory
          const shaclcFiles = fs.readdirSync(inputPath, { withFileTypes: true, recursive: true })
            .filter((dirent) => dirent.isFile())
            .map((dirent) => path.join(dirent.path, dirent.name));

          // Process each SHACL file
          for (const filePath of shaclcFiles) {
            const outputFilePath = filePath.replace(/\.[a-z]+$/i, '.shex');
            // eslint-disable-next-line no-await-in-loop
            await convertToShex(filePath, outputFilePath, options?.shapemap || false);
          }
        } else {
          console.error('Error: Input is neither a file nor a directory');
          process.exit(1);
        }
      } else {
        console.error(`Error: Input file or directory '${input}' does not exist`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
