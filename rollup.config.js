import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import pluginsConfig from './plugins.config.js';

/**
 * Default bundle external module configuration.
 */
const defaultExternals = [
  'moment',
  'sequelize',
  /^@\/plugin\//,
  /^@squadjs\/plugins\//,
];

/**
 * External module path replacement configuration.
 * @type {{ [prefix: string]: (id: string) => string }}
 */
const outputPaths = {
  '@squadjs/plugins/': id => id.replace('@squadjs/plugins/', './'),
  '@/plugin/': id => './rp-' + id
    .replace('@/plugin/', '')
    // convert to kebab-case
    .replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase()),
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
      const matched = Object.keys(outputPaths).find(prefix => id.startsWith(prefix));
      return matched ? outputPaths[matched](id) : id;
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
