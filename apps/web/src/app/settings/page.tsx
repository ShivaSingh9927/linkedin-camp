'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    User,
    Linkedin,
    Shield,
    CreditCard,
    Globe,
    Sparkles,
    Mail,
    Lock,
    CheckCircle2,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import LinkedInConnectivity from '@/components/LinkedInConnectivity';
import IntegrationsSettings from '@/components/IntegrationsSettings';
import EmailAccountSettings from '@/components/EmailAccountSettings';
import { PageHeader, Card, Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

type SectionKey = 'account' | 'safety' | 'linkedin' | 'email' | 'integrations' | 'billing';

const NAV_GROUPS: { label: string; items: { key: SectionKey; label: string; icon: any; href?: string }[] }[] = [
    {
        label: 'Workspace',
        items: [
            { key: 'account', label: 'Account', icon: User },
            { key: 'safety', label: 'Safety & limits', icon: Shield },
        ],
    },
    {
        label: 'Connections',
        items: [
            { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
            { key: 'email', label: 'Email account', icon: Mail },
            { key: 'integrations', label: 'Integrations', icon: Globe },
        ],
    },
    {
        label: 'Billing',
        items: [{ key: 'billing', label: 'Subscription', icon: CreditCard }],
    },
];

interface Me {
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
    plan?: string | null;
    linkedinCookieValid?: boolean;
    connected?: boolean;
}

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState<SectionKey>('account');

    useEffect(() => {
        const tab = new URLSearchParams(window.location.search).get('tab');
        const valid = NAV_GROUPS.flatMap((g) => g.items).some((s) => s.key === tab);
        if (valid) setActiveSection(tab as SectionKey);
    }, []);

    return (
        <div className="animate-in fade-in duration-300">
            <PageHeader
                title="Settings"
                subtitle="Manage your account, connections, and how the engine behaves."
            />

            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
                {/* NAV RAIL */}
                <aside className="space-y-5">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label}>
                            <div className="label mb-2 px-1">{group.label}</div>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const active = activeSection === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => setActiveSection(item.key)}
                                            className={cn(
                                                'w-full flex items-center gap-2.5 px-3 py-2 rounded-control text-[13px] font-semibold transition',
                                                active
                                                    ? 'bg-brand text-white'
                                                    : 'text-ink-700 hover:bg-white'
                                            )}
                                        >
                                            <item.icon className={cn('w-4 h-4', active ? 'text-white' : 'text-ink-400')} />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="bg-ink-900 rounded-card p-4 text-white relative overflow-hidden">
                        <Sparkles className="absolute -right-3 -top-3 w-16 h-16 text-white/10" />
                        <div className="label !text-brand-200">Current plan</div>
                        <div className="text-[15px] font-bold mt-0.5 capitalize">Advanced</div>
                        <button
                            onClick={() => setActiveSection('billing')}
                            className="w-full mt-3 py-2 bg-white/10 hover:bg-white/15 rounded-control text-[12px] font-semibold transition"
                        >
                            Manage subscription
                        </button>
                    </div>
                </aside>

                {/* CONTENT */}
                <div className="min-w-0">
                    {activeSection === 'account' && <AccountSection />}
                    {activeSection === 'safety' && <SafetySection />}
                    {activeSection === 'linkedin' && <LinkedInConnectivity />}
                    {activeSection === 'email' && <EmailAccountSettings />}
                    {activeSection === 'integrations' && <IntegrationsSettings />}
                    {activeSection === 'billing' && <BillingSection />}
                </div>
            </div>
        </div>
    );
}

function AccountSection() {
    const [me, setMe] = useState<Me | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/users/me')
            .then((res) => {
                setMe(res.data);
                setFirstName(res.data.firstName || '');
                setLastName(res.data.lastName || '');
            })
            .catch(() => { });
    }, []);

    const dirty = !!me && (firstName !== (me.firstName || '') || lastName !== (me.lastName || ''));

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/users/profile', { firstName, lastName });
            // Keep the cached user (sidebar greeting) in sync.
            try {
                const raw = localStorage.getItem('user');
                if (raw) {
                    const u = JSON.parse(raw);
                    localStorage.setItem('user', JSON.stringify({ ...u, name: `${firstName} ${lastName}`.trim() }));
                }
            } catch { /* ignore */ }
            setMe((m) => (m ? { ...m, firstName, lastName } : m));
            toast.success('Profile updated');
        } catch {
            toast.error('Could not save profile');
        } finally {
            setSaving(false);
        }
    };

    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';

    return (
        <div className="space-y-5">
            <Card className="p-6">
                <h3 className="text-[15px] font-bold text-ink-900 mb-5">Profile</h3>
                <div className="flex items-center gap-5 mb-7">
                    <div className="w-16 h-16 rounded-full bg-brand-100 text-brand grid place-items-center text-[20px] font-bold">
                        {initials}
                    </div>
                    <p className="text-[13px] text-ink-400 font-medium">
                        Your initials are shown across the workspace.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <div className="label mb-1.5">First name</div>
                        <input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full bg-surface border border-line rounded-control px-3.5 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30"
                        />
                    </div>
                    <div>
                        <div className="label mb-1.5">Last name</div>
                        <input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full bg-surface border border-line rounded-control px-3.5 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <div className="label mb-1.5">Email</div>
                        <input
                            value={me?.email || ''}
                            readOnly
                            className="w-full bg-surface border border-line rounded-control px-3.5 py-2.5 text-[13px] font-medium text-ink-500 outline-none cursor-not-allowed"
                        />
                        <p className="text-[12px] text-ink-400 mt-1.5">Email is your login and can't be changed here.</p>
                    </div>
                </div>
                <div className="flex justify-end mt-5">
                    <Button onClick={handleSave} disabled={!dirty || saving}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-[15px] font-bold text-ink-900 mb-1">Security</h3>
                <p className="text-[13px] text-ink-500 font-medium mb-4">Password and account access.</p>
                <div className="flex items-center justify-between p-3.5 bg-surface rounded-control">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white rounded-control shadow-soft grid place-items-center text-ink-400">
                            <Lock className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-semibold text-[13px] text-ink-900">Password</div>
                            <div className="text-[12px] text-ink-400">Reset via the email link on the login page.</div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toast.info('Use “Forgot password” on the login screen to reset.')}>
                        Reset
                    </Button>
                </div>
            </Card>
        </div>
    );
}

interface Quota {
    action: string;
    used: number;
    cap: number;
    remaining: number;
    exhausted: boolean;
}

const ACTION_LABELS: Record<string, string> = {
    connect: 'Connection invites',
    'send-message': 'Direct messages',
    'profile-visit': 'Profile visits',
    follow: 'Follows',
    like: 'Post likes',
    comment: 'Comments',
};

function SafetySection() {
    const [quotas, setQuotas] = useState<Quota[] | null>(null);
    const [date, setDate] = useState('');

    const load = useCallback(() => {
        api.get('/safety/quota')
            .then((res) => {
                setQuotas(res.data.quotas);
                setDate(res.data.date);
            })
            .catch(() => setQuotas([]));
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-5">
            <Card className="p-6">
                <div className="flex items-start justify-between mb-1">
                    <h3 className="text-[15px] font-bold text-ink-900">Daily activity limits</h3>
                    {date && <span className="text-[12px] text-ink-400 font-medium">Today · {date}</span>}
                </div>
                <p className="text-[13px] text-ink-500 font-medium mb-5">
                    These caps protect your LinkedIn account from looking automated. They're enforced by the
                    engine and aren't editable.
                </p>

                {!quotas && (
                    <div className="py-10 grid place-items-center text-ink-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                )}

                {quotas && quotas.length === 0 && (
                    <p className="text-[13px] text-ink-400">No activity limits to show right now.</p>
                )}

                <div className="space-y-3">
                    {quotas?.map((q) => {
                        const pct = q.cap > 0 ? Math.min(100, Math.round((q.used / q.cap) * 100)) : 0;
                        return (
                            <div key={q.action}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[13px] font-semibold text-ink-700">
                                        {ACTION_LABELS[q.action] || q.action.replace(/[-_]/g, ' ')}
                                    </span>
                                    <span className="text-[12px] font-semibold text-ink-500 tabular-nums">
                                        {q.used} / {q.cap}
                                    </span>
                                </div>
                                <div className="h-2 rounded-full bg-surface overflow-hidden">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all',
                                            q.exhausted ? 'bg-amber-500' : 'bg-brand'
                                        )}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}

function BillingSection() {
    return (
        <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[15px] font-bold text-ink-900">Subscription</h3>
                <Badge tone="brand">Advanced</Badge>
            </div>
            <p className="text-[13px] text-ink-500 font-medium mb-5">
                You're on the Advanced plan. Billing is managed by our team.
            </p>
            <div className="flex items-center justify-between p-4 bg-surface rounded-control">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-control shadow-soft grid place-items-center text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="font-semibold text-[13px] text-ink-900">Advanced plan · active</div>
                        <div className="text-[12px] text-ink-400">Full access to campaigns, AI, and integrations.</div>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info('Reach out to your account manager to change plans.')}
                >
                    Contact us
                </Button>
            </div>
        </Card>
    );
}
