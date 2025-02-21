import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'core': join(import.meta.dirname, 'SquadJS/core/'),
      './base-plugin.js': join(import.meta.dirname, 'SquadJS/squad-server/plugins/base-plugin.js'),
      './discord-base-plugin.js': join(import.meta.dirname, 'SquadJS/squad-server/plugins/discord-base-plugin.js'),
    },
  },
  test: {
    globals: true,
  },
});
