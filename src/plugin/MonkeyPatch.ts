import BasePlugin from '@squadjs/plugins/base-plugin.js';

/**
 * Monkey patches to SquadJS (see #patch methods for detailed description).
 */
export default class MonkeyPatch extends BasePlugin {

  static get description() {
    return 'Monkey patches to SquadJS.';
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {};
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
  }

  async prepareToMount() {
    this.#patchRconMaxListeners();
  }

  /**
   * Increase RCON max listeners to fix `MaxListenersExceededWarning` warning.
   * Default listener limit can be exceeded when sending multiple RCON commands in a short period of
   * time (e.g. when squadjs-switch-plugin executes `matchend` switches).
   */
  #patchRconMaxListeners() {
    // arbitrarily large number (we don't know Squad's internal limits)
    const RCON_MAX_LISTENERS = 100;

    const updateMaxListeneres = () => {
      this.server.rcon.client.setMaxListeners(RCON_MAX_LISTENERS);
      this.verbose(1, `Updated RCON max listeners to ${RCON_MAX_LISTENERS}`);
    };

    // update listeners on plugin (SquadJS) start
    updateMaxListeneres();

    // handle listener update on RCON restart
    const ORIGINAL_RESTART_RCON = 'MonkeyPatch_restartRCON';
    if (this.server.restartRCON && !this.server[ORIGINAL_RESTART_RCON]) {
      Object.defineProperty(this.server, ORIGINAL_RESTART_RCON, {
        enumerable: false,
        value: this.server.restartRCON,
      });
      this.server.restartRCON = async () => {
        await this.server[ORIGINAL_RESTART_RCON]();
        updateMaxListeneres();
      };
    }
  }

}
