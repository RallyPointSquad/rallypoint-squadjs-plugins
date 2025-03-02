import { ChannelManager, Client, TextChannel } from 'discord.js';
import { EventEmitter } from 'node:events';
import { SquadServer } from '../types/SquadJS.js';

export type DiscordClientMock = Partial<
  Omit<Client, 'channels'> & { channels: Pick<ChannelManager, 'fetch'> }
>;

export function mockDiscordClient() {
  const discordChannel: Pick<TextChannel, 'send'> = {
    send: vi.fn(),
  };

  const discordClient: DiscordClientMock = {
    channels: {
      fetch: vi.fn(async () => discordChannel as TextChannel),
    },
  };

  return {
    discordChannel,
    discordClient,
  };
}

export function mockSquadServer(extension: Partial<SquadServer> = {}) {
  const eventEmitter = new EventEmitter();
  const squadServer: Partial<SquadServer> = {
    get playerCount() {
      return this.players.length;
    },
    players: [],
  };
  Object.setPrototypeOf(squadServer, eventEmitter);
  return extension ? Object.setPrototypeOf(extension, squadServer) : squadServer;
}
