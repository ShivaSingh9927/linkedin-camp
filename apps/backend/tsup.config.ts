import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/server.ts', 'src/worker-entry.ts', 'src/scripts/prod-warm-login.ts', 'src/scripts/prod-run-sequential.ts', 'src/scripts/prod-crm-smoke.ts'],
    format: ['cjs'],
    splitting: false,
    sourcemap: true,
    clean: true,
    noExternal: ['@repo/db', '@repo/types'],
});
