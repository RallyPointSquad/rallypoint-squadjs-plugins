
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
  {
    plugin: 'WhitelisterConnector',
    output: 'rp-whitelister-connector',
  },
  {
    plugin: 'PlaytimeTracker',
    output: 'rp-playtime-tracker',
  },
  {
    plugin: 'PlaytimeReport',
    output: 'rp-playtime-report',
  },
  {
    plugin: 'DiscordSeedCall',
    output: 'rp-discord-seed-call',
  },
  {
    plugin: 'SeedMapSetter',
    output: 'rp-seed-map-setter',
  },
];
