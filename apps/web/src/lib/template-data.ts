// Static fallback when /templates API is unreachable. After the 2026-06 ICP
// refactor, the source of truth is apps/backend/src/campaign-templates/*.
// The fallback is intentionally empty — if the API is down, surface that
// loudly (empty gallery) rather than offer stale templates whose IDs no
// longer exist in the backend.
export const FALLBACK_TEMPLATES: any[] = [];
