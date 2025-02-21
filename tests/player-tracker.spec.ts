import { Message } from 'discord.js';
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

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
  });

  const handlers = [
    http.get('https://www.whitelister.com/api/clans/getAllClans', () => {
      return HttpResponse.json();
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
      sqlite: sequelize
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

  it('Sends properly formatted message', async () => {
    const date = moment.utc().subtract(1, 'day').startOf('day');
    const plugin = createPlugin();

    let mockSend = vi.spyOn(discordChannel, 'send').mockImplementation(async () => null);

    await plugin.prepareToMount();
    await plugin.mount();

    await plugin.models.Player.upsert({
      steamID: "1",
      clanTag: "A"
    });

    await plugin.models.Playtime.upsert({
      steamID: "1",
      date: date,
      minutesPlayed: 10,
      minutesSeeded: 3
    })

    await plugin.sendStatistics();

    expect(mockSend).toHaveBeenCalledOnce();

    //console.log(JSON.stringify(mockSend.mock.calls[0]));

    const expectedMessage = {
      embed: {
        title: "Clan statistics (in minutes)",
        description: "```\nClan       Seeded   Played   Ratio\nA               3       10     3.3\n```",
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

    expect(mockSend).toHaveBeenCalledWith({ ...expectedMessage, embeds: [expectedMessage.embed] });

    await plugin.unmount();
  });
});
