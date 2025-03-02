import BasePlugin from '@squadjs/plugins/base-plugin.js';
import moment from 'moment';
import { DataTypes, Sequelize } from 'sequelize';
import WhitelisterConnector from './WhitelisterConnector.js';

/**
 * Create playtime model that can be shared with other plugins.
 */
export function createPlaytimeModel(database: Sequelize) {
  return database.define(
    'PlaytimeTracker_Playtime',
    {
      steamID: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        primaryKey: true,
      },
      minutesPlayed: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      minutesSeeded: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      clanTag: {
        type: DataTypes.STRING,
      },
    },
    {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      timestamps: false,
    },
  );
}

/**
 * Playtime tracking interval in milliseconds.
 */
export const TRACKING_INTERVAL = 60_000;

interface ExtraPluginOptions {
  database: Sequelize;
  whitelisterClient: WhitelisterConnector;
  seedingStartsAt: number;
  seedingEndsAt: number;
}

export default class PlaytimeTracker extends BasePlugin<ExtraPluginOptions> {

  static get description() {
    return 'The <code>PlaytimeTracker</code> plugin tracks hours played by players with their clan membership based on data from Whitelister.';
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      database: {
        required: false,
        connector: 'sequelize',
        description: 'The Sequelize connector to log playtime information to.',
        default: 'mysql',
      },
      whitelisterClient: {
        required: false,
        description: 'The Whitelister connector plugin.',
        default: 'whitelister',
      },
      seedingStartsAt: {
        required: false,
        description: 'The minimum number of players connected to the server in order for the plugin to consider server to be seeding.',
        default: 4,
        example: 4,
      },
      seedingEndsAt: {
        required: false,
        description: 'The maximum number of players connected to the server in order for the plugin to consider server to be seeding.',
        default: 60,
        example: 60,
      },
    }
  }

  playtimeModel: ReturnType<typeof createPlaytimeModel>;

  #whitelistPlayers: Record<string, string> = {};

  #trackingInterval: NodeJS.Timeout;

  constructor(server, options, connectors) {
    super(server, options, connectors);
    this.options.whitelisterClient = connectors[options.whitelisterClient];

    this.playtimeModel = createPlaytimeModel(this.options.database);

    this.updatePlaytime = this.updatePlaytime.bind(this);
  }

  async prepareToMount() {
    await super.prepareToMount();

    await this.playtimeModel.sync();
  }

  async mount() {
    const whitelistClans = await this.options.whitelisterClient.getWhitelistClans();
    this.#whitelistPlayers = Object.fromEntries(
      Object.entries(whitelistClans).map(
        ([clanTag, members]) => members.map(({ steamID }) => [steamID, clanTag]),
      ).flat(),
    );

    this.#trackingInterval = setInterval(this.updatePlaytime, TRACKING_INTERVAL);
  }

  async unmount() {
    clearInterval(this.#trackingInterval);
  }

  async updatePlaytime() {
    const date = moment.utc().startOf('day');
    const playerCount = this.server.playerCount;

    for (const player of this.server.players) {
      if (!player?.steamID) {
        continue;
      }

      const [playtime] = await this.playtimeModel.findOrCreate({
        where: {
          date: date,
          steamID: player.steamID,
        },
        defaults: {
          minutesPlayed: 0,
          minutesSeeded: 0,
          clanTag: this.#whitelistPlayers[player.steamID],
        },
      });

      if (playerCount < this.options.seedingStartsAt) {
        continue;
      } else if (playerCount > this.options.seedingEndsAt) {
        await playtime.increment('minutesPlayed');
      } else {
        await playtime.increment('minutesSeeded');
      }
    }

    this.verbose(1, `Updated playtime for ${playerCount} players.`);
  }

}
