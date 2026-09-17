import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/server.ts', 'src/worker-entry.ts', 'src/scripts/prod-warm-login.ts', 'src/scripts/prod-run-sequential.ts', 'src/scripts/prod-crm-smoke.ts', 'src/scripts/prod-reenrich.ts', 'src/scripts/prod-connect-note.ts', 'src/scripts/prod-run-caps.ts', 'src/scripts/prod-probe-relationship.ts', 'src/scripts/prod-reconcile-invites.ts'],
    format: ['cjs'],
    splitting: false,
    sourcemap: true,
    clean: true,
    noExternal: ['@repo/db', '@repo/types'],
});
