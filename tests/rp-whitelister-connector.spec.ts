import PlaytimeTracker from '../plugins/rp-playtime-tracker.js';
import { SquadServer } from '../types/SquadJS.js';
import { mockDiscordClient } from './support.js';
import { Sequelize } from 'sequelize';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import moment from 'moment';
import WhitelisterConnector from '../plugins/rp-whitelister-connector.js';

describe('rp-whitelister-connector.js', () => {

  function createPlugin(connectors = {}) {
    return new WhitelisterConnector(null, {
      whitelisterUrl: 'http://whitelist.local',
      whitelistGroup: 'Whitelist',
    }, connectors);
  };

  const mockServer = setupServer();

  beforeAll(() => {
    mockServer.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    vi.resetAllMocks();
    mockServer.resetHandlers();
  });

  afterAll(() => {
    mockServer.close();
  });

  it('injects itself as connector', () => {
    const connectors = {};
    const plugin = createPlugin(connectors);
    expect(connectors['whitelister']).toBe(plugin);
  });

  it('correctly parses whitelist entries', async () => {
    const plugin = createPlugin();

    mockServer.use(http.get('http://whitelist.local/wl', () => {
      return HttpResponse.text([
        'Group=Foobar:reserve',
        'Group=Whitelist:reserve',
        '',
        'Admin=1000000000001:Foobar // [FOO] john doe',
        'Admin=1000000000001:Whitelist // [FOO] john doe',
        'Admin=1000000000002:Whitelist // [BAZ] jane doe',
      ].join('\n'));
    }));

    const players = await plugin.getWhitelistPlayers();
    expect(players).toEqual([
      { steamID: '1000000000001', groupName: 'Foobar', listName: 'FOO' },
      { steamID: '1000000000001', groupName: 'Whitelist', listName: 'FOO' },
      { steamID: '1000000000002', groupName: 'Whitelist', listName: 'BAZ' },
    ]);
  });

  it('correctly extracts clan players', async () => {
    const plugin = createPlugin();

    mockServer.use(http.get('http://whitelist.local/wl', () => {
      return HttpResponse.text([
        'Admin=1000000000001:Foobar // [FOO] john doe',
        'Admin=1000000000001:Whitelist // [FOO] john doe',
        'Admin=1000000000002:Whitelist // [BAZ] jane doe',
        'Admin=1000000000003:Whitelist // [BAZ] jack reacher',
        'Admin=1000000000003:Foobar // [FOO] jack reacher',
        'Admin=1000000000003:Whitelist // [Discord Role] jack reacher',
      ].join('\n'));
    }));

    const clans = await plugin.getWhitelistClans();
    expect(Object.keys(clans)).toEqual(['FOO', 'BAZ']);
    expect(clans['FOO'].map(it => it.steamID)).toEqual(['1000000000001']);
    expect(clans['BAZ'].map(it => it.steamID)).toEqual(['1000000000002', '1000000000003']);
  });

});
