"use client";

import { useState, useEffect } from 'react';
import { Puzzle, Zap, Link } from 'lucide-react';
import { toast } from 'sonner';

export default function IntegrationsSettings() {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [provider, setProvider] = useState('CUSTOM');
    const [isSaving, setIsSaving] = useState(false);
    const [integrations, setIntegrations] = useState<any[]>([]);

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3001/api/v1/integrations`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setIntegrations(data);
                // Pre-fill if there is an existing one
                if (data.length > 0) {
                    setWebhookUrl(data[0].webhookUrl);
                    setProvider(data[0].provider);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSave = async () => {
        if (!webhookUrl) {
            toast.error("Webhook URL is required");
            return;
        }

        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3001/api/v1/integrations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ webhookUrl, provider })
            });

            if (res.ok) {
                toast.success("Integration saved successfully!");
                fetchIntegrations();
            } else {
                toast.error("Failed to save integration");
            }
        } catch (err) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this integration?")) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3001/api/v1/integrations/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                toast.success("Integration deleted!");
                fetchIntegrations();
                setWebhookUrl('');
            } else {
                toast.error("Failed to delete integration");
            }
        } catch (err) {
            toast.error("An error occurred");
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-800 rounded-xl">
                        <Puzzle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Webhook Integrations (Zapier, Make.com)</h3>
                        <p className="text-xs text-slate-400">Send lead data to a webhook when they reply or complete a campaign.</p>
                    </div>
                </div>

                <div className="space-y-4 mt-6">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Provider</label>
                        <select
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            className="w-full mt-1 px-4 py-2 border rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                            <option value="ZAPIER">Zapier</option>
                            <option value="MAKE">Make (Integromat)</option>
                            <option value="CUSTOM">Custom Webhook</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Webhook URL</label>
                        <input
                            type="url"
                            placeholder="https://hooks.zapier.com/hooks/catch/12345/abcde"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            className="w-full mt-1 px-4 py-2 border rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                        >
                            {isSaving ? "Saving..." : "Save Webhook"}
                        </button>
                    </div>
                </div>
            </div>

            {integrations.length > 0 && (
                <div className="bg-white rounded-3xl border shadow-sm p-6 space-y-4">
                    <h3 className="font-bold text-slate-800">Active Integrations</h3>
                    <div className="space-y-3 mt-4">
                        {integrations.map((integration) => (
                            <div key={integration.id} className="flex items-center justify-between p-4 border rounded-2xl bg-slate-50">
                                <div className="flex items-center space-x-3">
                                    {integration.provider === 'ZAPIER' ? (
                                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                            <Zap className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                            <Link className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-sm text-slate-700">{integration.provider}</p>
                                        <p className="text-xs text-slate-500 font-mono truncate max-w-xs">{integration.webhookUrl}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(integration.id)}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
