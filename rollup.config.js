import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'basaltpass.ts',
  output: [
    {
      file: 'dist/basaltpass.js',
      format: 'cjs',
      exports: 'named'
    },
    {
      file: 'dist/basaltpass.esm.js',
      format: 'es'
    },
    {
      file: 'dist/basaltpass.umd.js',
      format: 'umd',
      name: 'BasaltPass',
      exports: 'named'
    }
  ],
  plugins: [
    resolve(),
    typescript({
      declaration: true,
      declarationDir: 'dist',
      rootDir: '.'
    })
  ],
  external: []
};
