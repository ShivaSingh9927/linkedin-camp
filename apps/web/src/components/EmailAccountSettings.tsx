"use client";

import { useEffect, useState } from 'react';
import { Mail, Send, Trash2, CheckCircle2, AlertCircle, Loader2, ChevronDown, Key } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface ProviderPreset {
    label: string;
    host: string;
    port: number;
    secure: boolean;
    note?: string;
}

const PRESETS: Record<string, ProviderPreset> = {
    gmail: { label: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false, note: 'Use a Gmail App Password — your regular password will not work. Settings → Security → 2-Step Verification → App passwords.' },
    outlook: { label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false },
    yahoo: { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, secure: true, note: 'Yahoo requires a generated app password (Account Security → Generate app password).' },
    icloud: { label: 'iCloud', host: 'smtp.mail.me.com', port: 587, secure: false, note: 'iCloud requires an app-specific password (appleid.apple.com → Sign-In and Security).' },
    custom: { label: 'Custom SMTP', host: '', port: 587, secure: false },
};

interface ConnectedAccount {
    provider: string;
    fromEmail: string;
    fromName: string | null;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpSecure: boolean;
    hasPassword: boolean;
    lastSendAt: string | null;
    lastError: string | null;
    updatedAt: string;
}

export default function EmailAccountSettings() {
    const [loading, setLoading] = useState(true);
    const [account, setAccount] = useState<ConnectedAccount | null>(null);
    const [providers, setProviders] = useState({ google: false, microsoft: false });
    const [showSmtp, setShowSmtp] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [presetKey, setPresetKey] = useState<string>('gmail');
    const [smtpForm, setSmtpForm] = useState({
        fromEmail: '', fromName: '', smtpHost: PRESETS.gmail.host, smtpPort: PRESETS.gmail.port,
        smtpUser: '', smtpPass: '', smtpSecure: false,
    });

    useEffect(() => { void load(); }, []);

    // Surface the OAuth callback outcome via ?emailConnected=... — set by
    // the API redirect. We toast and then strip the params so a refresh
    // doesn't re-trigger the toast.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const sp = new URLSearchParams(window.location.search);
        const status = sp.get('emailConnected');
        if (!status) return;
        const email = sp.get('email');
        if (status === 'gmail' || status === 'microsoft') {
            toast.success(`${status === 'gmail' ? 'Gmail' : 'Microsoft'} connected${email ? ` as ${email}` : ''}`);
        } else if (status === 'error') {
            toast.error(`Connection failed: ${sp.get('reason') || 'unknown'}`);
        }
        sp.delete('emailConnected'); sp.delete('email'); sp.delete('reason');
        const clean = window.location.pathname + (sp.toString() ? `?${sp}` : '');
        window.history.replaceState({}, '', clean);
    }, []);

    const load = async () => {
        try {
            const [acc, prov] = await Promise.all([
                api.get('/email-account'),
                api.get('/oauth/providers'),
            ]);
            setAccount(acc.data.account);
            setProviders(prov.data);
            if (acc.data.account?.smtpHost) {
                const matched = Object.entries(PRESETS).find(([_, p]) => p.host === acc.data.account.smtpHost);
                setPresetKey(matched ? matched[0] : 'custom');
                setSmtpForm({
                    fromEmail: acc.data.account.fromEmail || '',
                    fromName: acc.data.account.fromName || '',
                    smtpHost: acc.data.account.smtpHost,
                    smtpPort: acc.data.account.smtpPort || 587,
                    smtpUser: acc.data.account.smtpUser || '',
                    smtpPass: '',
                    smtpSecure: acc.data.account.smtpSecure,
                });
            }
        } catch (e: any) {
            toast.error('Failed to load email account');
        } finally {
            setLoading(false);
        }
    };

    const connectOAuth = (provider: 'google' | 'microsoft') => {
        // The connect endpoint is authMiddleware-protected; it accepts a
        // ?token= query param fallback (see auth.middleware.ts) so we can
        // start the OAuth flow from a plain <a> redirect rather than fetch.
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
            toast.error('Not signed in');
            return;
        }
        const base = (api.defaults.baseURL || '').replace(/\/$/, '');
        window.location.href = `${base}/oauth/${provider}/connect?token=${encodeURIComponent(token)}`;
    };

    const applyPreset = (key: string) => {
        setPresetKey(key);
        const p = PRESETS[key];
        setSmtpForm(f => ({ ...f, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure }));
    };

    const saveSmtp = async () => {
        if (!smtpForm.fromEmail || !smtpForm.smtpHost || !smtpForm.smtpUser) {
            toast.error('From-email, host, and username are required'); return;
        }
        if (!account?.hasPassword && !smtpForm.smtpPass) {
            toast.error('Password is required on first setup'); return;
        }
        setSaving(true);
        try {
            const body: any = { ...smtpForm };
            if (!smtpForm.smtpPass) delete body.smtpPass;
            await api.put('/email-account', body);
            toast.success('SMTP account saved');
            setSmtpForm(f => ({ ...f, smtpPass: '' }));
            void load();
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const test = async () => {
        setTesting(true);
        try {
            const { data } = await api.post('/email-account/test', {});
            toast.success(`Test email sent. Check ${account?.fromEmail}.`);
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Test failed');
        } finally {
            setTesting(false);
        }
    };

    const disconnect = async () => {
        if (!confirm('Disconnect email account? Campaigns with EMAIL steps will skip sending.')) return;
        setDisconnecting(true);
        try {
            await api.delete('/email-account');
            toast.success('Disconnected');
            setAccount(null);
            setSmtpForm({ fromEmail: '', fromName: '', smtpHost: PRESETS.gmail.host, smtpPort: 587, smtpUser: '', smtpPass: '', smtpSecure: false });
        } catch (e: any) {
            toast.error('Disconnect failed');
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
    );

    const providerLabel = (p?: string) =>
        p === 'gmail-oauth' ? 'Gmail (OAuth)' :
        p === 'microsoft-oauth' ? 'Microsoft (OAuth)' :
        p === 'smtp' ? 'SMTP' : p || 'Unknown';

    return (
        <div className="max-w-3xl space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Mail className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Email Account</h2>
                        <p className="text-sm text-slate-500">
                            Connect an outgoing mailbox so campaigns with EMAIL steps can send from your address.
                        </p>
                    </div>
                </div>

                {account && (
                    <div className="mb-6 flex items-center space-x-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Connected via <strong>{providerLabel(account.provider)}</strong> as <strong>{account.fromEmail}</strong>{account.lastSendAt && ` · last send ${new Date(account.lastSendAt).toLocaleString()}`}</span>
                    </div>
                )}

                {account?.lastError && (
                    <div className="mb-6 flex items-start space-x-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Last error:</strong> {account.lastError}</span>
                    </div>
                )}

                {/* OAuth connect buttons — primary path */}
                {!account && (
                    <div className="space-y-3 mb-6">
                        {providers.google && (
                            <button
                                onClick={() => connectOAuth('google')}
                                className="w-full flex items-center justify-center space-x-3 px-6 py-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all text-sm font-black text-slate-900"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                <span>Connect with Google (Gmail)</span>
                            </button>
                        )}
                        {providers.microsoft && (
                            <button
                                onClick={() => connectOAuth('microsoft')}
                                className="w-full flex items-center justify-center space-x-3 px-6 py-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all text-sm font-black text-slate-900"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>
                                <span>Connect with Microsoft (Outlook / 365)</span>
                            </button>
                        )}
                        {!providers.google && !providers.microsoft && (
                            <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                                OAuth providers are not configured on this server. Use the SMTP setup below.
                            </div>
                        )}
                    </div>
                )}

                {/* Action row when connected */}
                {account && (
                    <div className="flex flex-wrap gap-3 mb-6">
                        <button
                            onClick={test}
                            disabled={testing}
                            className="px-6 py-2.5 rounded-2xl text-sm font-black bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                        >
                            <Send className="w-4 h-4" />
                            <span>{testing ? 'Sending...' : 'Send test email'}</span>
                        </button>
                        <button
                            onClick={disconnect}
                            disabled={disconnecting}
                            className="px-6 py-2.5 rounded-2xl text-sm font-black bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 flex items-center space-x-2 ml-auto"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                        </button>
                    </div>
                )}

                {/* SMTP collapsed section — fallback for users on Zoho / FastMail / self-hosted */}
                {(!account || account.provider === 'smtp') && (
                    <div className="border-t border-slate-100 pt-6">
                        <button
                            onClick={() => setShowSmtp(s => !s)}
                            className="w-full flex items-center justify-between text-left"
                        >
                            <div className="flex items-center space-x-2">
                                <Key className="w-4 h-4 text-slate-500" />
                                <span className="text-sm font-black text-slate-700">
                                    {account?.provider === 'smtp' ? 'SMTP settings' : 'Or connect via SMTP / app password'}
                                </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showSmtp ? 'rotate-180' : ''}`} />
                        </button>

                        {showSmtp && (
                            <div className="mt-5 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Provider preset</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {Object.entries(PRESETS).map(([key, p]) => (
                                            <button
                                                key={key}
                                                onClick={() => applyPreset(key)}
                                                className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                                                    presetKey === key ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >{p.label}</button>
                                        ))}
                                    </div>
                                    {PRESETS[presetKey].note && (
                                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            {PRESETS[presetKey].note}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <input
                                        type="email" placeholder="you@company.com" value={smtpForm.fromEmail}
                                        onChange={e => setSmtpForm(f => ({ ...f, fromEmail: e.target.value, smtpUser: f.smtpUser || e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm"
                                    />
                                    <input
                                        type="text" placeholder="Your Name" value={smtpForm.fromName}
                                        onChange={e => setSmtpForm(f => ({ ...f, fromName: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <input
                                        type="text" placeholder="smtp.gmail.com" value={smtpForm.smtpHost}
                                        onChange={e => setSmtpForm(f => ({ ...f, smtpHost: e.target.value }))}
                                        className="sm:col-span-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm font-mono"
                                    />
                                    <input
                                        type="number" value={smtpForm.smtpPort}
                                        onChange={e => setSmtpForm(f => ({ ...f, smtpPort: Number(e.target.value) }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm font-mono"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <input
                                        type="text" placeholder="usually same as from email" value={smtpForm.smtpUser}
                                        onChange={e => setSmtpForm(f => ({ ...f, smtpUser: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm font-mono"
                                    />
                                    <input
                                        type="password" placeholder={account?.hasPassword ? '••••••••••••' : 'app password'} value={smtpForm.smtpPass}
                                        onChange={e => setSmtpForm(f => ({ ...f, smtpPass: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm font-mono"
                                    />
                                </div>
                                <div className="flex items-center space-x-2 text-sm text-slate-600">
                                    <input
                                        id="smtpSecure" type="checkbox" checked={smtpForm.smtpSecure}
                                        onChange={e => setSmtpForm(f => ({ ...f, smtpSecure: e.target.checked }))}
                                        className="w-4 h-4"
                                    />
                                    <label htmlFor="smtpSecure">SSL (port 465). Leave off for STARTTLS on 587.</label>
                                </div>
                                <button
                                    onClick={saveSmtp} disabled={saving}
                                    className="px-6 py-2.5 rounded-2xl text-sm font-black bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save SMTP'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
