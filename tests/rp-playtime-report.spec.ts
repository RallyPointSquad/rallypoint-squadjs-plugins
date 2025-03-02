import { mockDiscordClient, mockSquadServer } from './support.js';
import { Sequelize } from 'sequelize';
import moment from 'moment';
import WhitelisterConnector from '../plugins/rp-whitelister-connector.js';
import PlaytimeReport, { formatTable } from '../plugins/rp-playtime-report.js';

describe('rp-playtime-tracker.js', () => {

  const squadServer = mockSquadServer({
    get playerCount() {
      return this.players.length;
    },
    players: [],
  });

  const {
    discordChannel,
    discordClient
  } = mockDiscordClient();

  const whitelisterClient: Partial<WhitelisterConnector> = {
    getWhitelistClans: async () => ({
      B: [{ steamID: '1' }],
    }),
  };

  function createPlugin() {
    return new PlaytimeReport(squadServer, {
      database: 'sqlite',
      discordClient: 'discord',
      channelID: 'channelId',
      whitelisterClient: 'whitelister',
    }, {
      discord: discordClient,
      sqlite: new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false
      }),
     whitelister: whitelisterClient,
    });
  };

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['Date']
    });
    vi.setSystemTime(new Date(0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('correctly formats table data', () => {
    const formatted = formatTable(
      ['FOO', 'BAR', 'Really Long Header'],
      [
        ['foo', '42', 'baz'],
        ['really long value', 'hello', 'world'],
      ],
      ['left', 'right', 'left'],
    );
    expect(formatted).toEqual([
      'FOO                 BAR     Really Long Header',
      '----------------------------------------------',
      'foo                    42   baz',
      'really long value   hello   world',
    ].join('\n'));
  });


  it('sends properly formatted message containing time tracked in previous seven days while including clans without time', async () => {
    const plugin = createPlugin();

    vi.spyOn(discordChannel, 'send').mockImplementation(async () => null);

    await plugin.prepareToMount();
    await plugin.mount();

    const today = moment.utc();
    const oneDayInPast = moment.utc().subtract(1, 'day');
    const sevenDaysInPast = moment.utc().subtract(7, 'day');
    const eightDaysInPast = moment.utc().subtract(8, 'day');

    await plugin.playtimeModel.sync();
    await plugin.playtimeModel.bulkCreate([
      { steamID: '1', date: oneDayInPast, minutesPlayed: 1, minutesSeeded: 1, clanTag: 'C' },
      { steamID: '2', date: eightDaysInPast, minutesPlayed: 100, minutesSeeded: 100, clanTag: 'A' },
      { steamID: '2', date: sevenDaysInPast, minutesPlayed: 1, minutesSeeded: 2, clanTag: 'A' },
      { steamID: '2', date: oneDayInPast, minutesPlayed: 5, minutesSeeded: 10, clanTag: 'A' },
      { steamID: '2', date: today, minutesPlayed: 200, minutesSeeded: 200, clanTag: 'A' },
      { steamID: '3', date: oneDayInPast, minutesPlayed: 1, minutesSeeded: 1, clanTag: 'D' },
    ]);

    await plugin.sendReport();

    const expectedMessage = {
      embed: {
        title: 'Clan statistics (in minutes)',
        description: `\`\`\`
Clan   Played   Seeded   Ratio
------------------------------
A           6       12     2.0
B           0        0       -
C           1        1     1.0
D           1        1     1.0
\`\`\``,
        fields: [
          {
            name: "From",
            value: "1969-12-25",
            inline: true
          },
          {
            name: "Till",
            value: "1969-12-31",
            inline: true
          }],
        footer: {
          text: "Powered by SquadJS, Copyright © 2025"
        }
      }
    }

    expect(discordChannel.send).toHaveBeenCalledOnce();
    expect(discordChannel.send).toHaveBeenCalledWith({
      ...expectedMessage,
      embeds: [expectedMessage.embed]
    });
  });

});
