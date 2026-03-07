"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Shield, Globe } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/constants";

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
                fetchProxies(); // Refresh the list

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
        <div className="container mx-auto py-10 max-w-6xl space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Proxy Fleet Configuration</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your Static ISP endpoints for cloud LinkedIn automation.
                        Waalaxy strategy active: max 5 users per IP.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Badge variant="outline" className="text-sm px-4 py-1 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        Private IPs
                    </Badge>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 border-primary/20">
                    <CardHeader>
                        <CardTitle>Add New Proxies</CardTitle>
                        <CardDescription>Paste your Oxylabs or Webshare list here. Supports IP:PORT or host:port:user:pass.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-blue-500" /> Country Scope
                                </label>
                                <Input
                                    value={countryInput}
                                    onChange={(e) => setCountryInput(e.target.value.toUpperCase())}
                                    placeholder="e.g., IN, US, GB"
                                    maxLength={2}
                                />
                                <p className="text-xs text-muted-foreground mt-1">This tags the ISP pool for targeted user assignment.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-purple-500" /> Proxy Tier Status
                                </label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                    value={tierInput}
                                    onChange={(e) => setTierInput(e.target.value)}
                                >
                                    <option value="ECONOMY">Economy (15 Users / IP) - For Core/Free</option>
                                    <option value="PREMIUM">Premium (5 Users / IP) - For Plus/Expert</option>
                                </select>
                                <p className="text-xs text-muted-foreground">Premium proxies are highly restrictive to prevent bans for top clients.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Proxy List</label>
                                <Textarea
                                    className="font-mono text-xs min-h-[250px]"
                                    placeholder="disp.oxylabs.io:8001:user-shiva:secretpass&#10;disp.oxylabs.io:8002:user-shiva:secretpass"
                                    value={proxyInput}
                                    onChange={(e) => setProxyInput(e.target.value)}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                {isSubmitting ? "Importing..." : "Add Proxies to Database"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Active Fleet Allocation</CardTitle>
                        <CardDescription>Monitor your IPs and limit utilization in real-time.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : proxies.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <h3 className="text-lg font-medium">No Proxies Available</h3>
                                <p className="text-sm text-muted-foreground mt-1">Add your first Oxylabs endpoints to begin secure automation.</p>
                            </div>
                        ) : (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Host:Port</TableHead>
                                            <TableHead>Region & Tier</TableHead>
                                            <TableHead>Health</TableHead>
                                            <TableHead>Utilization</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {proxies.map(proxy => (
                                            <TableRow key={proxy.id}>
                                                <TableCell className="font-mono text-xs">{proxy.proxyIp}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <span>{proxy.proxyCountry || 'Global'}</span>
                                                        <Badge variant="outline" className={`w-fit text-[10px] ${proxy.tierClass === 'PREMIUM' ? 'border-purple-500 text-purple-600' : 'border-blue-500 text-blue-600'}`}>
                                                            {proxy.tierClass}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {proxy.banned ? (
                                                        <Badge variant="destructive">Banned by LinkedIn</Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col gap-1 w-full max-w-[100px]">
                                                            <div className="flex justify-between text-xs">
                                                                <span>{proxy._count.assignedUsers} / {proxy.maxUsers || 5}</span>
                                                                <span className="text-muted-foreground text-[10px]">Users</span>
                                                            </div>
                                                            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${proxy._count.assignedUsers >= (proxy.maxUsers || 5) ? 'bg-orange-500' : 'bg-primary'}`}
                                                                    style={{ width: `${Math.min(100, (proxy._count.assignedUsers / (proxy.maxUsers || 5)) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(proxy.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive/80" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
