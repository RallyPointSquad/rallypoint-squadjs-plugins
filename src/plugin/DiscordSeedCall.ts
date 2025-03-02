import DiscordBasePlugin from '@squadjs/plugins/discord-base-plugin.js';
import moment from 'moment';

interface ExtraPluginOptions {
  time: string;
  message: string;
  pingGroups: string[];
}

/**
 * Plugin that sends a seeding call message to a Discord channel at specified time of the day.
 */
export default class DiscordSeedCall extends DiscordBasePlugin<ExtraPluginOptions> {

  static get description() {
    return 'The <code>DiscordSeedCall</code> plugin will send a message in a Discord channel at specified time of the day.';
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      ...DiscordBasePlugin.optionsSpecification,
      channelID: {
        required: true,
        description: 'The ID of the channel to send the seeding message to.',
        default: '',
        example: '667741905228136459',
      },
      time: {
        required: true,
        description: 'Time of the day (UTC, hh:mm) at which the message will be send.',
        default: '',
        example: '15:00',
      },
      message: {
        required: true,
        description: 'The message being sent.',
        default: '',
        example: 'Seeding has started.',
      },
      pingGroups: {
        required: false,
        description: 'A list of Discord role IDs to ping.',
        default: [],
        example: ['500455137626554379'],
      },
    }
  }

  #timeout: NodeJS.Timeout;

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.sendMessage = this.sendMessage.bind(this);
  }

  async mount() {
    const timeoutValue = this.#getTimeoutValue();

    if (timeoutValue === undefined) {
      this.verbose(1, 'Wrong timeout, won\'t send a message');
      return;
    }

    this.verbose(1, `Message will be sent in ${timeoutValue} ms`);

    this.#timeout = setTimeout(this.sendMessage, timeoutValue);
  }

  async unmount() {
    clearTimeout(this.#timeout);
  }

  #getTimeoutValue() {
    const now = moment.utc();
    const msgTime = moment(this.options.time, 'hh:mm');

    const minutesDiff = this.#getMinutesOfDay(msgTime) - this.#getMinutesOfDay(now);

    return minutesDiff > 0
      ? minutesDiff * 60 * 1000
      : undefined;
  }

  #getMinutesOfDay(dateTime) {
    return dateTime.minutes() + dateTime.hours() * 60;
  }

  async sendMessage() {
    if (!this.channel) {
      this.verbose(1, 'Could not send Discord Message. Channel not initialized.');
      return;
    }

    if (!('send' in this.channel)) {
      this.verbose(1, 'Could not send Discord Message. Channel is not a text channel.');
      return;
    }

    if (this.server.playerCount > 60) {
      this.verbose(1, 'Server already seeded.');
      return;
    }

    let content = this.options.message;

    if (this.options.pingGroups.length > 0) {
      content += '\n\n' + this.options.pingGroups.map((groupID) => `<@&${groupID}>`).join(' ');
    }

    try {
      const message = await this.channel.send({
        'content': content,
        allowedMentions: {
          parse: ['roles'],
        },
      });

      this.verbose(1, `Sent message '${message.content}'`);

      try {
        await message.crosspost();
        this.verbose(1, 'Message crossposted');
      } catch (error) {
        this.verbose(1, 'Error when crossposting message', error);
      }
    } catch (error) {
      this.verbose(1, 'Error when sending message', error);
    }
  }

}
