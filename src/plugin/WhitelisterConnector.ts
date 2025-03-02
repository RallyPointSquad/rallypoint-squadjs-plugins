import BasePlugin from '@squadjs/plugins/base-plugin.js'

/**
 * Pattern for parsing whitelist entries.
 */
const WHITELIST_PATTERN = /^Admin=(?<steamID>[0-9]+):(?<groupName>[A-Z]+) \/\/ \[(?<listName>[A-Z]+)\] /i;

interface WhitelistEntry {
  steamID: string;
  groupName: string;
  listName: string;
}

interface ExtraPluginOptions {
  whitelisterUrl: string;
  whitelistPath: string;
  whitelistGroup: string;
}

/**
 * Whitelister connector plugin serving as Whitelister communication facade.
 * The plugin injects itself into the <code>connectors</code> object so that other plugins can retrieve it from there.
 */
export default class WhitelisterConnector extends BasePlugin<ExtraPluginOptions> {

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

  async getWhitelistPlayers(): Promise<WhitelistEntry[]> {
    return this.#parseWhitelist(await this.#fetchWhitelist());
  }

  async getWhitelistClans(): Promise<Record<string, WhitelistEntry[]>> {
    const clanPlayers = (await this.getWhitelistPlayers())
      .filter(player => player.groupName === this.options.whitelistGroup)
      .filter(player => player.listName !== 'Discord Role');
    return Object.groupBy(clanPlayers, player => player.listName);
  }

  async #fetchWhitelist() {
    const response = await fetch(new URL(this.options.whitelistPath, this.options.whitelisterUrl));
    return await response.text();
  }

  #parseWhitelist(whitelist: string): WhitelistEntry[] {
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
