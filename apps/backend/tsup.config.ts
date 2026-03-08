import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/server.ts'],
    format: ['cjs'],
    splitting: false,
    sourcemap: true,
    clean: true,
    noExternal: ['@repo/db', '@repo/types']
});
