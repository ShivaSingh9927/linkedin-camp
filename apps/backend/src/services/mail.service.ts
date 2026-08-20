import nodemailer from 'nodemailer';

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

    private async send(label: string, mailOptions: nodemailer.SendMailOptions) {
        if (!this.transporter) {
            console.warn(`[MAIL] ${label} skipped — SMTP not configured.`);
            return null;
        }
        try {
            const info = await this.transporter.sendMail({ from: MAIL_FROM, ...mailOptions });
            console.log(`[MAIL] ${label} sent:`, info.messageId);
            return info;
        } catch (error: any) {
            // Fail LOUD — this used to rot silently behind void…catch callers.
            console.error(`[MAIL] ${label} FAILED:`, error?.message || error);
            throw error;
        }
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
