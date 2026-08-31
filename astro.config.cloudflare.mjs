import { defineConfig } from 'astro/config';
import solidJs from '@astrojs/solid-js';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

/**
 * Production build targeting Cloudflare Pages.
 *
 * Used by `npm run build:cloudflare`. Selecting the adapter through a separate
 * config file (rather than an env var) keeps the script working on Windows,
 * where `DEPLOY_TARGET=cloudflare astro build` fails under cmd.exe.
 */
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare',
  }),
  integrations: [
    solidJs(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
});
