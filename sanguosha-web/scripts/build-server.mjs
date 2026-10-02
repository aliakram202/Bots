import { build } from 'esbuild';

await build({
  entryPoints: ['src/server/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server/main.js',
  packages: 'external',
  sourcemap: true,
});
console.log('server built → dist/server/main.js');
