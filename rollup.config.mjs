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
  if (externalDeps.some((dep) => id === dep || id.startsWith(`${dep}/`))) return true;
  if (builtinModules.includes(id) || builtinModules.includes(id.replace(/^node:/, ''))) return true;
  return false;
};

export default {
  input: path.resolve('lib/index.ts'),
  output: {
    file: path.resolve('dist/index.mjs'),
    format: 'esm',
    sourcemap: false,
  },
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