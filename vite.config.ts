import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/quadflow/',
  test: {
    environment: 'node',
  },
});
