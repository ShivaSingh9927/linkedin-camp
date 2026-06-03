"use client";

import { useEffect, useState } from 'react';
import { Mail, Send, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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
    gmail: {
        label: 'Gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        note: 'Use a Gmail App Password — your regular password will not work. Settings → Security → 2-Step Verification → App passwords.',
    },
    outlook: {
        label: 'Outlook / Microsoft 365',
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
    },
    yahoo: {
        label: 'Yahoo',
        host: 'smtp.mail.yahoo.com',
        port: 465,
        secure: true,
        note: 'Yahoo requires a generated app password (Account Security → Generate app password).',
    },
    icloud: {
        label: 'iCloud',
        host: 'smtp.mail.me.com',
        port: 587,
        secure: false,
        note: 'iCloud requires an app-specific password (appleid.apple.com → Sign-In and Security).',
    },
    custom: {
        label: 'Custom SMTP',
        host: '',
        port: 587,
        secure: false,
    },
};

export default function EmailAccountSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [presetKey, setPresetKey] = useState<string>('gmail');
    const [hasPassword, setHasPassword] = useState(false);
    const [lastSendAt, setLastSendAt] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [form, setForm] = useState({
        fromEmail: '',
        fromName: '',
        smtpHost: PRESETS.gmail.host,
        smtpPort: PRESETS.gmail.port,
        smtpUser: '',
        smtpPass: '',
        smtpSecure: PRESETS.gmail.secure,
    });

    useEffect(() => { void load(); }, []);

    const load = async () => {
        try {
            const { data } = await api.get('/email-account');
            if (data.account) {
                setForm(f => ({
                    ...f,
                    fromEmail: data.account.fromEmail || '',
                    fromName: data.account.fromName || '',
                    smtpHost: data.account.smtpHost || '',
                    smtpPort: data.account.smtpPort || 587,
                    smtpUser: data.account.smtpUser || '',
                    smtpPass: '',
                    smtpSecure: data.account.smtpSecure || false,
                }));
                setHasPassword(data.account.hasPassword);
                setLastSendAt(data.account.lastSendAt);
                setLastError(data.account.lastError);
                // Best-effort preset match
                const matched = Object.entries(PRESETS).find(([_, p]) => p.host === data.account.smtpHost);
                if (matched) setPresetKey(matched[0]);
                else setPresetKey('custom');
            }
        } catch (e: any) {
            toast.error('Failed to load email account');
        } finally {
            setLoading(false);
        }
    };

    const applyPreset = (key: string) => {
        setPresetKey(key);
        const p = PRESETS[key];
        setForm(f => ({ ...f, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure }));
    };

    const save = async () => {
        if (!form.fromEmail || !form.smtpHost || !form.smtpUser) {
            toast.error('From-email, host, and username are required');
            return;
        }
        if (!hasPassword && !form.smtpPass) {
            toast.error('Password is required on first setup');
            return;
        }
        setSaving(true);
        try {
            const body: any = { ...form };
            if (!form.smtpPass) delete body.smtpPass;
            await api.put('/email-account', body);
            toast.success('Email account saved');
            setForm(f => ({ ...f, smtpPass: '' }));
            setHasPassword(true);
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
            toast.success(`Test email sent (${data.messageId}). Check ${form.fromEmail}.`);
            setLastError(null);
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Test failed');
            setLastError(e?.response?.data?.error || 'Test failed');
        } finally {
            setTesting(false);
        }
    };

    const disconnect = async () => {
        if (!confirm('Disconnect email account? Campaigns with EMAIL nodes will skip sending.')) return;
        setDisconnecting(true);
        try {
            await api.delete('/email-account');
            toast.success('Email account disconnected');
            setForm({
                fromEmail: '', fromName: '', smtpHost: PRESETS.gmail.host, smtpPort: 587,
                smtpUser: '', smtpPass: '', smtpSecure: false,
            });
            setHasPassword(false);
            setLastSendAt(null);
            setLastError(null);
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
                            Connect an outgoing SMTP account so campaigns with EMAIL steps can send from your address.
                        </p>
                    </div>
                </div>

                {hasPassword && (
                    <div className="mb-6 flex items-center space-x-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Connected as <strong>{form.fromEmail}</strong>{lastSendAt && ` · last send ${new Date(lastSendAt).toLocaleString()}`}</span>
                    </div>
                )}

                {lastError && (
                    <div className="mb-6 flex items-start space-x-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Last error:</strong> {lastError}</span>
                    </div>
                )}

                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Provider</label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {Object.entries(PRESETS).map(([key, p]) => (
                                <button
                                    key={key}
                                    onClick={() => applyPreset(key)}
                                    className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                                        presetKey === key
                                            ? 'bg-slate-900 text-white shadow-md'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {PRESETS[presetKey].note && (
                            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                {PRESETS[presetKey].note}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">From email</label>
                            <input
                                type="email"
                                value={form.fromEmail}
                                onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value, smtpUser: f.smtpUser || e.target.value }))}
                                placeholder="you@company.com"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">From name</label>
                            <input
                                type="text"
                                value={form.fromName}
                                onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))}
                                placeholder="Your Name"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">SMTP host</label>
                            <input
                                type="text"
                                value={form.smtpHost}
                                onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))}
                                placeholder="smtp.gmail.com"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Port</label>
                            <input
                                type="number"
                                value={form.smtpPort}
                                onChange={e => setForm(f => ({ ...f, smtpPort: Number(e.target.value) }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">SMTP username</label>
                            <input
                                type="text"
                                value={form.smtpUser}
                                onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))}
                                placeholder="usually same as from email"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                                SMTP password {hasPassword && <span className="text-emerald-600 normal-case font-normal">(stored — leave blank to keep)</span>}
                            </label>
                            <input
                                type="password"
                                value={form.smtpPass}
                                onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))}
                                placeholder={hasPassword ? '••••••••••••' : 'app password'}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-0 outline-none text-sm font-mono"
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                        <input
                            id="smtpSecure"
                            type="checkbox"
                            checked={form.smtpSecure}
                            onChange={e => setForm(f => ({ ...f, smtpSecure: e.target.checked }))}
                            className="w-4 h-4"
                        />
                        <label htmlFor="smtpSecure">SSL (port 465). Leave off for STARTTLS on 587.</label>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                        <button
                            onClick={save}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-2xl text-sm font-black bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={test}
                            disabled={testing || !hasPassword}
                            className="px-6 py-2.5 rounded-2xl text-sm font-black bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                        >
                            <Send className="w-4 h-4" />
                            <span>{testing ? 'Sending...' : 'Send test email'}</span>
                        </button>
                        {hasPassword && (
                            <button
                                onClick={disconnect}
                                disabled={disconnecting}
                                className="px-6 py-2.5 rounded-2xl text-sm font-black bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 flex items-center space-x-2 ml-auto"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
