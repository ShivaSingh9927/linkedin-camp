import nodemailer from 'nodemailer';

class MailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.office365.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.OUTLOOK_EMAIL,
                pass: process.env.OUTLOOK_APP_PASSWORD,
            },
            tls: {
                ciphers: 'TLSv1.2',
                rejectUnauthorized: false
            }
        });
    }

    async sendWelcomeEmail(to: string, name: string) {
        const mailOptions = {
            from: `"Leadmate AI" <${process.env.OUTLOOK_EMAIL}>`,
            to,
            subject: 'Welcome to Leadmate! 🚀',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Welcome to Leadmate, ${name}!</h2>
                    <p style="color: #475569; line-height: 1.6;">We're thrilled to have you join our community of high-performing LinkedIn outreach professionals.</p>
                    <p style="color: #475569; line-height: 1.6;">Leadmate uses advanced AI to help you find better leads and automate your outreach safely and efficiently.</p>
                    <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                        <h3 style="margin-top: 0; font-size: 16px;">Next steps:</h3>
                        <p style="margin-bottom: 0;">Complete your onboarding to start your first campaign!</p>
                    </div>
                </div>
            `,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('[MAIL] Welcome email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('[MAIL] Error sending welcome email:', error);
            throw error;
        }
    }

    async sendOnboardingSuccessEmail(to: string) {
        const mailOptions = {
            from: `"Leadmate AI" <${process.env.OUTLOOK_EMAIL}>`,
            to,
            subject: 'Strategy Locked In! 🎯',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Your Strategy is Ready!</h2>
                    <p style="color: #475569; line-height: 1.6;">Great job! You've successfully set up your GTM strategy and linked your LinkedIn profile.</p>
                    <p style="color: #475569; line-height: 1.6;">Our AI is now synchronizing with your profile. You can head over to your dashboard to create your first automated campaign.</p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Dashboard</a>
                </div>
            `,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('[MAIL] Success email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('[MAIL] Error sending success email:', error);
            throw error;
        }
    }

    async sendOnboardingReminder(to: string, name: string) {
        const mailOptions = {
            from: `"Leadmate AI" <${process.env.OUTLOOK_EMAIL}>`,
            to,
            subject: 'Don\'t leave your outreach on autopilot! ✈️',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #0f172a;">Hi ${name},</h2>
                    <p style="color: #475569; line-height: 1.6;">We noticed you started setting up your Leadmate account but didn't quite finish.</p>
                    <p style="color: #475569; line-height: 1.6;">Your AI-powered LinkedIn outreach is just one step away. Finish your setup and start getting more qualified leads today!</p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Finish Onboarding</a>
                </div>
            `,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('[MAIL] Reminder email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('[MAIL] Error sending reminder email:', error);
            throw error;
        }
    }

    // For testing purposes
    async sendTestEmail(to: string) {
        return this.transporter.sendMail({
            from: process.env.OUTLOOK_EMAIL,
            to,
            subject: 'Leadmate SMTP Test',
            text: 'If you see this, your Outlook SMTP is working correctly!'
        });
    }
}

export const mailService = new MailService();
