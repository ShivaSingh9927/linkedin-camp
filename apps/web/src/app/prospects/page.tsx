"use client";

import { useState, useEffect, useRef } from 'react';
import {
    Search,
    Filter,
    Linkedin,
    ChevronRight,
    ChevronDown,
    Plus,
    Zap,
    Loader2,
    Upload,
    Trash2,
    X,
    Tag,
    List,
    Users,
    FolderOpen,
    Layers,
    ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Lead {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    company: string;
    email: string;
    status: string;
    linkedinUrl: string;
    country: string;
    gender: string;
    tags: string[];
    createdAt: string;
    campaignLeads?: { campaign: { name: string } }[];
}

interface Campaign {
    id: string;
    name: string;
    status: string;
}

const STATUS_OPTIONS = ['UNCONNECTED', 'INVITE_PENDING', 'CONNECTED', 'REPLIED', 'BOUNCED'];
const GENDER_OPTIONS = ['male', 'female']; // Lowercase to match data

const FILTER_PILLS = [
    { key: 'status', label: 'Status', icon: '🔵' },
    { key: 'gender', label: 'Gender', icon: '👤' },
    { key: 'tags', label: 'Tags', icon: '🏷️' },
    { key: 'hasEmail', label: 'Email', icon: '✉️' },
    { key: 'country', label: 'Country', icon: '🌍' },
];

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualLeadData, setManualLeadData] = useState({
        firstName: '',
        lastName: '',
        linkedinUrl: '',
        jobTitle: '',
        company: '',
        email: '',
        tags: ''
    });
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sidebar: list-based navigation
    const [activeList, setActiveList] = useState<string | null>(null); // null = "All Prospects"

    // Filters
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchLeads();
        fetchCampaigns();
    }, []);

    // Close filter dropdown when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.filter-dropdown-container')) {
                setActiveFilter(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchLeads = async () => {
        try {
            const response = await api.get('/leads');
            setLeads(response.data);
        } catch (error) {
            console.error('Failed to fetch leads:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCampaigns = async () => {
        try {
            const response = await api.get('/campaigns');
            setCampaigns(response.data.filter((c: any) => c.status !== 'COMPLETED'));
        } catch (error) {
            console.error('Failed to fetch campaigns:', error);
        }
    };

    const handleManualLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const payload = {
                ...manualLeadData,
                tags: manualLeadData.tags ? manualLeadData.tags.split(',').map(t => t.trim()) : []
            };
            await api.post('/leads/manual', payload);
            alert('Lead added successfully!');
            setShowManualModal(false);
            setManualLeadData({
                firstName: '',
                lastName: '',
                linkedinUrl: '',
                jobTitle: '',
                company: '',
                email: '',
                tags: ''
            });
            fetchLeads();
        } catch (error) {
            console.error('Manual add failed:', error);
            alert('Failed to add lead. Check LinkedIn URL uniqueness.');
        } finally {
            setActionLoading(false);
        }
    };

    const generateDemo = async () => {
        setActionLoading(true);
        try {
            await api.post('/leads/demo');
            await fetchLeads();
        } catch (error) {
            alert('Demo generation failed. Ensure backend and DB are running.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setActionLoading(true);
        try {
            const response = await api.post('/leads/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(`Success! ${response.data.count} leads imported.`);
            fetchLeads();
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload CSV. Ensure the format is correct.');
        } finally {
            setActionLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const toggleSelectAll = () => {
        if (selectedLeads.size === filteredLeads.length) {
            setSelectedLeads(new Set());
        } else {
            setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
        }
    };

    const toggleSelectLead = (id: string) => {
        const newSelected = new Set(selectedLeads);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedLeads(newSelected);
    };

    const assignToCampaign = async (campaignId: string) => {
        try {
            const response = await api.post(`/campaigns/${campaignId}/start`, {
                leadIds: Array.from(selectedLeads)
            });

            const meta = response.data?.meta;
            let message = `Success! ${meta?.startedCount ?? selectedLeads.size} leads assigned to campaign.`;

            if (meta && meta.skippedCount > 0) {
                message += `\n\nNotification: ${meta.skippedCount} leads were skipped securely because they are already active in another campaign!`;
            }

            alert(message);
            setSelectedLeads(new Set());
            setShowAssignModal(false);
        } catch (error) {
            console.error('Failed to assign leads:', error);
            alert('Error assigning leads.');
        }
    };

    const handleDeleteLead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this lead?')) return;

        try {
            await api.delete(`/leads/${id}`);
            setLeads(leads.filter(l => l.id !== id));
            setSelectedLeads(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete lead.');
        }
    };

    const setFilter = (key: string, value: string) => {
        setFilters(prev => {
            if (prev[key] === value) {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [key]: value };
        });
        setActiveFilter(null);
    };

    const removeFilter = (key: string) => {
        setFilters(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const clearFilters = () => {
        setFilters({});
        setActiveFilter(null);
    };

    // ─── Derived data ───
    // Get unique tags across all leads (for sidebar lists)
    const uniqueTags = [...new Set(leads.flatMap(l => l.tags || []))].sort();
    const uniqueCountries = [...new Set(leads.map(l => l.country).filter(Boolean))].sort();

    // Count leads per tag
    const tagCounts = uniqueTags.reduce((acc, tag) => {
        acc[tag] = leads.filter(l => (l.tags || []).includes(tag)).length;
        return acc;
    }, {} as Record<string, number>);

    // Step 1: Filter by active list (sidebar)
    const listFilteredLeads = activeList
        ? leads.filter(lead => (lead.tags || []).includes(activeList))
        : leads;

    // Step 2: Apply search + filters on top of list-filtered leads
    const filteredLeads = listFilteredLeads.filter(lead => {
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const match = [lead.firstName, lead.lastName, lead.company, lead.jobTitle, lead.email, lead.country]
                .filter(Boolean)
                .some(v => v?.toLowerCase().includes(q));
            if (!match) return false;
        }
        // Status
        if (filters.status && lead.status !== filters.status) return false;
        // Gender (case-insensitive comparison)
        if (filters.gender && lead.gender?.toLowerCase() !== filters.gender.toLowerCase()) return false;
        // Tags filter (additional tag filter on top of sidebar list)
        if (filters.tags && !(lead.tags || []).includes(filters.tags)) return false;
        // Has Email
        if (filters.hasEmail === 'yes' && !lead.email) return false;
        if (filters.hasEmail === 'no' && lead.email) return false;
        // Country
        if (filters.country && lead.country !== filters.country) return false;

        return true;
    });

    const statusColor = (status: string) => {
        switch (status) {
            case 'CONNECTED': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'INVITE_PENDING': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            case 'REPLIED': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'BOUNCED': return 'bg-red-500/10 text-red-600 border-red-500/20';
            default: return 'bg-muted text-muted-foreground border-border';
        }
    };

    const filterDisplayValue = (key: string, value: string) => {
        if (key === 'hasEmail') return value === 'yes' ? 'Has email' : 'No email';
        if (key === 'gender') return value.charAt(0).toUpperCase() + value.slice(1);
        if (key === 'status') return value.replace('_', ' ');
        return value;
    };

    if (loading) return (
        <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="flex bg-card border border-border rounded-[3rem] shadow-soft overflow-hidden h-full min-h-[700px] animate-in fade-in duration-500">
            {/* ─── Left Sidebar: Lists ─── */}
            <div className="w-72 flex-shrink-0 border-r bg-muted/30 flex flex-col">
                <div className="p-8 border-b border-border">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2">
                        Prospect Ecosystem
                    </h3>

                    {/* All Prospects */}
                    <button
                        onClick={() => { setActiveList(null); setSelectedLeads(new Set()); }}
                        className={cn(
                            "w-full flex items-center justify-between px-5 py-4 rounded-3xl text-sm font-black transition-all mb-2",
                            activeList === null
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "text-muted-foreground hover:bg-white hover:shadow-soft border border-transparent"
                        )}
                    >
                        <div className="flex items-center space-x-3">
                            <Users className="w-4 h-4" />
                            <span className="uppercase tracking-tight">Global List</span>
                        </div>
                        <span className={cn(
                            "text-[10px] font-black px-2.5 py-0.5 rounded-full",
                            activeList === null
                                ? "bg-white/20 text-white"
                                : "bg-muted text-muted-foreground"
                        )}>
                            {leads.length}
                        </span>
                    </button>
                </div>

                {/* Tag-based lists */}
                <div className="flex-1 overflow-y-auto p-6 space-y-2">
                    <div className="px-4 py-2">
                        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center space-x-2">
                            <Tag className="w-3 h-3" />
                            <span>Segmented Lists</span>
                        </h3>
                    </div>

                    {uniqueTags.length === 0 ? (
                        <div className="text-center py-12 px-4 opacity-40">
                            <FolderOpen className="w-10 h-10 mx-auto mb-4 border-2 border-dashed border-muted-foreground p-2 rounded-2xl" />
                            <p className="text-xs font-black uppercase tracking-widest">No segments</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {uniqueTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => { setActiveList(tag); setSelectedLeads(new Set()); }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-[13px] font-black transition-all group",
                                        activeList === tag
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                            : "text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-soft border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center space-x-3 min-w-0">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", activeList === tag ? "bg-white" : "bg-primary/40 group-hover:bg-primary")} />
                                        <span className="truncate uppercase tracking-tight">{tag}</span>
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ml-2",
                                        activeList === tag
                                            ? "bg-white/20 text-white"
                                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                    )}>
                                        {tagCounts[tag] || 0}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Main Content ─── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
                {/* Header Section */}
                <div className="p-8 lg:p-10 border-b border-border bg-white/50 backdrop-blur-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
                        <div>
                            <div className="flex items-center space-x-3 mb-2">
                                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Live Database</span>
                                {activeList && <span className="text-muted-foreground">/</span>}
                                {activeList && <span className="bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{activeList}</span>}
                            </div>
                            <h2 className="text-4xl font-black text-foreground uppercase tracking-tight italic leading-none">
                                {activeList ? activeList : 'Global Prospects'}
                            </h2>
                        </div>

                        <div className="flex items-center space-x-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv"
                                className="hidden"
                            />
                            <button
                                onClick={() => setShowManualModal(true)}
                                className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100 px-6 py-3 rounded-2xl font-black text-indigo-600 hover:bg-indigo-100 transition-all shadow-soft text-[10px] uppercase tracking-widest"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Lead</span>
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center space-x-2 bg-white border border-border px-6 py-3 rounded-2xl font-black text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-soft text-[10px] uppercase tracking-widest"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                <span>Import Data</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>

                            {selectedLeads.size > 0 ? (
                                <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="flex items-center space-x-3 bg-primary text-primary-foreground px-8 py-3.5 rounded-2xl font-black hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 text-[10px] uppercase tracking-[0.1em] animate-in fade-in slide-in-from-right-4 group"
                                >
                                    <Layers className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                    <span>Sync {selectedLeads.size} Units</span>
                                </button>
                            ) : (
                                leads.length === 0 && !loading && (
                                    <button
                                        onClick={generateDemo}
                                        disabled={actionLoading}
                                        className="flex items-center space-x-3 bg-slate-100 text-slate-900 border border-slate-200 px-8 py-3 rounded-2xl font-black hover:bg-slate-200 transition-all shadow-soft text-[10px] uppercase tracking-widest"
                                    >
                                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                        <span>Bootstrap Demo</span>
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {/* Search & Global Controls */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Universal identifier search (Name, Company, LinkedIn...)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-14 pr-6 py-4.5 border border-border bg-muted/20 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all font-bold text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Main Table Interface */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Control Bar */}
                    <div className="px-8 py-4 border-b border-border bg-muted/10 flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                            {FILTER_PILLS.map((fp) => {
                                const isActive = !!filters[fp.key];
                                return (
                                    <div key={fp.key} className="relative filter-dropdown-container">
                                        <button
                                            onClick={() => setActiveFilter(activeFilter === fp.key ? null : fp.key)}
                                            className={cn(
                                                "px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all flex items-center space-x-2",
                                                isActive
                                                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10"
                                                    : "bg-white text-muted-foreground border-border hover:border-primary/40"
                                            )}
                                        >
                                            <span>{fp.label}</span>
                                            {isActive && (
                                                <span className="bg-white/20 px-2 py-0.5 rounded-full ml-1">
                                                    {filterDisplayValue(fp.key, filters[fp.key])}
                                                </span>
                                            )}
                                            {!isActive && <ChevronDown className="w-3 h-3 opacity-50" />}
                                        </button>

                                        {activeFilter === fp.key && (
                                            <div className="absolute top-full left-0 mt-2 bg-background border border-border rounded-[2rem] shadow-2xl z-50 p-3 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
                                                {fp.key === 'status' && STATUS_OPTIONS.map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => setFilter('status', s)}
                                                        className={cn(
                                                            "w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1",
                                                            filters.status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                                        )}
                                                    >
                                                        {s.replace('_', ' ')}
                                                    </button>
                                                ))}
                                                {fp.key === 'gender' && GENDER_OPTIONS.map(g => (
                                                    <button key={g} onClick={() => setFilter('gender', g)} className={cn("w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.gender === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                        {g}
                                                    </button>
                                                ))}
                                                {fp.key === 'hasEmail' && ['yes', 'no'].map(v => (
                                                    <button key={v} onClick={() => setFilter('hasEmail', v)} className={cn("w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.hasEmail === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                        {v === 'yes' ? 'Verified Email' : 'No Email'}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {Object.keys(filters).length > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 rounded-full text-[9px] font-black text-red-500 hover:bg-red-50 transition-colors uppercase tracking-[0.15em] flex items-center space-x-2"
                                >
                                    <X className="w-3 h-3" />
                                    <span>Reset Global Filters</span>
                                </button>
                            )}
                        </div>

                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50 px-4">
                            Matching {filteredLeads.length} Identified Units
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="flex-1 overflow-x-auto scrollbar-hide">
                        <table className="w-full text-left min-w-[1000px]">
                            <thead className="sticky top-0 bg-white/10 backdrop-blur-md text-[9px] font-black border-b border-border text-muted-foreground uppercase tracking-[0.2em] z-20">
                                <tr>
                                    <th className="px-10 py-6 w-12">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="rounded-lg border-2 border-border text-primary focus:ring-primary w-5 h-5 transition-all cursor-pointer"
                                                checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                                                onChange={toggleSelectAll}
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-6">Identity</th>
                                    <th className="px-6 py-6">Organization</th>
                                    <th className="px-6 py-6">E-Mail</th>
                                    <th className="px-6 py-6">Status</th>
                                    <th className="px-6 py-6">In Campaign</th>
                                    <th className="px-6 py-6">Segments</th>
                                    <th className="px-10 py-6 text-right">Nexus</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-32 text-center">
                                            <div className="max-w-md mx-auto space-y-6 opacity-40">
                                                <div className="w-24 h-24 bg-muted rounded-[3rem] flex items-center justify-center mx-auto border-4 border-dashed border-muted-foreground/20">
                                                    <Search className="w-10 h-10" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Zero Collision Detected</h3>
                                                    <p className="text-sm font-bold mt-1 text-muted-foreground uppercase tracking-widest leading-relaxed">Adjust your scanning parameters or import new prospects to populating the ecosystem.</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLeads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        className={cn(
                                            "hover:bg-muted/30 transition-all cursor-pointer group",
                                            selectedLeads.has(lead.id) && "bg-primary/5"
                                        )}
                                        onClick={() => toggleSelectLead(lead.id)}
                                    >
                                        <td className="px-10 py-7" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded-lg border-2 border-border text-primary focus:ring-primary w-5 h-5 transition-all cursor-pointer"
                                                    checked={selectedLeads.has(lead.id)}
                                                    onChange={() => toggleSelectLead(lead.id)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-7">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-12 h-12 rounded-[1.25rem] bg-muted flex items-center justify-center font-black text-primary text-sm shadow-soft border border-border group-hover:scale-105 transition-transform">
                                                    {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">{lead.firstName} {lead.lastName}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate max-w-[200px]">{lead.jobTitle || 'Human Resource'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-7">
                                            <p className="text-xs font-black text-foreground/80 uppercase tracking-tight">{lead.company || '—'}</p>
                                            <div className="flex items-center space-x-2 mt-1 opacity-50">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{lead.country || 'Global'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-7">
                                            {lead.email ? (
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                                                    <span className="text-xs font-bold text-muted-foreground">{lead.email}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] italic">Encrypted</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-7">
                                            <span className={cn(
                                                "text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border shadow-sm",
                                                statusColor(lead.status)
                                            )}>
                                                {lead.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-7">
                                            <div className="flex flex-col gap-1">
                                                {lead.campaignLeads && lead.campaignLeads.length > 0 ? (
                                                    lead.campaignLeads.map((cl, i) => (
                                                        <span key={i} className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-tighter truncate max-w-[120px]" title={cl.campaign.name}>
                                                            {cl.campaign.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[9px] font-bold text-muted-foreground/30 uppercase">Not Assigned</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-7">
                                            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                {lead.tags?.length > 0 ? lead.tags.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[8px] font-black bg-muted text-foreground/60 border border-border px-2 py-0.5 rounded-md uppercase tracking-widest">
                                                        {tag}
                                                    </span>
                                                )) : <span className="text-[9px] text-muted-foreground/30 font-black">UNSEGMENTED</span>}
                                                {lead.tags?.length > 2 && <span className="text-[8px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">+{lead.tags.length - 2}</span>}
                                            </div>
                                        </td>
                                        <td className="px-10 py-7 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                {lead.linkedinUrl && (
                                                    <a
                                                        href={lead.linkedinUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-10 h-10 flex items-center justify-center rounded-[1rem] bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all border border-transparent shadow-soft"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <ArrowUpRight className="w-5 h-5" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={(e) => handleDeleteLead(lead.id, e)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-[1rem] bg-muted/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all group/del shadow-soft"
                                                >
                                                    <Trash2 className="w-4 h-4 group-hover/del:scale-110 transition-transform" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Sync Modal Component Integration (simplified logic here) */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowAssignModal(false)} />
                    <div className="bg-background w-full max-w-lg rounded-[3.5rem] shadow-2xl border border-white/20 p-12 relative z-[120] animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                                <Layers className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-3xl font-black text-foreground uppercase tracking-tight italic">Initiate Sync</h3>
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-2">{selectedLeads.size} identified units ready for deployment.</p>
                        </div>

                        <div className="space-y-3 mb-10 max-h-[300px] overflow-y-auto scrollbar-hide">
                            {campaigns.map(campaign => (
                                <button
                                    key={campaign.id}
                                    onClick={() => assignToCampaign(campaign.id)}
                                    className="w-full flex items-center justify-between p-6 bg-muted/20 border-2 border-transparent hover:border-primary/30 hover:bg-white rounded-[2rem] transition-all group"
                                >
                                    <div className="text-left">
                                        <p className="font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors leading-none">{campaign.name}</p>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2 block opacity-50 italic">{campaign.status} ENGINE</span>
                                    </div>
                                    <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowAssignModal(false)}
                            className="w-full py-5 rounded-[2rem] bg-foreground text-background font-black uppercase text-xs tracking-[0.2em] hover:bg-foreground/90 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                        >
                            Abort Sync Protocol
                        </button>
                    </div>
                </div>
            )}

            {/* Manual Add Modal */}
            {showManualModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowManualModal(false)} />
                    <form
                        onSubmit={handleManualLeadSubmit}
                        className="bg-background w-full max-w-2xl rounded-[3.5rem] shadow-2xl border border-white/20 p-12 relative z-[120] animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 overflow-y-auto max-h-[90vh]"
                    >
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-foreground uppercase tracking-tight italic">Manual Identification</h3>
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-2 px-1">Register a new prospect manually into ecosystem.</p>
                            </div>
                            <button type="button" onClick={() => setShowManualModal(false)} className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-10">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">First Name</label>
                                <input
                                    required
                                    type="text"
                                    value={manualLeadData.firstName}
                                    onChange={e => setManualLeadData({ ...manualLeadData, firstName: e.target.value })}
                                    className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Last Name</label>
                                <input
                                    required
                                    type="text"
                                    value={manualLeadData.lastName}
                                    onChange={e => setManualLeadData({ ...manualLeadData, lastName: e.target.value })}
                                    className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">LinkedIn URL (Target Link)</label>
                                <input
                                    required
                                    type="url"
                                    value={manualLeadData.linkedinUrl}
                                    onChange={e => setManualLeadData({ ...manualLeadData, linkedinUrl: e.target.value })}
                                    placeholder="https://www.linkedin.com/in/username"
                                    className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Job Title</label>
                                <input
                                    type="text"
                                    value={manualLeadData.jobTitle}
                                    onChange={e => setManualLeadData({ ...manualLeadData, jobTitle: e.target.value })}
                                    className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Company</label>
                                <input
                                    type="text"
                                    value={manualLeadData.company}
                                    onChange={e => setManualLeadData({ ...manualLeadData, company: e.target.value })}
                                    className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Tags (comma separated)</label>
                                <input
                                    type="text"
                                    value={manualLeadData.tags}
                                    onChange={e => setManualLeadData({ ...manualLeadData, tags: e.target.value })}
                                    placeholder="hot-lead, saas, enterprise"
                                    className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={actionLoading}
                            className="w-full py-5 rounded-[2rem] bg-primary text-primary-foreground font-black uppercase text-xs tracking-[0.2em] hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center space-x-3 active:scale-95"
                        >
                            {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                            <span>Complete Identification</span>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
