import { TemplateDefinition } from './types';
import { warmConnectTemplate } from './warm-connect';

// The single source of truth for shipped templates.
//
// To add a new template:
//   1. Create apps/backend/src/campaign-templates/<name>.ts exporting a
//      TemplateDefinition.
//   2. Import it here and append to TEMPLATES.
//   3. That's it — `GET /templates` picks it up and the Templates Hub
//      renders the card automatically.
//
// Keep this list small and opinionated. Every template ships with safety
// defaults (delays, AI-driven personalization, no INVITE-without-visit). Do
// not seed templates that bypass the connection-degree gate or the reply-pause
// — those are product invariants, not template choices.

export const TEMPLATES: TemplateDefinition[] = [
    warmConnectTemplate,
];

export const getTemplates = (): TemplateDefinition[] => TEMPLATES;

export const getTemplateById = (id: string): TemplateDefinition | undefined =>
    TEMPLATES.find((t) => t.id === id);

export type { TemplateDefinition } from './types';
