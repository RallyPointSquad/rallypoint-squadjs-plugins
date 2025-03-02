import { Message } from 'discord.js';
import DiscordSeedCall from '../plugins/rp-discord-seed-call.js';
import { SquadServer } from '../types/SquadJS.js';
import { mockDiscordClient } from './support.js';

describe('rp-discord-seed-call.js', () => {

  const squadServer: Partial<SquadServer> = {
    playerCount: 0,
  };

  const {
    discordChannel,
    discordClient
  } = mockDiscordClient();

  function createPlugin() {
    return new DiscordSeedCall(squadServer, {
      discordClient: 'discord',
      channelID: '123456',
      time: '12:00',
      message: 'HELLO WORLD'
    }, {
      discord: discordClient
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('sends message when not yet seeded', async () => {
    const plugin = createPlugin();

    const message = {
      content: plugin.options.message,
      crosspost: vi.fn()
    } as unknown as Message<true>;

    vi.spyOn(discordChannel, 'send').mockImplementation(async () => message);

    await plugin.prepareToMount();
    await plugin.mount();

    vi.clearAllTimers();
    await plugin.sendMessage();

    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);
    expect(vi.getTimerCount()).toBe(0);

    expect(discordChannel.send).toHaveBeenCalledOnce();
    expect(discordChannel.send).toHaveBeenCalledWith({
      'content': 'HELLO WORLD',
      'allowedMentions': {
        'parse': [
          'roles',
        ],
      },
    });
    expect(message.crosspost).toHaveBeenCalledOnce();
  });

  it('does not send message when already seeded', async () => {
    const plugin = createPlugin();

    vi.spyOn(squadServer, 'playerCount', 'get').mockReturnValue(80);

    await plugin.prepareToMount();
    await plugin.mount();

    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);
    expect(vi.getTimerCount()).toBe(0);

    expect(discordChannel.send).not.toHaveBeenCalled();
  });

});
