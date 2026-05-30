"use client";

import { useState, useEffect } from 'react';
import { Puzzle, Zap, Link, ShieldCheck, HelpCircle, Power, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

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

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            {/* Native CRM Integrations Card */}
            <div className="bg-white rounded-[2.5rem] border shadow-sm p-8 space-y-8">
                <div>
                    <h3 className="text-xl font-black text-slate-900">Native CRM Integrations</h3>
                    <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest text-[10px]">
                        Sync prospects directly to your HubSpot, Pipedrive, and Notion pipelines
                    </p>
                </div>

                {isLoadingUser ? (
                    <div className="flex justify-center py-10">
                        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* HubSpot Card */}
                        <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
                            {/* Decorative background logo or pattern */}
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-100/50 font-black text-6xl select-none group-hover:scale-110 transition-transform">HS</div>
                            
                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 bg-gradient-to-tr from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/10">
                                            <svg fill="currentColor" role="img" viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                                                <title>HubSpot</title>
                                                <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z"/>
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800">HubSpot</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CRM Sync</p>
                                        </div>
                                    </div>
                                    {hasHubspot ? (
                                        <span className="flex items-center space-x-1 bg-green-50 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-green-100">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            <span>Connected</span>
                                        </span>
                                    ) : (
                                        <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                            Inactive
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                                    Automatically export leads as new Contacts in HubSpot when they reply.
                                </p>

                                {hasHubspot ? (
                                    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between mt-4">
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Token</p>
                                            <p className="text-xs font-mono font-bold text-slate-700">••••••••••••••••</p>
                                        </div>
                                        <button
                                            onClick={() => handleDisconnectCRM('hubspot')}
                                            disabled={isDisconnectingHubspot}
                                            className="text-xs font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition flex items-center space-x-1.5"
                                        >
                                            <Power className="w-3.5 h-3.5" />
                                            <span>{isDisconnectingHubspot ? "..." : "Disconnect"}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 mt-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Private App Access Token</label>
                                                <a 
                                                    href="https://knowledge.hubspot.com/integrations/create-and-use-private-apps" 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-[9px] font-black text-orange-600 hover:underline flex items-center space-x-0.5"
                                                >
                                                    <HelpCircle className="w-3 h-3" />
                                                    <span>Where to find?</span>
                                                </a>
                                            </div>
                                            <input
                                                type="password"
                                                placeholder="pat-na1-xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                                value={hubspotToken}
                                                onChange={(e) => setHubspotToken(e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                            />
                                        </div>
                                        <button
                                            onClick={handleConnectHubspot}
                                            disabled={isSavingHubspot}
                                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                                        >
                                            {isSavingHubspot ? "Connecting..." : "Connect HubSpot"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pipedrive Card */}
                        <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
                            {/* Decorative background logo or pattern */}
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-100/50 font-black text-6xl select-none group-hover:scale-110 transition-transform">PD</div>

                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/10">
                                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                <rect x="6.5" y="5" width="3" height="14" rx="1.5" />
                                                <circle cx="13.5" cy="9.5" r="4.5" stroke="currentColor" strokeWidth="3" fill="none" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800">Pipedrive</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CRM Sync</p>
                                        </div>
                                    </div>
                                    {hasPipedrive ? (
                                        <span className="flex items-center space-x-1 bg-green-50 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-green-100">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            <span>Connected</span>
                                        </span>
                                    ) : (
                                        <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                            Inactive
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                                    Automatically export leads as new Persons in Pipedrive when they reply.
                                </p>

                                {hasPipedrive ? (
                                    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between mt-4">
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Token</p>
                                            <p className="text-xs font-mono font-bold text-slate-700">••••••••••••••••</p>
                                        </div>
                                        <button
                                            onClick={() => handleDisconnectCRM('pipedrive')}
                                            disabled={isDisconnectingPipedrive}
                                            className="text-xs font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition flex items-center space-x-1.5"
                                        >
                                            <Power className="w-3.5 h-3.5" />
                                            <span>{isDisconnectingPipedrive ? "..." : "Disconnect"}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 mt-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Personal API Token</label>
                                                <a 
                                                    href="https://support.pipedrive.com/en/article/how-can-i-find-my-personal-api-token" 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-[9px] font-black text-emerald-600 hover:underline flex items-center space-x-0.5"
                                                >
                                                    <HelpCircle className="w-3 h-3" />
                                                    <span>Where to find?</span>
                                                </a>
                                            </div>
                                            <input
                                                type="password"
                                                placeholder="api_token_xxxxxxxxxxxxxxxxxxxxxx"
                                                value={pipedriveToken}
                                                onChange={(e) => setPipedriveToken(e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                        <button
                                            onClick={handleConnectPipedrive}
                                            disabled={isSavingPipedrive}
                                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                                        >
                                            {isSavingPipedrive ? "Connecting..." : "Connect Pipedrive"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notion Card */}
                        <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
                            {/* Decorative background logo or pattern */}
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-100/50 font-black text-6xl select-none group-hover:scale-110 transition-transform">N</div>

                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 bg-gradient-to-tr from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/10">
                                            <svg fill="currentColor" role="img" viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                                                <title>Notion</title>
                                                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800">Notion</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CRM Sync</p>
                                        </div>
                                    </div>
                                    {hasNotion ? (
                                        <span className="flex items-center space-x-1 bg-green-50 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-green-100">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            <span>Connected</span>
                                        </span>
                                    ) : (
                                        <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                            Inactive
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                                    Automatically export leads as new Pages in a Notion Database when they reply.
                                </p>

                                {hasNotion ? (
                                    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between mt-4">
                                        <div className="space-y-1 min-w-0 flex-1 mr-2">
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Token</p>
                                                <p className="text-xs font-mono font-bold text-slate-700">••••••••••••••••</p>
                                            </div>
                                            <div className="pt-1.5">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Database ID</p>
                                                <p className="text-xs font-mono font-bold text-slate-700 truncate">{notionDatabaseId || '••••••••••••••••'}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDisconnectCRM('notion')}
                                            disabled={isDisconnectingNotion}
                                            className="text-xs font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition flex items-center space-x-1.5 shrink-0"
                                        >
                                            <Power className="w-3.5 h-3.5" />
                                            <span>{isDisconnectingNotion ? "..." : "Disconnect"}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 mt-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Internal Integration Token</label>
                                                <a 
                                                    href="https://www.notion.so/my-integrations" 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-[9px] font-black text-violet-600 hover:underline flex items-center space-x-0.5"
                                                >
                                                    <HelpCircle className="w-3 h-3" />
                                                    <span>Where to find?</span>
                                                </a>
                                            </div>
                                            <input
                                                type="password"
                                                placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                                value={notionToken}
                                                onChange={(e) => setNotionToken(e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Database ID</label>
                                                <div className="relative group/tooltip flex items-center space-x-1 cursor-pointer">
                                                    <HelpCircle className="w-3.5 h-3.5 text-violet-600" />
                                                    <span className="text-[9px] font-black text-violet-600 hover:underline">How to share?</span>
                                                    <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] font-medium rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 shadow-xl z-50 leading-normal pointer-events-none">
                                                        Important: You must open your Notion database, click the three-dots menu (top right), select "Connections", and add your connection so the API can access it.
                                                    </div>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Enter Database ID"
                                                value={notionDatabaseId}
                                                onChange={(e) => setNotionDatabaseId(e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                                            />
                                        </div>

                                        <button
                                            onClick={handleConnectNotion}
                                            disabled={isSavingNotion}
                                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                                        >
                                            {isSavingNotion ? "Connecting..." : "Connect Notion"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom Webhook Card */}
            <div className="bg-white rounded-[2.5rem] border shadow-sm p-8 space-y-6">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-slate-100 rounded-2xl">
                        <Puzzle className="w-5 h-5 text-slate-700" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800">Webhooks & Third-Party Apps</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Integrate via Zapier or Make.com</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                    <div className="md:col-span-1 space-y-4">
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Provider</label>
                            <select
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                                className="w-full mt-1 px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="ZAPIER">Zapier</option>
                                <option value="MAKE">Make (Integromat)</option>
                                <option value="CUSTOM">Custom Webhook</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Webhook URL</label>
                            <input
                                type="url"
                                placeholder="https://hooks.zapier.com/..."
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                className="w-full mt-1 px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <button
                            onClick={handleSaveWebhook}
                            disabled={isSavingWebhook}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                            {isSavingWebhook ? "Saving..." : "Save Webhook"}
                        </button>
                    </div>

                    <div className="md:col-span-2 border border-slate-100 rounded-3xl p-6 bg-slate-50/50 flex flex-col justify-between">
                        <div className="space-y-4">
                            <h4 className="font-black text-slate-800 text-sm">Active Custom Webhooks</h4>
                            {integrations.length === 0 ? (
                                <p className="text-xs text-slate-400 font-bold">No custom webhooks configured yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {integrations.map((integration) => (
                                        <div key={integration.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white shadow-sm">
                                            <div className="flex items-center space-x-3">
                                                {integration.provider === 'ZAPIER' ? (
                                                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                                                        <Zap className="w-4 h-4" />
                                                    </div>
                                                ) : (
                                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                                        <Link className="w-4 h-4" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-black text-xs text-slate-700 uppercase tracking-wider">{integration.provider}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{integration.webhookUrl}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteWebhook(integration.id)}
                                                className="text-xs font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
