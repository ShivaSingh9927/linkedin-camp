import nodemailer from 'nodemailer';
import { prisma } from '@repo/db';
import crypto from 'crypto';

/**
 * Transactional mailer — the welcome / onboarding / reminder emails Qampi
 * sends TO its users. Distinct from the per-user CAMPAIGN mailer in
 * email.service.ts (which sends from each user's own connected mailbox).
 *
 * Auth is plain SMTP + an app password. The default host is Gmail because
 * Microsoft has DISABLED basic auth on Outlook/Office365 — an app password
 * there returns "535 5.7.139 basic authentication is disabled" no matter what.
 * Gmail still allows app passwords (with 2FA on), so it's the free, no-API path.
 *
 * Config via env (SMTP_* preferred; OUTLOOK_* kept as a fallback so the
 * existing compose wiring keeps working — just put the Gmail address + app
 * password in those two vars):
 *   SMTP_HOST   (default smtp.gmail.com)
 *   SMTP_PORT   (default 587)
 *   SMTP_SECURE (default false → STARTTLS on 587; auto-true on 465)
 *   SMTP_USER / OUTLOOK_EMAIL        — the sending mailbox
 *   SMTP_PASS / OUTLOOK_APP_PASSWORD — its app password
 *   MAIL_FROM   (default `"Qampi AI" <SMTP_USER>`)
 *
 * When no user/pass is set the service is DISABLED: every send logs a single
 * clear line and returns null instead of throwing per-call — so an
 * unconfigured deploy can't crash signup, and a configured-but-broken one
 * fails LOUD (errors are logged and rethrown, never swallowed).
 */

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || process.env.OUTLOOK_EMAIL || '';
const SMTP_PASS = process.env.SMTP_PASS || process.env.OUTLOOK_APP_PASSWORD || '';
const MAIL_FROM = process.env.MAIL_FROM || (SMTP_USER ? `"Qampi AI" <${SMTP_USER}>` : '');
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';


/** Escape user-supplied text before it goes into an HTML email. */
function esc(v: string): string {
    return String(v).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const button = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background-color:#7c3aed;`
    + `color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">${label}</a>`;

const statRow = (pairs: Array<[string, number]>) =>
    `<div style="margin:20px 0;padding:16px;background:#f8fafc;border-radius:8px;">`
    + pairs.map(([k, v]) =>
        `<span style="display:inline-block;min-width:110px;"><strong style="font-size:20px;color:#0f172a;">${v}</strong>`
        + `<br><span style="font-size:11px;color:#64748b;text-transform:uppercase;">${k}</span></span>`).join('')
    + `</div>`;

const layout = (inner: string, footer = '') =>
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">`
    + inner
    + (footer ? `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;">${footer}</div>` : '')
    + `</div>`;

/**
 * Unsubscribe token: HMAC of the user id with the app secret. Stateless (no
 * table, no expiry to manage) and unguessable, so one user's link can't
 * unsubscribe another.
 */
export function unsubscribeToken(userId: string): string {
    const secret = process.env.JWT_SECRET || 'supersecretkey';
    return crypto.createHmac('sha256', secret).update(`unsub:${userId}`).digest('hex').slice(0, 32);
}

const unsubscribeFooter = (userId: string) => {
    const url = `${process.env.BACKEND_PUBLIC_URL || 'https://api.qampi.com'}`
        + `/api/v1/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
    return `<p style="color:#94a3b8;font-size:12px;margin:0;">`
        + `You're getting this because you have a Qampi account. `
        + `<a href="${url}" style="color:#94a3b8;">Unsubscribe from nudges</a> — `
        + `you'll still get billing and security emails.</p>`;
};

class MailService {
    private transporter: nodemailer.Transporter | null = null;
    readonly configured: boolean;

    constructor() {
        this.configured = Boolean(SMTP_USER && SMTP_PASS);
        if (!this.configured) {
            console.warn(
                '[MAIL] SMTP not configured (set SMTP_USER/SMTP_PASS or OUTLOOK_EMAIL/OUTLOOK_APP_PASSWORD). ' +
                'Transactional emails are DISABLED until then.',
            );
            return;
        }
        this.transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: false },
            // Never let a stalled SMTP handshake hang a request indefinitely.
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
        });
        console.log(`[MAIL] SMTP ready — host=${SMTP_HOST}:${SMTP_PORT} user=${SMTP_USER}`);
    }

    /** Confirm the SMTP login actually works (used by the deploy test). */
    async verify(): Promise<boolean> {
        if (!this.transporter) {
            console.warn('[MAIL] verify skipped — SMTP not configured.');
            return false;
        }
        await this.transporter.verify();
        return true;
    }

    /**
     * Record what happened to every send, including the ones that never left.
     *
     * "Did the welcome email go out?" used to be UNANSWERABLE: container logs
     * die with each deploy, so two signups left no trace either way. A row per
     * attempt makes delivery a question with an answer — and gives the
     * frequency caps (one nudge per 30 days) something durable to count, which
     * an in-memory guard could never survive a restart to provide.
     *
     * Best-effort: a logging failure must never fail the send it describes.
     */
    private async record(args: {
        userId?: string | null; to: string; type: string; subject: string;
        status: 'SENT' | 'FAILED' | 'SKIPPED'; detail?: string;
    }) {
        await prisma.emailLog.create({
            data: {
                userId: args.userId ?? null,
                to: args.to,
                type: args.type,
                subject: args.subject,
                status: args.status,
                detail: args.detail?.slice(0, 500) ?? null,
            },
        }).catch((e: any) => console.error('[MAIL] could not record email log:', e?.message));
    }

    private async send(
        label: string,
        mailOptions: nodemailer.SendMailOptions,
        meta?: { type?: string; userId?: string | null },
    ) {
        const to = String(mailOptions.to || '');
        const subject = String(mailOptions.subject || '');
        const type = meta?.type || label.toLowerCase().replace(/\s+/g, '_');

        if (!this.transporter) {
            console.warn(`[MAIL] ${label} skipped — SMTP not configured.`);
            await this.record({ userId: meta?.userId, to, type, subject, status: 'SKIPPED', detail: 'smtp_not_configured' });
            return null;
        }
        try {
            const info = await this.transporter.sendMail({ from: MAIL_FROM, ...mailOptions });
            console.log(`[MAIL] ${label} sent:`, info.messageId);
            await this.record({ userId: meta?.userId, to, type, subject, status: 'SENT', detail: info.messageId });
            return info;
        } catch (error: any) {
            // Fail LOUD — this used to rot silently behind void…catch callers.
            console.error(`[MAIL] ${label} FAILED:`, error?.message || error);
            await this.record({ userId: meta?.userId, to, type, subject, status: 'FAILED', detail: error?.message || String(error) });
            throw error;
        }
    }

    /**
     * Send a NON-transactional email, honouring opt-out and a frequency cap.
     *
     * Billing and security mail must never route through here — a user who
     * unsubscribed from nudges still needs to hear that their payment failed.
     */
    private async sendMarketing(
        label: string,
        args: { userId: string; to: string; type: string; subject: string; html: string; minDaysBetween: number },
    ) {
        const user = await prisma.user.findUnique({
            where: { id: args.userId }, select: { emailOptOut: true },
        }).catch(() => null);

        if (user?.emailOptOut) {
            await this.record({ ...args, status: 'SKIPPED', detail: 'opted_out' });
            return null;
        }

        const since = new Date(Date.now() - args.minDaysBetween * 86_400_000);
        const recent = await prisma.emailLog.findFirst({
            where: { userId: args.userId, type: args.type, status: 'SENT', createdAt: { gte: since } },
            select: { id: true },
        }).catch(() => null);

        if (recent) {
            await this.record({ ...args, status: 'SKIPPED', detail: `frequency_cap_${args.minDaysBetween}d` });
            return null;
        }

        return this.send(label, { to: args.to, subject: args.subject, html: args.html }, { type: args.type, userId: args.userId });
    }

    async sendWelcomeEmail(to: string, name: string) {
        return this.send('Welcome email', {
            to,
            subject: 'Welcome to Qampi! 🚀',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Welcome to Qampi, ${name}!</h2>
                    <p style="color: #475569; line-height: 1.6;">We're thrilled to have you join our community of high-performing LinkedIn outreach professionals.</p>
                    <p style="color: #475569; line-height: 1.6;">Qampi uses advanced AI to help you find better leads and automate your outreach safely and efficiently.</p>
                    <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                        <h3 style="margin-top: 0; font-size: 16px;">Next steps:</h3>
                        <p style="margin-bottom: 0;">Complete your onboarding to start your first campaign!</p>
                    </div>
                </div>
            `,
        });
    }

    async sendOnboardingSuccessEmail(to: string) {
        return this.send('Success email', {
            to,
            subject: 'Strategy Locked In! 🎯',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Your Strategy is Ready!</h2>
                    <p style="color: #475569; line-height: 1.6;">Great job! You've successfully set up your GTM strategy and linked your LinkedIn profile.</p>
                    <p style="color: #475569; line-height: 1.6;">Our AI is now synchronizing with your profile. You can head over to your dashboard to create your first automated campaign.</p>
                    <a href="${APP_URL}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Dashboard</a>
                </div>
            `,
        });
    }

    async sendOnboardingReminder(to: string, name: string) {
        return this.send('Reminder email', {
            to,
            subject: 'Don\'t leave your outreach on autopilot! ✈️',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Hi ${name},</h2>
                    <p style="color: #475569; line-height: 1.6;">We noticed you started setting up your Qampi account but didn't quite finish.</p>
                    <p style="color: #475569; line-height: 1.6;">Your AI-powered LinkedIn outreach is just one step away. Finish your setup and start getting more qualified leads today!</p>
                    <a href="${APP_URL}/onboarding" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Finish Onboarding</a>
                </div>
            `,
        });
    }

    async sendPaymentFailedEmail(to: string, name: string) {
        return this.send('Payment-failed email', {
            to,
            subject: 'Action needed: your Qampi payment didn\'t go through',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Hi ${name || 'there'},</h2>
                    <p style="color: #475569; line-height: 1.6;">We couldn't process the latest payment for your Qampi subscription. Your plan is still active for now, but it will pause if we can't collect payment.</p>
                    <p style="color: #475569; line-height: 1.6;">Please update your payment method to keep your campaigns running without interruption.</p>
                    <a href="${APP_URL}/settings" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Update payment method</a>
                </div>
            `,
        });
    }

    async sendSubscriptionEndedEmail(to: string, name: string) {
        return this.send('Subscription-ended email', {
            to,
            subject: 'Your Qampi plan has ended',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Hi ${name || 'there'},</h2>
                    <p style="color: #475569; line-height: 1.6;">Your Qampi subscription has ended and your account has moved to the Free plan. Your data and campaigns are safe.</p>
                    <p style="color: #475569; line-height: 1.6;">Ready to pick up where you left off? Reactivate any time.</p>
                    <a href="${APP_URL}/pricing" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Choose a plan</a>
                </div>
            `,
        });
    }

    async sendTeamInvite(to: string, args: { teamName: string; inviterEmail?: string; inviteUrl: string; role: string }) {
        const { teamName, inviterEmail, inviteUrl, role } = args;
        const roleLabel = role === 'ADMIN' ? 'an admin' : 'a member';
        const from = inviterEmail ? `${inviterEmail} invited you to` : 'You have been invited to join';
        return this.send('Team invite email', {
            to,
            subject: `You're invited to join ${teamName} on Qampi`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Join ${teamName} on Qampi</h2>
                    <p style="color: #475569; line-height: 1.6;">${from} <strong>${teamName}</strong> as ${roleLabel}.</p>
                    <p style="color: #475569; line-height: 1.6;">Qampi runs safe, AI-assisted LinkedIn outreach. Accept the invite to get set up with your own workspace under this team.</p>
                    <a href="${inviteUrl}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Accept invite</a>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">This invite expires in 7 days. If you didn't expect it, you can ignore this email.</p>
                </div>
            `,
        });
    }

    // ---- Campaign lifecycle ------------------------------------------------

    /**
     * A campaign finished. Leads with what it actually produced.
     *
     * NOTE there is deliberately no "campaign started" email: the user launched
     * it themselves seconds earlier, and mail that tells people what they just
     * did is how a product teaches its users to ignore its mail.
     */
    async sendCampaignFinishedEmail(args: {
        userId: string; to: string; name: string; campaignId: string; campaignName: string;
        stats: { leads: number; connected: number; replied: number };
    }) {
        const { stats } = args;
        const line = stats.replied > 0
            ? `${stats.replied} ${stats.replied === 1 ? 'person' : 'people'} replied — those conversations are waiting in your inbox.`
            : stats.connected > 0
                ? `${stats.connected} new ${stats.connected === 1 ? 'connection' : 'connections'} accepted. Replies often come later, so keep an eye on the inbox.`
                : 'No replies yet. Worth a look at the sequence and the lead list before the next run.';

        return this.send('Campaign-finished email', {
            to: args.to,
            subject: `"${args.campaignName}" has finished`,
            html: layout(`
                <h2 style="color:#0f172a;margin-top:0;">Hi ${args.name || 'there'},</h2>
                <p style="color:#475569;line-height:1.6;">Your campaign <strong>${esc(args.campaignName)}</strong> has finished.</p>
                ${statRow([
                    ['Leads', stats.leads], ['Connected', stats.connected], ['Replied', stats.replied],
                ])}
                <p style="color:#475569;line-height:1.6;">${line}</p>
                ${button(`${APP_URL}/campaigns/${args.campaignId}`, 'See the results')}
            `),
        }, { type: 'campaign_finished', userId: args.userId });
    }

    /**
     * A campaign stopped and needs a human. This is the one that earns its
     * place: without it a user discovers a dead campaign days later by logging
     * in, and the usual cause (an expired LinkedIn session) costs them every
     * day it goes unnoticed.
     */
    async sendCampaignAttentionEmail(args: {
        userId: string; to: string; name: string; campaignId: string; campaignName: string;
        reason: 'session_expired' | 'account_restricted' | 'stalled' | string;
    }) {
        const copy: Record<string, { what: string; fix: string; cta: string; href: string }> = {
            session_expired: {
                what: 'Your LinkedIn session expired, so Qampi can no longer act on your behalf.',
                fix: 'Reconnecting takes about a minute and the campaign picks up where it stopped.',
                cta: 'Reconnect LinkedIn', href: `${APP_URL}/settings`,
            },
            account_restricted: {
                what: 'LinkedIn flagged your account, so Qampi paused everything immediately.',
                fix: 'Open LinkedIn directly and clear whatever it is asking for. Qampi stays paused until you say otherwise — resuming early risks a longer restriction.',
                cta: 'Open settings', href: `${APP_URL}/settings`,
            },
        };
        const c = copy[args.reason] || {
            what: 'The campaign stopped before finishing and needs a look.',
            fix: 'Open it to see which step it stopped on.',
            cta: 'Open campaign', href: `${APP_URL}/campaigns/${args.campaignId}`,
        };

        return this.send('Campaign-attention email', {
            to: args.to,
            subject: `Action needed: "${args.campaignName}" has paused`,
            html: layout(`
                <h2 style="color:#0f172a;margin-top:0;">Hi ${args.name || 'there'},</h2>
                <p style="color:#475569;line-height:1.6;"><strong>${esc(args.campaignName)}</strong> has paused.</p>
                <div style="margin:20px 0;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                    <p style="margin:0;color:#991b1b;line-height:1.6;">${c.what}</p>
                </div>
                <p style="color:#475569;line-height:1.6;">${c.fix}</p>
                ${button(c.href, c.cta)}
            `),
        }, { type: 'campaign_attention', userId: args.userId });
    }

    // ---- Re-engagement (non-transactional) ----------------------------------

    /**
     * "You haven't been on Qampi for a while." Opt-out-able, capped at one per
     * 30 days, and never sent to someone who hasn't finished onboarding — they
     * get the onboarding reminder instead, and two nudges about different
     * things in the same week is how people unsubscribe.
     */
    async sendReEngagementEmail(args: {
        userId: string; to: string; name: string; daysAway: number;
        pending: { waitingReplies: number; leads: number };
    }) {
        const hook = args.pending.waitingReplies > 0
            ? `${args.pending.waitingReplies} ${args.pending.waitingReplies === 1 ? 'reply is' : 'replies are'} sitting unanswered in your Qampi inbox.`
            : args.pending.leads > 0
                ? `You have ${args.pending.leads} leads imported and no campaign running.`
                : 'Your account is set up and idle — one template is all it takes to start again.';

        return this.sendMarketing('Re-engagement email', {
            userId: args.userId,
            to: args.to,
            type: 'reengagement',
            minDaysBetween: 30,
            subject: args.pending.waitingReplies > 0
                ? `You have ${args.pending.waitingReplies} unanswered ${args.pending.waitingReplies === 1 ? 'reply' : 'replies'}`
                : 'Your Qampi account has been quiet',
            html: layout(`
                <h2 style="color:#0f172a;margin-top:0;">Hi ${args.name || 'there'},</h2>
                <p style="color:#475569;line-height:1.6;">It's been ${args.daysAway} days since you last opened Qampi.</p>
                <p style="color:#475569;line-height:1.6;">${hook}</p>
                ${button(`${APP_URL}`, 'Open Qampi')}
            `, unsubscribeFooter(args.userId)),
        });
    }

    // For testing purposes.
    async sendTestEmail(to: string) {
        return this.send('Test email', {
            to,
            subject: 'Qampi SMTP Test',
            text: 'If you see this, Qampi transactional email is working correctly!',
        });
    }
}

export const mailService = new MailService();
