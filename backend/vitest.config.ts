import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' }, jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true } } })],
  test: { include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 30000, hookTimeout: 60000, fileParallelism: false },
});
