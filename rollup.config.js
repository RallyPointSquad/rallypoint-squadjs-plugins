import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Transform plugin name matching the output path.
 */
function toOutputPath(pluginName) {
  const kebabName = pluginName.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase());
  return `./rp-${kebabName}.js`;
}

/**
 * Read plugin names from the plugin directory.
 */
async function readPluginNames() {
  return (await readdir('./src/plugin', { withFileTypes: true }))
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.ts'))
    .map(dirent => dirent.name.replace(/\.ts$/, ''));
}

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
 */
const outputPaths = {
  '@squadjs/plugins/': id => id.replace(/^@squadjs\/plugins\//, './'),
  '@/plugin/': id => id.replace(/^@\/plugin\/(.*)\.js$/, (_, pluginName) => toOutputPath(pluginName)),
};

/** @type {(): Promise<import('rollup').RollupOptions[]>} */
export default async () => {
  const pluginNames = process.env.BUILD_PLUGINS
    ? process.env.BUILD_PLUGINS.split(',')
    : await readPluginNames();
  return pluginNames.map(pluginName => ({
    input: `src/plugin/${pluginName}.ts`,
    external: [...defaultExternals, 'node-cron'],
    output: {
      file: join('dist', toOutputPath(pluginName)),
      format: 'esm',
      paths: id => {
        const match = Object.keys(outputPaths).find(prefix => id.startsWith(prefix));
        return match ? outputPaths[match](id) : id;
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
};
