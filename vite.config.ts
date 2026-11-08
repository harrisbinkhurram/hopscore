import { defineConfig } from 'vitest/config';
import { pwa } from './build/pwa.ts';

// GitHub Pages serves this repo at https://harrisbinkhurram.github.io/hopscore/,
// so every built asset URL must start with /hopscore/.
export default defineConfig({
  base: '/hopscore/',
  plugins: [pwa()],
  test: {
    include: ['src/**/*.test.ts', 'build/**/*.test.ts'],
  },
});
