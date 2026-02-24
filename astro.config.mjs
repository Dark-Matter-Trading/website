import { defineConfig } from 'astro/config';

import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://darkmattertrading.eu',
  output: 'static',
  adapter: netlify(),
});