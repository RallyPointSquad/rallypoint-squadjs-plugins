import moment from 'moment';
import Sequelize from 'sequelize';
import { stringify } from 'querystring';
import DiscordBasePlugin from './discord-base-plugin.js';

const { DataTypes, Op } = Sequelize;

/**
 * @typedef {Object} ExtraPluginOptions
 * @property {Sequelize.Sequelize} database
 * @property {string} whitelisterApiUrl
 * @property {string} whitelisterApiKey
 * @property {string} whitelisterApiPlayerListId
 * @property {number} seedingStartsAt
 * @property {number} seedingEndsAt
 */

/**
 * @extends {DiscordBasePlugin<ExtraPluginOptions>}
 */
export default class PlayerTracker extends DiscordBasePlugin {

  static get description() {
    return 'The <code>PlayerTracker</code> plugin tracks hours played by players in a period of time and reports the data in a Discord channel.';
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      ...DiscordBasePlugin.optionsSpecification,
      channelID: {
        required: true,
        description: 'The ID of the channel to send the data message to.',
        default: '',
        example: '667741905228136459'
      },
      database: {
        required: true,
        connector: 'sequelize',
        description: 'The Sequelize connector to log player information to.',
        default: 'mysql'
      },
      whitelisterApiUrl: {
        required: true,
        description: 'The URL of whitelister API.',
        default: '',
        example: 'https://rally-point.corrupted-infantry.com'
      },
      whitelisterApiKey: {
        required: true,
        description: 'The API key for accessing whitelister.',
        default: '',
        example: 'q1EMSOG4nNh5TMmZKbVGWTmKU8VF30WJz4tqvUguPec0NzXP3vo3zV9RfCXMZFMpq1EMSOG4nNh5TMmZKbVGWTmKU8VF30WJz4tqvUguPec0NzXP3vo3zV9RfCXMZFMp'
      },
      whitelisterApiPlayerListId: {
        required: true,
        description: 'Identifier of the list associated with clan whitelists.',
        default: '',
        example: '6707e4bebc0764367fc41fd6'
      },
      seedingStartsAt: {
        required: false,
        description: 'The minimum number of players connected to the server in order for the plugin to consider server to be seeding.',
        default: 4,
        example: 4
      },
      seedingEndsAt: {
        required: false,
        description: 'The maximum number of players connected to the server in order for the plugin to consider server to be seeding.',
        default: 60,
        example: 60
      }
    }
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.whitelistClansBySteamId = {};
    this.models = {};

    this.createModel(
      'Playtime',
      {
        steamID: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        date: {
          type: DataTypes.DATEONLY,
          primaryKey: true
        },
        minutesPlayed: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        minutesSeeded: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        clanTag: {
          type: DataTypes.STRING
        }
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
      }
    );

    this.updatePlaytime = this.updatePlaytime.bind(this);
    this.sendStatistics = this.sendStatistics.bind(this);
  }

  createModel(name, schema, options) {
    this.models[name] = this.options.database.define(`PlayerTracker_${name}`, schema, {
      ...options,
      timestamps: false
    });
  }

  async prepareToMount() {
    await super.prepareToMount();

    await this.models.Playtime.sync();
  }

  async mount() {
    await this.loadWhitelisterClans();

    this.interval = setInterval(this.updatePlaytime, 60_000);
    this.timeout = setTimeout(this.sendStatistics, this.getMillisecondsToTheNextMondayNoon());
  }

  async unmount() {
    clearInterval(this.interval);
    clearTimeout(this.timeout);
  }

  async loadWhitelisterClans() {
    const clansResponse = await fetch(`${this.options.whitelisterApiUrl}/api/clans/getAllClans?${stringify({
      apiKey: this.options.whitelisterApiKey
    })}`);

    const clans = await clansResponse.json();

    const clantagsById = clans.reduce((acc, clan) => {
      acc[clan._id] = clan.tag;
      return acc;
    }, {});

    const playersResponse = await fetch(`${this.options.whitelisterApiUrl}/api/whitelist/read/getAll?${stringify({
      apiKey: this.options.whitelisterApiKey,
      sel_list_id: this.options.whitelisterApiPlayerListId
    })}`);

    const players = await playersResponse.json();

    this.whitelistClansBySteamId = players.reduce((acc, player) => {
      const clanTag = clantagsById[player.id_clan];

      if (clanTag) {
        acc[player.steamid64] = clanTag;
      }

      return acc;
    }, {});
  }

  async updatePlaytime() {
    const date = moment.utc().startOf('day');
    const playerCount = this.server.playerCount;

    for (let index in this.server.players) {
      const steamId = this.server.players[index]?.steamID;

      if (!steamId) {
        continue;
      }

      const [playtime] = await this.models.Playtime.findOrCreate({
        where: {
          date: date,
          steamID: steamId
        },
        defaults: {
          minutesPlayed: 0,
          minutesSeeded: 0,
          clanTag: this.whitelistClansBySteamId[steamId]
        }
      });

      if (playerCount < this.options.seedingStartsAt) {
        continue;
      } else if (playerCount > this.options.seedingEndsAt) {
        await playtime.increment('minutesPlayed');
      } else {
        await playtime.increment('minutesSeeded');
      }
    }
  }

  getMillisecondsToTheNextMondayNoon() {
    const now = moment.utc();
    const messageTime = moment.utc().subtract(12, 'h').add(7, 'day').startOf('isoWeek').add(12, 'h');
    return messageTime.valueOf() - now.valueOf();
  }

  async sendStatistics() {
    const dateFrom = moment.utc().subtract(7, 'day').startOf('day');
    const dateTill = moment.utc().subtract(1, 'day').startOf('day');

    const playtimes = await this.models.Playtime.findAll({
      raw: true,
      attributes: [
        'clanTag',
        [Sequelize.fn('SUM', Sequelize.col('minutesSeeded')), 'totalMinutesSeeded'],
        [Sequelize.fn('SUM', Sequelize.col('minutesPlayed')), 'totalMinutesPlayed'],
      ],
      where: {
        date: {
          [Op.between]: [dateFrom, dateTill]
        }
      },
      group: ['clanTag']
    });

    const curentClans = [...new Set(Object.values(this.whitelistClansBySteamId))];

    curentClans.forEach(clanTag => {
      if (!playtimes.some(playtime => playtime.clanTag === clanTag)) {
        playtimes.push({ clanTag });
      }
    });

    await this.sendDiscordMessage({
      embed: {
        title: 'Clan statistics (in minutes)',
        description: `\`\`\`\n${this.formatTable(playtimes)}\`\`\``,
        fields: [
          {
            name: 'From',
            value: dateFrom.format('YYYY-MM-DD'),
            inline: true
          },
          {
            name: 'Till',
            value: dateTill.format('YYYY-MM-DD'),
            inline: true
          }
        ]
      }
    });
  }

  /**
   * @param {any[]} data
   */
  formatTable(data) {
    data.sort((a, b) => a.clanTag.localeCompare(b.clanTag));

    let table = 'Clan       Played   Seeded   Ratio\n----------------------------------\n';

    data.forEach(item => {
      const seeded = item.totalMinutesSeeded ?? 0;
      const played = item.totalMinutesPlayed ?? 0;
      const ratio = played / seeded;

      let ratioString = ratio.toFixed(1);
      if (ratio >= 1000) {
        ratioString = '999.9';
      } else if (isNaN(ratio)) {
        ratioString = '-';
      }

      table += `${String(item.clanTag ?? 'N/A').padEnd(10)} ${String(played).padStart(6)}   ${String(seeded).padStart(6)}   ${String(ratioString).padStart(5)}\n`;
    });

    return table;
  }
}
