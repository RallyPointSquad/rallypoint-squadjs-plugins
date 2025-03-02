import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import pluginsConfig from './plugins.config.js';

/**
 * Default bundle external module configuration.
 */
const defaultExternals = [
  /^@squadjs\/plugins\//,
  /^\.\//,
];

/**
 * External module path replacement configuration.
 */
const outputPaths = {
  '@squadjs/plugins/': './',
};

/** @type {import('rollup').RollupOptions[]} */
export default pluginsConfig.map((pluginConfig) => ({
  input: `src/plugin/${pluginConfig.plugin}.ts`,
  external: [
    ...defaultExternals,
    ...(pluginConfig.external || []),
  ],
  output: {
    file: `dist/${pluginConfig.output}.js`,
    format: 'esm',
    paths: id => {
      const prefix = Object.keys(outputPaths).find(it => id.startsWith(it));
      return prefix ? id.replace(prefix, outputPaths[prefix]) : id;
    },
  },
  plugins: [
    commonjs(),
    nodeResolve({
      preferBuiltins: true,
    }),
    typescript({
      exclude: [
        './node_modules/**',
        './tests/**',
      ],
    }),
  ],
}));
