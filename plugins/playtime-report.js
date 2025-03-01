import moment from 'moment';
import DiscordBasePlugin from './discord-base-plugin.js';
import { createPlaytimeModel } from './playtime-tracker.js';
import { Op, Sequelize } from 'sequelize';

/**
 * @typedef {import('./whitelister-connector.js').default} WhitelisterConnector
 */

/**
 * @param {string[]} header
 * @param {string[][]} data
 * @param {('left'|'right')[]} align
 */
export function formatTable(header, data, align = [], divider = '   ') {
  let columnLengths = data.reduce(
    (acc, values) => values.map((it, idx) => Math.max(acc[idx], it.length)),
    header.map(it => it.length),
  );
  let totalLength = columnLengths.reduce(
    (acc, it) => acc + it + divider.length, 0,
  ) - divider.length;

  const formatCell = (value, length, align) => {
    return align === 'right' ? value.padStart(length) : value.padEnd(length);
  };

  const formatLine = values => {
    return values.map((it, idx) => formatCell(it, columnLengths[idx], align[idx]))
      .join(divider)
      .trimEnd();
  };

  return [
    header.map((it, idx) => formatCell(it, columnLengths[idx])).join(divider).trimEnd(),
    '-'.repeat(totalLength),
  ].concat(data.map(formatLine)).join('\n');
}

/**
 * @typedef {Object} ExtraPluginOptions
 * @property {import('sequelize').Sequelize} database
 * @property {WhitelisterConnector} whitelisterClient
 */

/**
 * @extends {DiscordBasePlugin<ExtraPluginOptions>}
 */
export default class PlaytimeReport extends DiscordBasePlugin {

  static get description() {
    return 'The <code>PlaytimeReport</code> uses data collected by <code>PlaytimeTracker</code> plugin and generates cumulative clan-based report.'
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      ...DiscordBasePlugin.optionsSpecification,
      database: {
        required: false,
        connector: 'sequelize',
        description: 'The Sequelize connector to read playtime information from.',
        default: 'mysql',
      },
      whitelisterClient: {
        required: false,
        description: 'The Whitelister connector plugin.',
        default: 'whitelister',
      },
      channelID: {
        required: true,
        description: 'The ID of the channel to send the report message to.',
        default: '',
        example: '667741905228136459',
      },
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
    this.options.whitelisterClient = connectors[options.whitelisterClient];

    this.playtimeModel = createPlaytimeModel(this.options.database);

    this.sendReport = this.sendReport.bind(this);
  }

  async mount() {
    this.server.on('SEND_PLAYTIME_REPORT', this.sendReport);
  }

  async unmount() {
    this.server.removeListener('SEND_PLAYTIME_REPORT', this.sendReport);
  }

  /**
   * @returns {Promise<{ clanTag: string, seeded: number, played: number, ratio: number }[]>}
   */
  async generateReport(dateFrom, dateTill) {
    const trackedData = await this.playtimeModel.findAll({
      raw: true,
      attributes: [
        'clanTag',
        [Sequelize.fn('SUM', Sequelize.col('minutesSeeded')), 'seeded'],
        [Sequelize.fn('SUM', Sequelize.col('minutesPlayed')), 'played'],
      ],
      where: {
        date: {
          [Op.between]: [dateFrom, dateTill],
        },
        clanTag: {
          [Op.not]: null,
        },
      },
      group: ['clanTag'],
    });

    const trackedPlaytime = trackedData.map(it => ({
      clanTag: it['clanTag'],
      seeded: it['seeded'],
      played: it['played'],
      ratio: Math.min(it['seeded'] / it['played'], 999.9),
    }));

    const trackedClans = new Set(trackedPlaytime.map(it => it.clanTag));
    const missingPlaytime = Object.keys(await this.options.whitelisterClient.getWhitelistClans())
      .filter(it => !trackedClans.has(it))
      .map(it => ({ clanTag: it, seeded: 0, played: 0, ratio: NaN }));

    return trackedPlaytime
      .concat(missingPlaytime)
      .toSorted((a, b) => a.clanTag.localeCompare(b.clanTag));
  }

  async sendReport() {
    const dateFrom = moment.utc().subtract(7, 'day').startOf('day');
    const dateTill = moment.utc().subtract(1, 'day').startOf('day');

    const playtimeData = await this.generateReport(dateFrom, dateTill);

    const formattedData = formatTable(
      ['Clan', 'Played', 'Seeded', 'Ratio'],
      playtimeData.map(it => [
        it.clanTag,
        String(it.played),
        String(it.seeded),
        Number.isNaN(it.ratio) ? '-' : it.ratio.toFixed(1),
      ]),
      ['left', 'right', 'right', 'right'],
    );

    await this.sendDiscordMessage({
      embed: {
        title: 'Clan statistics (in minutes)',
        description: `\`\`\`\n${formattedData}\n\`\`\``,
        fields: [
          {
            name: 'From',
            value: dateFrom.format('YYYY-MM-DD'),
            inline: true,
          },
          {
            name: 'Till',
            value: dateTill.format('YYYY-MM-DD'),
            inline: true,
          },
        ],
      },
    });
  }

}
