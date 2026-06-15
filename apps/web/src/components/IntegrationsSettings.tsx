"use client";

import { useState, useEffect } from 'react';
import { Zap, Link as LinkIcon, HelpCircle, RefreshCw, Check, Webhook, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { BrandLogo } from '@/components/BrandLogo';
import { cn } from '@/lib/utils';

export default function IntegrationsSettings() {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [provider, setProvider] = useState('CUSTOM');
    const [isSavingWebhook, setIsSavingWebhook] = useState(false);
    const [integrations, setIntegrations] = useState<any[]>([]);

    // CRM integration state
    const [hubspotToken, setHubspotToken] = useState('');
    const [pipedriveToken, setPipedriveToken] = useState('');
    const [notionToken, setNotionToken] = useState('');
    const [notionDatabaseId, setNotionDatabaseId] = useState('');
    const [hasHubspot, setHasHubspot] = useState(false);
    const [hasPipedrive, setHasPipedrive] = useState(false);
    const [hasNotion, setHasNotion] = useState(false);
    const [isSavingHubspot, setIsSavingHubspot] = useState(false);
    const [isSavingPipedrive, setIsSavingPipedrive] = useState(false);
    const [isSavingNotion, setIsSavingNotion] = useState(false);
    const [isDisconnectingHubspot, setIsDisconnectingHubspot] = useState(false);
    const [isDisconnectingPipedrive, setIsDisconnectingPipedrive] = useState(false);
    const [isDisconnectingNotion, setIsDisconnectingNotion] = useState(false);
    const [isLoadingUser, setIsLoadingUser] = useState(true);
    // Which row is expanded for token entry (one at a time).
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchIntegrations();
        fetchCRMStatus();
    }, []);

    const fetchIntegrations = async () => {
        try {
            const res = await api.get('/integrations');
            setIntegrations(res.data);
            if (res.data.length > 0) {
                setWebhookUrl(res.data[0].webhookUrl);
                setProvider(res.data[0].provider);
            }
        } catch (err) {
            console.error('[INTEGRATIONS] Error fetching webhooks:', err);
        }
    };

    const fetchCRMStatus = async () => {
        setIsLoadingUser(true);
        try {
            const res = await api.get('/users/me');
            setHasHubspot(res.data.hasHubspot);
            setHasPipedrive(res.data.hasPipedrive);
            setHasNotion(res.data.hasNotion);
            if (res.data.notionDatabaseId) {
                setNotionDatabaseId(res.data.notionDatabaseId);
            }
        } catch (err) {
            console.error('[INTEGRATIONS] Error fetching user CRM status:', err);
        } finally {
            setIsLoadingUser(false);
        }
    };

    const handleSaveWebhook = async () => {
        if (!webhookUrl) {
            toast.error("Webhook URL is required");
            return;
        }

        setIsSavingWebhook(true);
        try {
            const res = await api.post('/integrations', { webhookUrl, provider });
            if (res.status === 200 || res.status === 201) {
                toast.success("Webhook integration saved successfully!");
                fetchIntegrations();
            } else {
                toast.error("Failed to save webhook integration");
            }
        } catch (err) {
            toast.error("An error occurred saving webhook");
        } finally {
            setIsSavingWebhook(false);
        }
    };

    const handleDeleteWebhook = async (id: string) => {
        if (!confirm("Are you sure you want to delete this webhook integration?")) return;

        try {
            await api.delete(`/integrations/${id}`);
            toast.success("Webhook integration deleted!");
            fetchIntegrations();
            setWebhookUrl('');
        } catch (err) {
            toast.error("Failed to delete webhook integration");
        }
    };

    const handleConnectHubspot = async () => {
        if (!hubspotToken) {
            toast.error("HubSpot Access Token is required");
            return;
        }

        setIsSavingHubspot(true);
        try {
            const res = await api.put('/users/crm-tokens', { hubspotToken });
            if (res.data.success) {
                toast.success("HubSpot CRM connected successfully!");
                setHubspotToken('');
                setHasHubspot(true);
            } else {
                toast.error("Failed to save HubSpot token");
            }
        } catch (err) {
            toast.error("Error connecting to HubSpot");
        } finally {
            setIsSavingHubspot(false);
        }
    };

    const handleConnectPipedrive = async () => {
        if (!pipedriveToken) {
            toast.error("Pipedrive API Token is required");
            return;
        }

        setIsSavingPipedrive(true);
        try {
            const res = await api.put('/users/crm-tokens', { pipedriveToken });
            if (res.data.success) {
                toast.success("Pipedrive CRM connected successfully!");
                setPipedriveToken('');
                setHasPipedrive(true);
            } else {
                toast.error("Failed to save Pipedrive token");
            }
        } catch (err) {
            toast.error("Error connecting to Pipedrive");
        } finally {
            setIsSavingPipedrive(false);
        }
    };

    const handleConnectNotion = async () => {
        if (!notionToken) {
            toast.error("Notion Integration Token is required");
            return;
        }
        if (!notionDatabaseId) {
            toast.error("Notion Database ID is required");
            return;
        }

        setIsSavingNotion(true);
        try {
            const res = await api.put('/users/crm-tokens', { notionToken, notionDatabaseId });
            if (res.data.success) {
                toast.success("Notion database connected successfully!");
                setNotionToken('');
                setHasNotion(true);
            } else {
                toast.error("Failed to save Notion integration details");
            }
        } catch (err) {
            toast.error("Error connecting to Notion");
        } finally {
            setIsSavingNotion(false);
        }
    };

    const handleDisconnectCRM = async (provider: 'hubspot' | 'pipedrive' | 'notion') => {
        if (!confirm(`Are you sure you want to disconnect your ${provider === 'hubspot' ? 'HubSpot' : provider === 'pipedrive' ? 'Pipedrive' : 'Notion'} integration?`)) {
            return;
        }

        if (provider === 'hubspot') setIsDisconnectingHubspot(true);
        else if (provider === 'pipedrive') setIsDisconnectingPipedrive(true);
        else setIsDisconnectingNotion(true);

        try {
            const res = await api.delete('/users/crm-tokens', { data: { provider } });
            if (res.data.success) {
                toast.success(`${provider === 'hubspot' ? 'HubSpot' : provider === 'pipedrive' ? 'Pipedrive' : 'Notion'} disconnected successfully`);
                if (provider === 'hubspot') setHasHubspot(false);
                else if (provider === 'pipedrive') setHasPipedrive(false);
                else {
                    setHasNotion(false);
                    setNotionDatabaseId('');
                }
            } else {
                toast.error(`Failed to disconnect ${provider}`);
            }
        } catch (err) {
            toast.error(`Error disconnecting ${provider}`);
        } finally {
            setIsDisconnectingHubspot(false);
            setIsDisconnectingPipedrive(false);
            setIsDisconnectingNotion(false);
        }
    };

    // ── Config-driven CRM rows ────────────────────────────────────────────────
    // Each row maps a provider to its connected flag, handlers, and token fields.
    // Adding a new native CRM = one more entry here.
    const CRMS = [
        {
            id: 'hubspot', name: 'HubSpot', blurb: 'Creates a Contact on reply',
            connected: hasHubspot, saving: isSavingHubspot, disconnecting: isDisconnectingHubspot,
            onConnect: handleConnectHubspot, onDisconnect: () => handleDisconnectCRM('hubspot'),
            connectLabel: 'Connect HubSpot',
            fields: [
                { label: 'Private App Access Token', value: hubspotToken, set: setHubspotToken, type: 'password', placeholder: 'pat-na1-xxxxxx-xxxx-xxxx', help: 'https://knowledge.hubspot.com/integrations/create-and-use-private-apps' },
            ],
        },
        {
            id: 'pipedrive', name: 'Pipedrive', blurb: 'Creates a Person on reply',
            connected: hasPipedrive, saving: isSavingPipedrive, disconnecting: isDisconnectingPipedrive,
            onConnect: handleConnectPipedrive, onDisconnect: () => handleDisconnectCRM('pipedrive'),
            connectLabel: 'Connect Pipedrive',
            fields: [
                { label: 'Personal API Token', value: pipedriveToken, set: setPipedriveToken, type: 'password', placeholder: 'api_token_xxxxxxxxxxxx', help: 'https://support.pipedrive.com/en/article/how-can-i-find-my-personal-api-token' },
            ],
        },
        {
            id: 'notion', name: 'Notion', blurb: 'Adds a Page to a database on reply',
            connected: hasNotion, saving: isSavingNotion, disconnecting: isDisconnectingNotion,
            onConnect: handleConnectNotion, onDisconnect: () => handleDisconnectCRM('notion'),
            connectLabel: 'Connect Notion',
            fields: [
                { label: 'Integration Token', value: notionToken, set: setNotionToken, type: 'password', placeholder: 'secret_xxxxxxxxxxxx', help: 'https://www.notion.so/my-integrations' },
                { label: 'Database ID', value: notionDatabaseId, set: setNotionDatabaseId, type: 'text', placeholder: 'Enter Database ID', help: '' },
            ],
        },
    ];

    const renderCrmRow = (c: typeof CRMS[number]) => {
        const open = expandedId === c.id && !c.connected;
        return (
            <div key={c.id} className={cn('px-6 border-b border-line last:border-0', open && 'bg-brand-50/30')}>
                <div className="py-3.5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-white border border-line grid place-items-center p-2 shrink-0">
                        <BrandLogo name={c.id} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold text-ink-900">{c.name}</span>
                            {c.connected && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-chip"><Check className="w-3 h-3" />Connected</span>
                            )}
                        </div>
                        <p className="text-[12px] text-ink-400 truncate">{c.blurb}</p>
                    </div>
                    {c.connected ? (
                        <button onClick={c.onDisconnect} disabled={c.disconnecting} className="shrink-0 px-3.5 py-2 rounded-control text-[13px] font-semibold text-ink-500 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50">
                            {c.disconnecting ? '…' : 'Disconnect'}
                        </button>
                    ) : open ? (
                        <button onClick={() => setExpandedId(null)} className="shrink-0 px-3 py-2 rounded-control text-[13px] font-semibold text-ink-400">Cancel</button>
                    ) : (
                        <>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 bg-surface px-2 py-0.5 rounded-chip hidden sm:inline">Not connected</span>
                            <button onClick={() => setExpandedId(c.id)} className="shrink-0 px-4 py-2 rounded-control bg-ink-900 text-white text-[13px] font-semibold hover:bg-ink-700 transition">Connect</button>
                        </>
                    )}
                </div>
                {open && (
                    <div className="pb-4 pl-[60px] grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        {c.fields.map((f, i) => (
                            <div key={i} className={cn(c.fields.length === 1 && 'sm:col-span-2')}>
                                <div className="label mb-1 flex items-center justify-between normal-case">
                                    <span className="uppercase">{f.label}</span>
                                    {f.help && <a href={f.help} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold inline-flex items-center gap-0.5"><HelpCircle className="w-3 h-3" />Where?</a>}
                                </div>
                                <input
                                    type={f.type}
                                    placeholder={f.placeholder}
                                    value={f.value}
                                    onChange={(e) => f.set(e.target.value)}
                                    className="w-full bg-white border border-line rounded-control px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                        ))}
                        <div className="sm:col-span-2 flex justify-end">
                            <button onClick={c.onConnect} disabled={c.saving} className="px-4 py-2 rounded-control bg-brand text-white text-[13px] font-semibold shadow-soft disabled:opacity-50 inline-flex items-center gap-1.5">
                                {c.saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {c.saving ? 'Connecting…' : c.connectLabel}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const webhookOpen = expandedId === 'webhook';
    const COMING_SOON = ['Salesforce', 'Google Sheets', 'Slack', 'Zoho CRM'];

    return (
        <div>
            <div className="bg-white rounded-card border border-line shadow-soft overflow-hidden">
                {/* Panel header with the single shared description */}
                <div className="px-6 py-5 border-b border-line flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-[16px] font-bold text-ink-900">Integrations</h3>
                        <p className="text-[13px] text-ink-500 font-medium mt-0.5">Automatically sync replied leads to the apps you connect — Qampi pushes new contacts the moment a lead replies.</p>
                    </div>
                    <a href="mailto:support@qampi.ai?subject=Integration%20request" className="shrink-0 px-3.5 py-2 rounded-control bg-surface border border-line text-[13px] font-semibold text-ink-700 inline-flex items-center gap-1.5 hover:bg-brand-50 hover:text-brand transition"><Plus className="w-4 h-4" />Request app</a>
                </div>

                {isLoadingUser ? (
                    <div className="flex justify-center py-12"><RefreshCw className="w-7 h-7 text-ink-400 animate-spin" /></div>
                ) : (
                    <>
                        {/* CRM & data */}
                        <div className="px-6 pt-4 pb-1"><div className="label">CRM &amp; data</div></div>
                        {CRMS.map(renderCrmRow)}

                        {/* Automation */}
                        <div className="px-6 pt-4 pb-1"><div className="label">Automation</div></div>
                        <div className={cn('px-6 border-b border-line', webhookOpen && 'bg-brand-50/30')}>
                            <div className="py-3.5 flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl bg-white border border-line grid place-items-center p-2 shrink-0 text-ink-500"><Webhook className="w-5 h-5" /></div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[14px] font-bold text-ink-900">Webhooks <span className="text-ink-400 font-medium">· Zapier, Make, Custom</span></div>
                                    <p className="text-[12px] text-ink-400 truncate">POST reply events to any URL — connect 6,000+ apps</p>
                                </div>
                                {webhookOpen ? (
                                    <button onClick={() => setExpandedId(null)} className="shrink-0 px-3 py-2 rounded-control text-[13px] font-semibold text-ink-400">Cancel</button>
                                ) : (
                                    <button onClick={() => setExpandedId('webhook')} className="shrink-0 px-4 py-2 rounded-control bg-ink-900 text-white text-[13px] font-semibold hover:bg-ink-700 transition">Add webhook</button>
                                )}
                            </div>
                            {webhookOpen && (
                                <div className="pb-4 pl-[60px] grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
                                    <div>
                                        <div className="label mb-1">Provider</div>
                                        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full bg-white border border-line rounded-control px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30">
                                            <option value="ZAPIER">Zapier</option>
                                            <option value="MAKE">Make (Integromat)</option>
                                            <option value="CUSTOM">Custom Webhook</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div className="label mb-1">Webhook URL</div>
                                        <input type="url" placeholder="https://hooks.zapier.com/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full bg-white border border-line rounded-control px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30" />
                                    </div>
                                    <button onClick={handleSaveWebhook} disabled={isSavingWebhook} className="px-4 py-2 rounded-control bg-brand text-white text-[13px] font-semibold shadow-soft disabled:opacity-50">
                                        {isSavingWebhook ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            )}
                            {/* Active webhooks */}
                            {integrations.length > 0 && (
                                <div className="pb-4 pl-[60px] space-y-2">
                                    {integrations.map((integration) => (
                                        <div key={integration.id} className="flex items-center gap-3 bg-surface rounded-control px-3 py-2">
                                            <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0 bg-white border border-line text-ink-500">
                                                {integration.provider === 'ZAPIER' ? <Zap className="w-3.5 h-3.5 text-[#FF4F00]" /> : <LinkIcon className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-bold text-ink-700 uppercase tracking-wider">{integration.provider}</p>
                                                <p className="text-[11px] text-ink-400 font-mono truncate">{integration.webhookUrl}</p>
                                            </div>
                                            <button onClick={() => handleDeleteWebhook(integration.id)} className="text-[12px] font-semibold text-ink-400 hover:text-red-500 px-2 py-1 rounded-chip transition">Delete</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Coming soon */}
                        <div className="px-6 pt-4 pb-1"><div className="label">Coming soon</div></div>
                        <div className="px-6 pb-5 flex flex-wrap gap-2">
                            {COMING_SOON.map((name) => (
                                <span key={name} className="inline-flex items-center gap-2 px-3 py-2 rounded-control border border-line bg-surface text-[13px] font-semibold text-ink-400">{name}</span>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

