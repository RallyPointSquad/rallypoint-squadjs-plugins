import { ChannelManager, Client, TextChannel } from "discord.js";
import { SquadServer } from '../types/SquadJS.js';
import { EventEmitter } from 'node:events';

export type DiscordClientMock = Partial<
  Omit<Client, 'channels'> & { channels: Pick<ChannelManager, 'fetch'> }
>;

export function mockDiscordClient() {
  const discordChannel: Pick<TextChannel, 'send'> = {
    send: vi.fn()
  };

  const discordClient: DiscordClientMock = {
    channels: {
      fetch: vi.fn(async () => discordChannel as TextChannel)
    }
  };

  return {
    discordChannel,
    discordClient
  };
}

export function mockSquadServer(extension: Partial<SquadServer> = {}) {
  return Object.assign(new EventEmitter(), extension) as SquadServer;
}
