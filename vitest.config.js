import { join } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src/'),
      '@squadjs/plugins': join(import.meta.dirname, 'SquadJS/squad-server/plugins/'),
      'core': join(import.meta.dirname, 'SquadJS/core/'),
    },
  },
  test: {
    globals: true,
  },
});
