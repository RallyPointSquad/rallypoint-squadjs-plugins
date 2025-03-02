import BasePlugin from './base-plugin.js'


/**
 * Pattern for parsing whitelist entries.
 */
const WHITELIST_PATTERN = /^Admin=(?<steamID>[0-9]+):(?<groupName>[A-Z]+) \/\/ \[(?<listName>[A-Z]+)\] /i;

/**
 * @typedef {Object} ExtraPluginOptions
 * @property {string} whitelisterUrl
 * @property {string} whitelistPath
 * @property {string} whitelistGroup
 */

/**
 * @extends {BasePlugin<ExtraPluginOptions>}
 */
export default class WhitelisterConnector extends BasePlugin {

  constructor(server, options, connectors) {
    super(server, options, connectors);

    connectors.whitelister = this;
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      whitelisterUrl: {
        required: true,
        description: 'Whitelister base URL.',
        default: '',
        example: 'http://whitelister.local',
      },
      whitelistPath: {
        required: false,
        description: 'Whitelist URL slug.',
        default: 'wl',
        example: 'wl',
      },
      whitelistGroup: {
        required: false,
        description: 'Name of the default whitelist group.',
        default: 'Whitelist',
        example: 'http://whitelister.local',
      },
    }
  }

  /**
   * @returns {Promise<{ steamID: string, groupName: string, listName: string }[]>}
   */
  async getWhitelistPlayers() {
    return this.#parseWhitelist(await this.#fetchWhitelist());
  }

  /**
   * @returns {Promise<Record<string, { steamID: string }[]>>}
   */
  async getWhitelistClans() {
    const clanPlayers = (await this.getWhitelistPlayers())
      .filter(player => player.groupName === this.options.whitelistGroup)
      .filter(player => player.listName !== 'Discord Role');
    return Object.groupBy(clanPlayers, player => player.listName);
  }

  async #fetchWhitelist() {
    const response = await fetch(new URL(this.options.whitelistPath, this.options.whitelisterUrl));
    return await response.text();
  }

  #parseWhitelist(whitelist) {
    return whitelist.split('\n')
      .map(line => line.match(WHITELIST_PATTERN))
      .filter(match => !!match)
      .map(match => ({
        steamID: match.groups.steamID,
        groupName: match.groups.groupName,
        listName: match.groups.listName,
      }));
  }

}
