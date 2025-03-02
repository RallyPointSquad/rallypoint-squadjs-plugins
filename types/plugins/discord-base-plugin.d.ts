import BasePlugin from './base-plugin.js';
import { Channel, Client } from 'discord.js';

export default class DiscordBasePlugin<ExtraPluginOptions = Record<string, never>> extends BasePlugin<{
  discordClient: Client;
  channelID: string;
} & ExtraPluginOptions> {

  channel: Channel;

  sendDiscordMessage(message: unknown): Promise<void>;

}
