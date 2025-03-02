
/**
 * @typedef {Object} PluginBuildConfig
 * @property {string} plugin The name of the plugin.
 * @property {string[]} [external] External modules to exclude from the bundle.
 * @property {string} output Output name of the plugin.
 */

/** @type {PluginBuildConfig[]} */
export default [
  {
    plugin: 'TaskScheduler',
    output: 'rp-task-scheduler',
    external: ['node-cron'],
  },
];
