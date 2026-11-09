import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

const cwd = path.dirname(fileURLToPath(import.meta.url));

// Unit tests for the pure backend logic. OCP runs `npm test` on every build.
export default defineConfig({
  resolve: {alias: {'@shared': path.resolve(cwd, 'src/shared')}},
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
