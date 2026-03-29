/**
 * Resolves {{variable}} placeholders in text using stored node outputs.
 * Supports: {{name}}, {{company}}, {{jobTitle}}, {{companyUrl}}, {{about}}, {{email}}, {{phone}}
 * Also supports lead fields: {{firstName}}, {{lastName}}
 */

interface ResolveContext {
    storedOutputs: Record<string, Record<string, any>>;
    lead: {
        firstName: string | null;
        lastName: string | null;
    };
}

const VARIABLE_MAP: Record<string, (ctx: ResolveContext) => string> = {
    '{{name}}':       (ctx) => ctx.storedOutputs['profile-visit']?.name || ctx.lead.firstName || '',
    '{{firstName}}':  (ctx) => ctx.lead.firstName || '',
    '{{lastName}}':   (ctx) => ctx.lead.lastName || '',
    '{{company}}':    (ctx) => ctx.storedOutputs['profile-visit']?.company || '',
    '{{jobTitle}}':   (ctx) => ctx.storedOutputs['profile-visit']?.jobTitle || '',
    '{{companyUrl}}': (ctx) => ctx.storedOutputs['profile-visit']?.companyUrl || '',
    '{{about}}':      (ctx) => ctx.storedOutputs['profile-visit']?.about || '',
    '{{email}}':      (ctx) => ctx.storedOutputs['profile-visit']?.email || '',
    '{{phone}}':      (ctx) => ctx.storedOutputs['profile-visit']?.phone || '',
};

export function resolveVariables(text: string, ctx: ResolveContext): string {
    let resolved = text;
    for (const [placeholder, getter] of Object.entries(VARIABLE_MAP)) {
        if (resolved.includes(placeholder)) {
            resolved = resolved.replaceAll(placeholder, getter(ctx));
        }
    }
    return resolved;
}

/**
 * Checks if text contains any {{variable}} that requires profile-visit output.
 */
export function requiresProfileVisit(text: string): boolean {
    const profileVariables = ['{{name}}', '{{company}}', '{{jobTitle}}', '{{companyUrl}}', '{{about}}', '{{email}}', '{{phone}}'];
    return profileVariables.some(v => text.includes(v));
}
