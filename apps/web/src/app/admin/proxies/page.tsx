"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Shield, Globe } from "lucide-react";

// Assuming toast might not exist either, I'll mock it if it doesn't, or let it fail if sonner is missing. Wait, package.json doesn't list sonner either! Let's check.
// I'll just use simple alerts for now to ensure compilation, or window.alert.
// Better yet, implement a simple toast wrapper:
const toast = {
    success: (msg: string) => alert(msg),
    error: (msg: string) => alert(msg),
    warning: (msg: string) => alert(msg)
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

type Proxy = {
    id: string;
    proxyIp: string;
    proxyCountry: string | null;
    tierClass: string;
    maxUsers: number;
    isAssigned: boolean;
    banned: boolean;
    _count: {
        assignedUsers: number;
    };
    createdAt: string;
};

export default function AdminProxiesPage() {
    const [proxies, setProxies] = useState<Proxy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [proxyInput, setProxyInput] = useState("");
    const [countryInput, setCountryInput] = useState("IN");
    const [tierInput, setTierInput] = useState("ECONOMY");

    const fetchProxies = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/admin/proxies`);
            const data = await res.json();
            if (data.success) {
                setProxies(data.proxies);
            }
        } catch (error) {
            toast.error("Failed to load proxies");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProxies();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this proxy? Any connected users may experience downtime.")) return;

        try {
            const res = await fetch(`${API_BASE_URL}/admin/proxies/${id}`, {
                method: "DELETE"
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Proxy deleted successfully");
                setProxies(proxies.filter(p => p.id !== id));
            } else {
                toast.error(data.error || "Failed to delete proxy");
            }
        } catch (error) {
            toast.error("Network error");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!proxyInput.trim()) {
            toast.error("Please enter at least one proxy");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/admin/proxies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    proxiesText: proxyInput,
                    country: countryInput,
                    tierClass: tierInput
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(`Successfully added ${data.added} proxies!`);
                setProxyInput("");
                fetchProxies();

                if (data.errors && data.errors.length > 0) {
                    toast.warning(`${data.errors.length} proxies failed to import. Check console.`);
                    console.warn("Proxy import errors:", data.errors);
                }
            } else {
                toast.error(data.error || "Failed to add proxies");
            }
        } catch (error) {
            toast.error("Network error while adding proxies");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto py-10 max-w-6xl space-y-8 px-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Proxy Fleet Configuration</h1>
                    <p className="text-slate-500 mt-2">
                        Manage your Static ISP endpoints for cloud LinkedIn automation.
                        Waalaxy strategy active: max 5 users per IP.
                    </p>
                </div>
                <div className="flex gap-4">
                    <span className="text-sm px-4 py-2 border rounded-full flex items-center gap-2 font-medium bg-white">
                        <Shield className="w-4 h-4 text-green-500" />
                        Private IPs
                    </span>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 border rounded-2xl shadow-sm bg-white overflow-hidden">
                    <div className="p-6 border-b bg-slate-50">
                        <h3 className="font-semibold text-lg">Add New Proxies</h3>
                        <p className="text-sm text-slate-500">Paste your Oxylabs or Webshare list here. Supports IP:PORT or host:port:user:pass.</p>
                    </div>
                    <div className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-blue-500" /> Country Scope
                                </label>
                                <input
                                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={countryInput}
                                    onChange={(e) => setCountryInput(e.target.value.toUpperCase())}
                                    placeholder="e.g., IN, US, GB"
                                    maxLength={2}
                                />
                                <p className="text-xs text-slate-500 mt-1">This tags the ISP pool for targeted user assignment.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-purple-500" /> Proxy Tier Status
                                </label>
                                <select
                                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={tierInput}
                                    onChange={(e) => setTierInput(e.target.value)}
                                >
                                    <option value="ECONOMY">Economy (15 Users / IP) - For Core/Free</option>
                                    <option value="PREMIUM">Premium (5 Users / IP) - For Plus/Expert</option>
                                </select>
                                <p className="text-xs text-slate-500">Premium proxies are highly restrictive to prevent bans for top clients.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Proxy List</label>
                                <textarea
                                    className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono min-h-[250px] resize-y"
                                    placeholder="disp.oxylabs.io:8001:user-shiva:secretpass&#10;disp.oxylabs.io:8002:user-shiva:secretpass"
                                    value={proxyInput}
                                    onChange={(e) => setProxyInput(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full flex justify-center items-center h-10 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {isSubmitting ? "Importing..." : "Add Proxies to Database"}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="md:col-span-2 border rounded-2xl shadow-sm bg-white overflow-hidden">
                    <div className="p-6 border-b bg-slate-50">
                        <h3 className="font-semibold text-lg">Active Fleet Allocation</h3>
                        <p className="text-sm text-slate-500">Monitor your IPs and limit utilization in real-time.</p>
                    </div>
                    <div className="p-0">
                        {isLoading ? (
                            <div className="flex justify-center p-12">
                                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                            </div>
                        ) : proxies.length === 0 ? (
                            <div className="text-center p-12 m-6 border-2 border-dashed rounded-xl border-slate-200">
                                <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-slate-700">No Proxies Available</h3>
                                <p className="text-sm text-slate-500 mt-1">Add your first Oxylabs endpoints to begin secure automation.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold">Host:Port</th>
                                            <th className="px-6 py-4 font-semibold">Region & Tier</th>
                                            <th className="px-6 py-4 font-semibold">Health</th>
                                            <th className="px-6 py-4 font-semibold">Utilization</th>
                                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {proxies.map(proxy => (
                                            <tr key={proxy.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-xs text-slate-600">{proxy.proxyIp}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col items-start gap-1.5">
                                                        <span className="font-medium">{proxy.proxyCountry || 'Global'}</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${proxy.tierClass === 'PREMIUM' ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                                                            {proxy.tierClass}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {proxy.banned ? (
                                                        <span className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-semibold">
                                                            Banned
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
                                                            Healthy
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1 w-full max-w-[120px]">
                                                        <div className="flex justify-between text-xs font-medium">
                                                            <span className="text-slate-700">{proxy._count.assignedUsers} / {proxy.maxUsers || 5}</span>
                                                            <span className="text-slate-400 text-[10px] uppercase">Users</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${proxy._count.assignedUsers >= (proxy.maxUsers || 5) ? 'bg-orange-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${Math.min(100, (proxy._count.assignedUsers / (proxy.maxUsers || 5)) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        onClick={() => handleDelete(proxy.id)}
                                                        title="Delete proxy"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
