import { defineConfig } from 'vitest/config';

// GitHub Pages serves this repo at https://harrisbinkhurram.github.io/hopscore/,
// so every built asset URL must start with /hopscore/.
export default defineConfig({
  base: '/hopscore/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
