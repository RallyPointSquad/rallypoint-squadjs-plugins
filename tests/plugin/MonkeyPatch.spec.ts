import MonkeyPatch from '@/plugin/MonkeyPatch.js';
import { mockSquadServer } from '../support.js';
import { SquadRcon } from '../../types/SquadJS.js';
import { Socket } from 'node:net';

describe('MonkeyPatch', () => {

  function createRcon() {
    return {
      client: new Socket(),
    } as SquadRcon;
  }

  function createPlugin() {
    const squadServer = mockSquadServer({
      rcon: createRcon(),
      async restartRCON() {
        this.rcon = createRcon();
      },
    });
    return new MonkeyPatch(squadServer, {}, {});
  };

  it('increases RCON listener limit on start', async () => {
    const plugin = createPlugin();

    expect(plugin.server.rcon.client.getMaxListeners()).toBe(10);
    await plugin.prepareToMount();
    expect(plugin.server.rcon.client.getMaxListeners()).toBe(100);
  });

  it('increases RCON listener limit after restart', async () => {
    const plugin = createPlugin();

    const restartRCON = vi.spyOn(plugin.server, 'restartRCON');

    await plugin.prepareToMount();
    expect(restartRCON).not.toHaveBeenCalled();

    await plugin.server.restartRCON();
    expect(restartRCON).toHaveBeenCalled();
    expect(plugin.server.rcon.client.getMaxListeners()).toBe(100);
  });

});
