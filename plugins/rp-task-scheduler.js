import cron from 'node-cron';

import BasePlugin from './base-plugin.js';

/**
 * @typedef {Object} TaskConfiguration
 * @property {string} name
 * @property {string} cron
 * @property {string} event
 */

/**
 * @typedef {Object} ScheduledTask
 * @property {string} name
 * @property {import('node-cron').ScheduledTask} task
 */

/**
 * @typedef {Object} ExtraPluginOptions
 * @property {TaskConfiguration[]} tasks
 * @property {string} timezone
 */

/**
 * Generic task scheduler plugin that emits configured events for other plugins based on CRON expressions.
 * The plugin itself does not offer any functionality other than scheduling events.
 *
 * Requirements:
 * - Plugin expects node-cron dependency to be installed.
 *
 * @extends {BasePlugin<ExtraPluginOptions>}
 */
export default class TaskScheduler extends BasePlugin {

  static get description() {
    return 'Schedule event-based tasks using CRON expressions .';
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {
      tasks: {
        required: true,
        description: 'Array of tasks to schedule with their respective CRON expressions.',
        default: [],
        example: [
          {
            name: 'Hourly player count check',
            cron: '0 * * * *', // Every hour
            event: 'PLAYER_COUNT_CHECK',
          },
          {
            name: 'Daily balance notification',
            cron: '0 12 * * *', // Every day at noon
            event: 'TEAM_BALANCE_REMINDER',
          },
        ],
      },
      timezone: {
        required: false,
        description: 'Default timezone for all tasks.',
        default: 'UTC',
      },
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    /** @type {ScheduledTask[]} */
    this.scheduled = [];
  }

  async mount() {
    this.verbose(1, 'Setting up scheduled tasks...');

    for (const task of this.options.tasks) {
      try {
        this.scheduleTask(task);
        this.verbose(1, `Task "${task.name}" scheduled successfully.`);
      } catch (error) {
        this.verbose(1, `Error scheduling task "${task.name}": ${error.message}`);
      }
    }

    this.verbose(1, `Plugin mounted - ${this.scheduled.length} tasks scheduled.`);
  }

  async unmount() {
    for (const { name, task } of this.scheduled) {
      this.verbose(1, `Stopping scheduled task: ${name}`);
      task.stop();
    }

    this.scheduled = [];
    this.verbose(1, 'All scheduled tasks stopped.');
  }

  scheduleTask(/** @type {TaskConfiguration} */ config) {
    if (!config.name || !config.cron || !config.event) {
      this.verbose(1, `Invalid task configuration: ${JSON.stringify(config)}`);
      return;
    }
    if (!cron.validate(config.cron)) {
      this.verbose(1, `Invalid CRON expression for task "${config.name}": ${config.cron}`);
      return;
    }

    this.verbose(1, `Scheduling task "${config.name}" with CRON: ${config.cron}`);
    const task = cron.schedule(config.cron, () => this.triggerEvent(config), {
      scheduled: true,
      timezone: this.options.timezone || 'UTC',
    });
    this.scheduled.push({ name: config.name, task });
  }

  triggerEvent(/** @type {TaskConfiguration} */ config) {
    try {
      this.verbose(1, `Triggering event "${config.event}" from task "${config.name}".`);
      this.server.emit(config.event);
    } catch (error) {
      this.verbose(1, `Error triggering event for task "${config.name}": ${error.message}`);
    }
  }

}
