import { defineConfig } from 'astro/config';
import solidJs from '@astrojs/solid-js';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import cloudflare from '@astrojs/cloudflare';

// DEPLOY_TARGET=cloudflare does not work on Windows cmd.exe (npm runs scripts
// through cmd), which made `npm run build:cloudflare` fail outright. Select the
// adapter via a dedicated config file instead — see astro.config.cloudflare.mjs.
const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: isCloudflare
    ? cloudflare({
        imageService: 'cloudflare',
      })
    : node({
        mode: 'standalone',
      }),
  integrations: [
    solidJs(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  server: {
    // Bind to localhost by default; expose deliberately with --host when needed.
    host: '127.0.0.1',
    port: 4321,
  },
});
