import moment from 'moment';

import DiscordBasePlugin from './discord-base-plugin.js';

export default class DiscordSeedCall extends DiscordBasePlugin {
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
        example: '667741905228136459'
      },
      time: {
        required: true,
        description: 'Time of the day (UTC, hh:mm) at which the message will be send.',
        default: '',
        example: '15:00'
      },
      message: {
        required: true,
        description: 'The message being sent.',
        default: '',
        example: 'Seeding has started.'
      },
      pingGroups: {
        required: false,
        description: 'A list of Discord role IDs to ping.',
        default: [],
        example: ['500455137626554379']
      }
    }
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.sendMessage = this.sendMessage.bind(this);
  }

  async mount() {
    var timeoutValue = this.getTimeoutValue();

    if (timeoutValue === undefined) {
      return;
    }

    this.timeout = setTimeout(this.sendMessage, timeoutValue);
  }

  async unmount() {
    clearTimeout(this.timeout);
  }

  getTimeoutValue() {
    var now = moment.utc();
    var msgTime = moment(this.options.time, 'hh:mm');

    var timeoutValue = this.getMinutesOfDay(msgTime) - this.getMinutesOfDay(now);

    return timeoutValue > 0
      ? timeoutValue
      : undefined;
  }

  getMinutesOfDay(moment) {
    moment.Minutes() + moment.Hours() * 60;
  }

  async sendMessage() {
    if (!this.channel) {
      this.verbose(1, `Could not send Discord Message. Channel not initialized.`);
      return;
    }

    content = this.options.message;

    if (this.options.pingGroups.length > 0) {
      content += "\n\n" + this.options.pingGroups.map((groupID) => `<@&${groupID}>`).join(' ');
    }
    
    var message = await this.channel.send(this.options.message);
    await message.crosspost();
  }
}