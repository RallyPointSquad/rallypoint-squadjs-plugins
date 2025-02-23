import PlayerTracker from '../plugins/player-tracker.js';
import { Player, SquadServer } from '../types/SquadJS.js';
import { mockDiscordClient } from './support.js';
import { Sequelize, DataTypes } from 'sequelize';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import moment from 'moment';

describe('player-tracker.js', () => {

  const squadServer: Partial<SquadServer> = {
    playerCount: 0,
    players: []
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
        logging: false
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

    server.resetHandlers();
  });

  afterAll(() => { server.close(); });

  it('Multiple mounts do not destroy data', async () => {
    const plugin = createPlugin();

    await plugin.prepareToMount();
    await plugin.mount();

    const newPlaytimes = await plugin.models.NewPlaytime.bulkCreate({
      steamID: "1",
      date: (new Date).toISOString().substring(0, 10),
      minutesPlayed: 10,
      minutesSeeded: 3,
      clanTag: "A"
    });

    await plugin.unmount();

    await plugin.prepareToMount();
    await plugin.mount();

    expect(await plugin.models.NewPlaytime.findAll()).toEqual(newPlaytimes);
  });

  it.for([
    [new Date("2025-02-17T08:00:00.0Z"), new Date("2025-02-17T12:00:00.0Z")], // Monday before noon
    [new Date("2025-02-17T12:01:00.0Z"), new Date("2025-02-24T12:00:00.0Z")], // Monday after noon
    [new Date("2025-02-15T12:00:00.0Z"), new Date("2025-02-17T12:00:00.0Z")], // Saturday at noon
  ])('Calculates milliseconds to closest next Monday noon at %s', async ([systemDate, expectedTimeOfTheMessage]) => {
    vi.setSystemTime(systemDate);

    const plugin = createPlugin();

    await plugin.prepareToMount();
    await plugin.mount();

    const actualTimeoutValue: number = plugin.getMillisecondsToTheNextMondayNoon();

    expect(new Date(systemDate.getTime() + actualTimeoutValue)).toEqual(expectedTimeOfTheMessage);
  });

  it('Sends properly formatted message containing time tracked in previous seven days', async () => {
    const plugin = createPlugin();

    let mockSend = vi.spyOn(discordChannel, 'send').mockImplementation(async () => null);

    await plugin.prepareToMount();
    await plugin.mount();

    const today = moment.utc();
    const oneDayInPast = moment.utc().subtract(1, 'day');
    const sevenDaysInPast = moment.utc().subtract(7, 'day');
    const eightDaysInPast = moment.utc().subtract(8, 'day');

    await plugin.models.NewPlaytime.bulkCreate([
      { steamID: "1", date: eightDaysInPast, minutesPlayed: 100, minutesSeeded: 100, clanTag: 'A' },
      { steamID: "1", date: sevenDaysInPast, minutesPlayed: 1, minutesSeeded: 2, clanTag: 'A' },
      { steamID: "1", date: oneDayInPast, minutesPlayed: 5, minutesSeeded: 10, clanTag: 'A' },
      { steamID: "1", date: today, minutesPlayed: 200, minutesSeeded: 200, clanTag: 'A' },
    ]);

    await plugin.sendStatistics();

    const expectedMessage = {
      embed: {
        title: 'Clan statistics (in minutes)',
        description: `\`\`\`
Clan       Played   Seeded   Ratio
----------------------------------
A               6       12     0.5
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
    //[null, 'A               0        0       -'],
  ])('Formats $minutesPlayed played and $minutesSeeded seeded minutes in the message', async (playtime, expectedMessagePart) => {
    const plugin = createPlugin();

    let mockSend = vi.spyOn(discordChannel, 'send').mockImplementation(async () => null);

    await plugin.prepareToMount();
    await plugin.mount();

    if (playtime) {
      await plugin.models.NewPlaytime.create({
        steamID: "1",
        date: moment.utc().subtract(1, 'day'),
        ...playtime,
        clanTag: 'A'
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

  it('Migrates data into new table', async () => {
    const plugin = createPlugin();

    const player = plugin.options.database.define(`PlayerTracker_Player`, {
      steamID: {
        type: DataTypes.STRING,
        primaryKey: true
      },
      clanTag: {
        type: DataTypes.STRING
      }
    });

    const playtime = plugin.options.database.define(`PlayerTracker_Playtime`, {
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
      }
    });

    await player.sync();
    await playtime.sync();

    await player.create({ steamID: "1", clanTag: "A" });
    await playtime.create({ steamID: "1", date: new Date(0), minutesPlayed: 1, minutesSeeded: 2 });

    await plugin.prepareToMount();

    const players = await plugin.models.Player.findAll();
    const playtimes = await plugin.models.Playtime.findAll();
    const newPlaytimes = await plugin.models.NewPlaytime.findAll({ raw: true });

    expect(players).toHaveLength(1);
    expect(playtimes).toHaveLength(1);
    expect(newPlaytimes).toEqual([{ steamID: '1', date: (new Date).toISOString().substring(0, 10), minutesPlayed: 1, minutesSeeded: 2, clanTag: 'A' }]);
  });

  it.each([
    { playerCount: 0, expectedPlayedTime: 0, expectedSeededTime: 0 },
    { playerCount: 10, expectedPlayedTime: 0, expectedSeededTime: 1 },
    { playerCount: 65, expectedPlayedTime: 1, expectedSeededTime: 0 }
  ])('Logs time of a player at server population $playerCount', async ({ playerCount, expectedPlayedTime, expectedSeededTime }) => {
    const plugin = createPlugin();

    vi.spyOn(squadServer, 'playerCount', 'get').mockReturnValue(playerCount);
    vi.spyOn(squadServer, 'players', 'get').mockReturnValue([
      { steamID: null, playerID: 0, name: '', isLeader: false, teamID: 0, squadID: 0 },
      { steamID: '1', playerID: 0, name: '', isLeader: false, teamID: 0, squadID: 0 },
      { steamID: '2', playerID: 0, name: '', isLeader: false, teamID: 0, squadID: 0 }
    ]);

    await plugin.prepareToMount();

    plugin.whitelistClansBySteamId = {
      1: 'A'
    }

    await plugin.updatePlaytime();
    await plugin.updatePlaytime();

    const newPlaytimes = await plugin.models.NewPlaytime.findAll({ raw: true });

    expect(newPlaytimes).toEqual([
      { steamID: '1', date: (new Date).toISOString().substring(0, 10), minutesPlayed: expectedPlayedTime * 2, minutesSeeded: expectedSeededTime * 2, clanTag: 'A' },
      { steamID: '2', date: (new Date).toISOString().substring(0, 10), minutesPlayed: expectedPlayedTime * 2, minutesSeeded: expectedSeededTime * 2, clanTag: null }
    ]);
  });

  it('Loads clans from whitelister on mount', async () => {
    const plugin = createPlugin();

    server.use(
      http.get('https://www.whitelister.com/api/clans/getAllClans', () => {
        return HttpResponse.json([
          { _id: 101, tag: 'ClanWithMultiplePlayers' },
          { _id: 102, tag: 'ClanWithSinglePlayers' },
          { _id: 103, tag: 'ClanWithoutPlayers' }
        ]);
      }, {
        once: true,
      }),
      http.get('https://www.whitelister.com/api/whitelist/read/getAll', () => {
        return HttpResponse.json([
          { id_clan: 101, steamid64: 'A' },
          { id_clan: 101, steamid64: 'B' },
          { id_clan: 102, steamid64: 'C' },
          { id_clan: 999, steamid64: 'X' },
        ]);
      }, {
        once: true,
      })
    );

    await plugin.mount();

    expect(plugin.whitelistClansBySteamId).toEqual({
      A: 'ClanWithMultiplePlayers',
      B: 'ClanWithMultiplePlayers',
      C: 'ClanWithSinglePlayers',
    });
  });
});
