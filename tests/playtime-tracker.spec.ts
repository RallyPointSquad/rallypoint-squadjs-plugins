import PlaytimeTracker, { TRACKING_INTERVAL } from '../plugins/playtime-tracker.js';
import { Player, SquadServer } from '../types/SquadJS.js';
import { mockDiscordClient } from './support.js';
import { Sequelize } from 'sequelize';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import moment from 'moment';
import WhitelisterConnector from '../plugins/whitelister-connector.js';

describe('playtime-tracker.js', () => {

  const samplePlayers: Partial<Player>[] = [
    { name: 'john', steamID: '1' },
    { name: 'jane', steamID: '2' },
    { name: 'joe', steamID: '3' },
    { name: 'jim', steamID: '4' },
  ];

  const squadServer: Partial<SquadServer> = {
    get playerCount() {
      return this.players.length;
    },
    players: []
  };

  const whitelisterClient: Partial<WhitelisterConnector> = {
    getWhitelistClans: async () => ({
      FOO: [{ steamID: '1' }],
      BAR: [{ steamID: '2' }],
      BAZ: [{ steamID: '3' }],
    }),
  };

  function createPlugin() {
    return new PlaytimeTracker(squadServer, {
      database: 'sqlite',
      seedingStartsAt: 2,
      seedingEndsAt: 2,
      whitelisterClient: 'whitelister',
    }, {
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
      toFake: ['Date', 'setInterval', 'clearInterval']
    });
    vi.setSystemTime(new Date(0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('multiple mounts do not destroy data', async () => {
    const plugin = createPlugin();

    await plugin.prepareToMount();
    await plugin.mount();

    const samplePlaytime = {
      steamID: '123456',
      date: '1970-01-01',
      minutesPlayed: 10,
      minutesSeeded: 3,
      clanTag: 'FOOBAR'
    };

    await plugin.playtimeModel.create(samplePlaytime);

    await plugin.unmount();

    await plugin.prepareToMount();
    await plugin.mount();

    const playtimes = await plugin.playtimeModel.findAll({ raw: true});
    expect(playtimes).toEqual([samplePlaytime]);
  });

  it('correctly tracks playtime', async () => {
    const plugin = createPlugin();

    const playersGetter = vi.spyOn(squadServer, 'players', 'get');
    const updatePlaytime = vi.spyOn(plugin, 'updatePlaytime');

    const advanceUpdate = async (players: Partial<Player>[]) => {
      await updatePlaytime.mockClear();
      playersGetter.mockReturnValue(players as Player[]);
      await vi.advanceTimersByTimeAsync(TRACKING_INTERVAL);
      await updatePlaytime.mock.results[0].value;
      return await plugin.playtimeModel.findAll({
        raw: true,
        order: ['date', 'steamID'],
      });
    };

    plugin.prepareToMount();
    plugin.mount();

    // 0 players - empty server
    const whenEmptyServer = await advanceUpdate([]);
    expect(whenEmptyServer).toEqual([]);

    // 1 player - not yet seeding
    const whenNotYetSeeding = await advanceUpdate(samplePlayers.slice(0, 1));
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(whenNotYetSeeding).toEqual([
      { date: '1970-01-01', steamID: '1', minutesPlayed: 0, minutesSeeded: 0, clanTag: 'FOO' }
    ]);

    // 2 players - seeding started
    const whenSeedingStarted = await advanceUpdate(samplePlayers.slice(0, 2));
    expect(whenSeedingStarted).toEqual([
      { date: '1970-01-01', steamID: '1', minutesPlayed: 0, minutesSeeded: 1, clanTag: 'FOO' },
      { date: '1970-01-01', steamID: '2', minutesPlayed: 0, minutesSeeded: 1, clanTag: 'BAR' }
    ]);

    const whenSeedingContinues = await advanceUpdate(samplePlayers.slice(0, 2));
    expect(whenSeedingContinues).toEqual([
      { date: '1970-01-01', steamID: '1', minutesPlayed: 0, minutesSeeded: 2, clanTag: 'FOO' },
      { date: '1970-01-01', steamID: '2', minutesPlayed: 0, minutesSeeded: 2, clanTag: 'BAR' }
    ]);

    // 3 players - game started
    const whenGameStarted = await advanceUpdate(samplePlayers.slice(0, 3));
    expect(whenGameStarted).toEqual([
      { date: '1970-01-01', steamID: '1', minutesPlayed: 1, minutesSeeded: 2, clanTag: 'FOO' },
      { date: '1970-01-01', steamID: '2', minutesPlayed: 1, minutesSeeded: 2, clanTag: 'BAR' },
      { date: '1970-01-01', steamID: '3', minutesPlayed: 1, minutesSeeded: 0, clanTag: 'BAZ' }
    ]);

    // 4 players - game continues (with a player without clan tag)
    const whenGameContinues = await advanceUpdate([
      undefined, // I guess this can happen, not sure how or why
      ...samplePlayers
    ]);
    expect(whenGameContinues).toEqual([
      { date: '1970-01-01', steamID: '1', minutesPlayed: 2, minutesSeeded: 2, clanTag: 'FOO' },
      { date: '1970-01-01', steamID: '2', minutesPlayed: 2, minutesSeeded: 2, clanTag: 'BAR' },
      { date: '1970-01-01', steamID: '3', minutesPlayed: 2, minutesSeeded: 0, clanTag: 'BAZ' },
      { date: '1970-01-01', steamID: '4', minutesPlayed: 1, minutesSeeded: 0, clanTag: null }
    ]);

    // 4 players - seeding during the next day
    vi.setSystemTime(new Date(24 * 60 * 60 * 1000));
    const whenSeedingNextDay = await advanceUpdate(samplePlayers.slice(1, 3));
    expect(whenSeedingNextDay).toEqual([
      { date: '1970-01-01', steamID: '1', minutesPlayed: 2, minutesSeeded: 2, clanTag: 'FOO' },
      { date: '1970-01-01', steamID: '2', minutesPlayed: 2, minutesSeeded: 2, clanTag: 'BAR' },
      { date: '1970-01-01', steamID: '3', minutesPlayed: 2, minutesSeeded: 0, clanTag: 'BAZ' },
      { date: '1970-01-01', steamID: '4', minutesPlayed: 1, minutesSeeded: 0, clanTag: null },
      { date: '1970-01-02', steamID: '2', minutesPlayed: 0, minutesSeeded: 1, clanTag: 'BAR' },
      { date: '1970-01-02', steamID: '3', minutesPlayed: 0, minutesSeeded: 1, clanTag: 'BAZ' },
    ]);
  });

});
