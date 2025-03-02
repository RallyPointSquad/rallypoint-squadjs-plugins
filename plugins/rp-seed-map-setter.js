import BasePlugin from './base-plugin.js';

/**
 * @typedef {Object} ExtraPluginOptions
 * @property {string[]} seedingLayers
 * @property {string[]} afterSeedingLayers
 */

/**
 * @extends {BasePlugin<ExtraPluginOptions>}
 */
export default class SeedMapSetter extends BasePlugin {

  static get description() {
    return 'The <code>SeedMapSetter</code> plugin can be used to automate setting seeding map and the map being played after the seeding ends.';
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      seedingLayers: {
        required: false,
        description: 'Seeding layers from which one will be set randomly with <AdminChangeLayer> command.',
        default: [],
      },
      afterSeedingLayers: {
        required: false,
        description: 'Layers from which one will be set randomly with <AdminSetNextLayer> command.',
        default: [],
      },
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.onPlayerConnected = this.onPlayerConnected.bind(this);
    this.changeLayer = this.changeLayer.bind(this);
    this.setNextLayer = this.setNextLayer.bind(this);
  }

  async mount() {
    this.server.on('PLAYER_CONNECTED', this.onPlayerConnected);
  }

  async unmount() {
    this.server.removeListener('PLAYER_CONNECTED', this.onPlayerConnected);

    clearTimeout(this.changeLayerTimeout);
    clearTimeout(this.setNextLayerTimeout);
  }

  onPlayerConnected() {
    if (this.isOnlyOnePlayerOnTheServer()) {
      // Clear possible previous timeouts so the old one is not triggered in the wrong moment.
      clearTimeout(this.changeLayerTimeout);
      clearTimeout(this.setNextLayerTimeout);

      // Wait 10 seconds to give the player to fully load in so the endscreen will show.
      // Otherwise the game is stuck on showing the map.
      this.changeLayerTimeout = setTimeout(this.changeLayer, 10 * 1000);
      this.verbose(1, 'New seeding map will be set in 10 seconds');
    }
  }

  async changeLayer() {
    let newSeedingLayer = this.getRandom(this.options.seedingLayers);

    if (newSeedingLayer && this.isGameModeSeed()) {
      this.verbose(1, `Setting current layer to ${newSeedingLayer}`);
      await this.server.rcon.execute(`AdminChangeLayer ${newSeedingLayer}`);

      // Wait 5 minutes before setting the next layer to make sure it's not set during
      // the endscreen, which would result in loading that map instead of the seeding map.
      this.setNextLayerTimeout = setTimeout(this.setNextLayer, 5 * 60 * 1000);
    }
  }

  async setNextLayer() {
    let newAfterSeedingLayer = this.getRandom(this.options.afterSeedingLayers);

    if (this.isGameModeSeed() && newAfterSeedingLayer) {
      this.verbose(1, `Setting next layer to ${newAfterSeedingLayer}`);
      await this.server.rcon.execute(`AdminSetNextLayer ${newAfterSeedingLayer}`);
    }
  }

  getRandom(array) {
    return Array.isArray(array)
      ? array[Math.floor(Math.random() * array.length)]
      : undefined;
  }

  isGameModeSeed() {
    if (this.server.currentLayer?.gamemode !== 'Seed') {
      this.verbose(1, 'Current layer is not seed');
      return false;
    }

    return true;
  }

  isOnlyOnePlayerOnTheServer() {
    if (this.server.playerCount > 1) {
      this.verbose(1, 'There are multiple players on the server');
      return false;
    }

    return true;
  }

}
