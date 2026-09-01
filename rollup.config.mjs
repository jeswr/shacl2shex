import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const externalDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const external = (id) => {
  // Always inline @ldo/* so consumers never resolve the @ldo packages at runtime.
  // Their published CJS builds have broken module resolution in some version
  // combinations (see https://github.com/jeswr/shacl2shex/issues/344).
  if (id.startsWith('@ldo/')) return false;
  if (externalDeps.some((dep) => id === dep || id.startsWith(`${dep}/`))) return true;
  if (builtinModules.includes(id) || builtinModules.includes(id.replace(/^node:/, ''))) return true;
  return false;
};

export default {
  input: path.resolve('lib/index.ts'),
  output: [
    {
      file: path.resolve('dist/index.mjs'),
      format: 'esm',
      sourcemap: false,
    },
    {
      // Overwrites the tsc-emitted dist/index.js entry point so the published
      // CJS entry is self-contained (aside from the declared dependencies).
      file: path.resolve('dist/index.js'),
      format: 'cjs',
      exports: 'named',
      sourcemap: false,
    },
  ],
  external,
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({
      tsconfig: path.resolve('tsconfig.json'),
      declaration: false,
      outDir: undefined,
      module: 'ESNext',
    }),
  ],
};