import { prisma } from '@repo/db';
import { getStepType } from './workflow-graph';

/**
 * Pre-launch prerequisite checks.
 *
 * Some campaign nodes depend on configuration OUTSIDE the LinkedIn session:
 *   - EMAIL ("Send Email")  → the user's connected EmailAccount (per-user).
 *   - EMAIL_FINDER ("Find Email") → the global email-finder box (env).
 *
 * Without this gate a user can add a "Send Email" step, hit Start, and the
 * campaign goes ACTIVE while every send silently fails per-lead at runtime
 * (no email account → node fails, non-fatal, lead just moves on). This turns
 * that silent runtime failure into a clear, actionable pre-launch block.
 *
 * Severity:
 *   - 'block' → user-fixable prerequisite is missing; refuse to start.
 *   - 'warn'  → the campaign can start, but a step will be skipped (e.g. the
 *     finder box is a global service the user can't configure themselves).
 */
export interface PreflightIssue {
    code: string;
    severity: 'block' | 'warn';
    message: string;
    /** Relative app path where the user can fix a 'block' issue. */
    fixUrl?: string;
}

/** Accepts the three workflow shapes startCampaign handles. */
function extractNodes(workflowJson: any): any[] {
    const raw = workflowJson?.nodes || workflowJson?.flow || workflowJson;
    return Array.isArray(raw) ? raw : [];
}

export async function preflightCampaign(
    workflowJson: any,
    userId: string,
): Promise<PreflightIssue[]> {
    const nodes = extractNodes(workflowJson);
    const stepTypes = new Set(nodes.map(getStepType));
    const issues: PreflightIssue[] = [];

    // "Send Email" step → requires a connected, usable email account.
    // (For smtp we also require a stored password; oauth rows are usable once
    // the row exists.)
    if (stepTypes.has('EMAIL')) {
        const account = await prisma.emailAccount
            .findUnique({ where: { userId } })
            .catch(() => null);
        const usable = !!account && (account.provider !== 'smtp' || !!account.smtpPass);
        if (!usable) {
            issues.push({
                code: 'EMAIL_ACCOUNT_REQUIRED',
                severity: 'block',
                message:
                    'This campaign has a "Send Email" step, but you haven\'t connected an email account yet. Connect one so Qampi can send those emails.',
                fixUrl: '/settings/email',
            });
        }
    }

    // "Find Email" step → the global finder box. Not user-configurable, so a
    // missing config is a warning (the step skips; leads without a known email
    // just won't be emailed) rather than a hard block.
    if (stepTypes.has('EMAIL_FINDER')) {
        if (!process.env.EMAIL_FINDER_URL || !process.env.EMAIL_FINDER_TOKEN) {
            issues.push({
                code: 'EMAIL_FINDER_UNAVAILABLE',
                severity: 'warn',
                message:
                    'The "Find Email" step is currently unavailable, so it will be skipped. Leads that already have an email on file are unaffected; others simply won\'t be emailed.',
            });
        }
    }

    return issues;
}
