import PlayerTracker from '../plugins/player-tracker.js';
import { SquadServer } from '../types/SquadJS.js';
import { mockDiscordClient } from './support.js';
import { Sequelize } from 'sequelize';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import moment from 'moment';

describe('player-tracker.js', () => {

  const squadServer: Partial<SquadServer> = {
    playerCount: 0,
  };

  const {
    discordChannel,
    discordClient
  } = mockDiscordClient();

  const handlers = [
    http.get('https://www.whitelister.com/api/clans/getAllClans', () => {
      return HttpResponse.json([]);
    }),
    http.get('https://www.whitelister.com/api/whitelist/read/getAll', () => {
      return HttpResponse.json([]);
    }),
  ];

  const server = setupServer(...handlers);

  function createPlugin() {
    return new PlayerTracker(squadServer, {
      discordClient: 'discord',
      channelID: 'channelId',
      database: 'sqlite',
      whitelisterApiUrl: 'https://www.whitelister.com',
      whitelisterApiKey: 'tqvUguPec0NzXP3vo3zV9RfCXMZFMpEnu7snBqWm4ckSUltqxSKa6tyEO',
      whitelisterApiPlayerListId: '7e4bebc07fc41'
    }, {
      discord: discordClient,
      sqlite: new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
      })
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();

    server.resetHandlers()
  });

  afterAll(() => { server.close(); });

  it('Multiple mounts do not destroy data', async () => {
    const plugin = createPlugin();

    await plugin.prepareToMount();
    await plugin.mount();

    const playerData = {
      steamID: "1",
      clanTag: "A"
    };

    const playtimeData = {
      steamID: "1",
      date: (new Date).toISOString().substring(0, 10),
      minutesPlayed: 10,
      minutesSeeded: 3
    };

    await plugin.models.Player.upsert(playerData);
    await plugin.models.Playtime.upsert(playtimeData);

    await plugin.unmount();

    await plugin.prepareToMount();
    await plugin.mount();

    expect(await plugin.models.Player.findAll({ raw: true })).toEqual([playerData]);
    expect(await plugin.models.Playtime.findAll({ raw: true })).toEqual([playtimeData]);
  });

  it.for([
    [new Date("2025-02-17T08:00:00.0Z"), new Date("2025-02-17T12:00:00.0Z")], // Monday before noon
    [new Date("2025-02-17T12:01:00.0Z"), new Date("2025-02-24T12:00:00.0Z")], // Monday after noon
    [new Date("2025-02-15T12:00:00.0Z"), new Date("2025-02-17T12:00:00.0Z")], // Saturday at noon
  ])('Calculates milliseconds to closest next Monday noon', async ([systemDate, expectedTimeOfTheMessage]) => {
    vi.setSystemTime(systemDate);

    const plugin = createPlugin();

    await plugin.prepareToMount();
    await plugin.mount();

    const actualTimeoutValue: number = plugin.getMillisecondsToTheNextMondayNoon();

    expect(new Date(systemDate.getTime() + actualTimeoutValue)).toEqual(expectedTimeOfTheMessage);
  });

  it('Sends properly formatted message containing time tracked in previous seven days summed by clan', async () => {
    const plugin = createPlugin();

    let mockSend = vi.spyOn(discordChannel, 'send').mockImplementation(async () => null);

    await plugin.prepareToMount();
    await plugin.mount();

    await plugin.models.Player.bulkCreate([
      { steamID: "1", clanTag: "A" },
      { steamID: "2", clanTag: "A" },
      { steamID: "3", clanTag: "B" }
    ]);

    await plugin.models.Playtime.bulkCreate([
      // playtime 8 dyas in the past
      {
        steamID: "1",
        date: moment.utc().subtract(8, 'day'),
        minutesPlayed: 100,
        minutesSeeded: 200
      },
      // playtime for today
      {
        steamID: "1",
        date: moment.utc(),
        minutesPlayed: 100,
        minutesSeeded: 200
      },
      {
        steamID: "1",
        date: moment.utc().subtract(1, 'day'),
        minutesPlayed: 1,
        minutesSeeded: 1
      },
      {
        steamID: "1",
        date: moment.utc().subtract(2, 'day'),
        minutesPlayed: 5,
        minutesSeeded: 5
      },
      {
        steamID: "2",
        date: moment.utc().subtract(3, 'day'),
        minutesPlayed: 20,
        minutesSeeded: 20
      },
      {
        steamID: "3",
        date: moment.utc().subtract(4, 'day'),
        minutesPlayed: 10,
        minutesSeeded: 3
      },
    ]);

    await plugin.sendStatistics();

    const expectedMessage = {
      embed: {
        title: 'Clan statistics (in minutes)',
        description: `\`\`\`
Clan       Played   Seeded   Ratio
----------------------------------
A              26       26     1.0
B              10        3     3.3
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

    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({ ...expectedMessage, embeds: [expectedMessage.embed] });
  });

  it.each([
    [{ minutesPlayed: 1, minutesSeeded: 1 }, 'A               1        1     1.0'],
    [{ minutesPlayed: 0, minutesSeeded: 0 }, 'A               0        0       -'],
    [{ minutesPlayed: 1, minutesSeeded: 0 }, 'A               1        0   999.9'],
    [{ minutesPlayed: 0, minutesSeeded: 1 }, 'A               0        1     0.0'],
    [{ minutesPlayed: 1, minutesSeeded: 1000 }, 'A               1     1000     0.0'],
    [{ minutesPlayed: 1000, minutesSeeded: 1 }, 'A            1000        1   999.9'],
    [null, 'A               0        0       -'],
  ])('Formats %s into %s', async (playtime, expectedMessagePart) => {
    const plugin = createPlugin();

    let mockSend = vi.spyOn(discordChannel, 'send').mockImplementation(async () => null);

    await plugin.prepareToMount();
    await plugin.mount();

    await plugin.models.Player.create({
      steamID: "1",
      clanTag: "A"
    });

    if (playtime) {
      await plugin.models.Playtime.create({
        steamID: "1",
        date: moment.utc().subtract(1, 'day'),
        ...playtime
      });
    }

    await plugin.sendStatistics();

    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      embed: expect.objectContaining({
        description: expect.stringContaining(expectedMessagePart)
      }),
      embeds: expect.anything()
    }));
  });
});
