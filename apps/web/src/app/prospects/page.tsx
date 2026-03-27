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
    Database,
    Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ProspectTagPicker from '@/components/ProspectTagPicker';

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
    { key: 'campaignId', label: 'Campaign', icon: '🚀' },
    { key: 'tags', label: 'Segments', icon: '🏷️' },
    { key: 'botAction', label: 'Bot Activity', icon: '🤖' },
    { key: 'gender', label: 'Gender', icon: '👤' },
    { key: 'hasEmail', label: 'Email', icon: '✉️' },
    { key: 'country', label: 'Country', icon: '🌍' },
];

interface SmartList {
    id: string;
    name: string;
    filters: Record<string, string>;
}

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
    const [showBulkTagModal, setShowBulkTagModal] = useState(false);
    const [bulkTagInput, setBulkTagInput] = useState('');
    const [selectedLead, setSelectedLead] = useState<any>(null);
    const [smartLists, setSmartLists] = useState<SmartList[]>([]);
    const [showSaveSmartListModal, setShowSaveSmartListModal] = useState(false);
    const [smartListName, setSmartListName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const searchParams = useSearchParams();
    const initialCompany = searchParams.get('company');

    // Sidebar: list-based navigation
    const [activeList, setActiveList] = useState<string | null>(null); // null = "All Prospects"

    // Filters
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchLeads();
        fetchCampaigns();
        fetchSmartLists();
        
        if (initialCompany) {
            setSearchQuery(initialCompany);
        }
    }, [initialCompany]);

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

    const fetchSmartLists = async () => {
        try {
            const response = await api.get('/smart-lists');
            setSmartLists(response.data);
        } catch (error) {
            console.error('Failed to fetch smart lists:', error);
        }
    };

    const handleSaveSmartList = async () => {
        if (!smartListName.trim()) return;
        setActionLoading(true);
        try {
            const response = await api.post('/smart-lists', {
                name: smartListName,
                filters
            });
            setSmartLists([response.data, ...smartLists]);
            setShowSaveSmartListModal(false);
            setSmartListName('');
            alert('Smart List saved!');
        } catch (error) {
            console.error('Failed to save smart list:', error);
            alert('Failed to save smart list.');
        } finally {
            setActionLoading(false);
        }
    };

    const deleteSmartList = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this smart list?')) return;
        try {
            await api.delete(`/smart-lists/${id}`);
            setSmartLists(smartLists.filter(l => l.id !== id));
        } catch (error) {
            console.error('Failed to delete smart list:', error);
        }
    };

    const handleManualLeadSubmit = async (e: React.FormEvent) => {
        // ... (existing submit logic)
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

    const handleBulkTag = async () => {
        const trimmed = bulkTagInput.trim();
        if (!trimmed) return;
        
        setActionLoading(true);
        try {
            await api.post('/leads/bulk-tags', {
                leadIds: Array.from(selectedLeads),
                tags: [trimmed],
                operation: 'ADD'
            });
            
            // Optimistic Update: Update tags for all selected leads in state
            setLeads(prev => prev.map(l => {
                if (selectedLeads.has(l.id)) {
                    if (!l.tags.includes(trimmed)) {
                        return { ...l, tags: [...l.tags, trimmed] };
                    }
                }
                return l;
            }));
            
            setShowBulkTagModal(false);
            setBulkTagInput('');
            setSelectedLeads(new Set());
            alert(`Tag "${trimmed}" applied to ${selectedLeads.size} leads!`);
        } catch (error) {
            console.error('Bulk tag failed:', error);
            alert('Failed to apply bulk tag.');
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

    const handleEnrich = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setActionLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads/${id}/enrich`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                toast.success('Enrichment queued! Results will update momentarily.');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Enrichment trigger failed');
            }
        } catch (error) {
            toast.error('Network error triggering enrichment');
        } finally {
            setActionLoading(false);
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
        // Campaign Membership
        if (filters.campaignId && !lead.campaignLeads?.some(cl => (cl.campaign as any).id === filters.campaignId)) return false;
        // Gender (case-insensitive comparison)
        if (filters.gender && lead.gender?.toLowerCase() !== filters.gender.toLowerCase()) return false;
        // Tags filter (additional tag filter on top of sidebar list)
        if (filters.tags && !(lead.tags || []).includes(filters.tags)) return false;
        // Bot Action
        if (filters.botAction && !(lead.tags || []).includes(`bot:${filters.botAction}`)) return false;
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
        if (key === 'campaignId') return campaigns.find(c => c.id === value)?.name || 'Campaign';
        if (key === 'botAction') return value.replace('_', ' ');
        return value;
    };

    if (loading) return (
        <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] p-8 lg:p-12 animate-in fade-in duration-500">
            <div className="max-w-[1600px] mx-auto space-y-10">
                {/* ─── Ecosystem Navigator (Horizontal Chips) ─── */}
                {smartLists.length > 0 && (
                    <div className="flex items-center space-x-2 overflow-x-auto pb-6 scrollbar-hide">
                        {/* Smart Lists Chips */}
                        {smartLists.map(list => (
                            <button
                                key={list.id}
                                onClick={() => { setFilters(list.filters); setActiveList(null); setSelectedLeads(new Set()); }}
                                className={cn(
                                    "px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all flex items-center space-x-3 whitespace-nowrap border-2 group shadow-soft",
                                    JSON.stringify(filters) === JSON.stringify(list.filters)
                                        ? "bg-primary/10 text-primary border-primary/20 scale-[1.05] z-10"
                                        : "bg-white text-muted-foreground hover:bg-muted border-transparent"
                                )}
                            >
                                <Zap className="w-4 h-4" />
                                <span>{list.name}</span>
                                <Trash2 
                                    className="w-3.5 h-3.5 ml-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" 
                                    onClick={(e) => deleteSmartList(list.id, e)}
                                />
                            </button>
                        ))}
                    </div>
                )}

                {/* ─── Main Interface Container ─── */}
                <div className="bg-white rounded-[4rem] shadow-premium border border-border/40 overflow-hidden flex flex-col min-h-[800px]">
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
                            <button
                                onClick={() => { fetchLeads(); fetchCampaigns(); fetchSmartLists(); toast.success('Ecosystem updated'); }}
                                className="flex items-center space-x-2 bg-white border border-border px-6 py-3 rounded-2xl font-black text-muted-foreground hover:text-primary hover:border-primary/30 transition-all shadow-soft text-[10px] uppercase tracking-widest group"
                            >
                                <Zap className={cn("w-4 h-4", actionLoading && "animate-spin")} />
                                <span>Refresh</span>
                            </button>

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
                                <div className="flex items-center space-x-3 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <button
                                        onClick={() => setShowBulkTagModal(true)}
                                        className="flex items-center space-x-3 bg-indigo-50 border border-indigo-200 text-indigo-700 px-6 py-3.5 rounded-2xl font-black hover:bg-indigo-100 transition-all shadow-soft text-[10px] uppercase tracking-[0.1em] group"
                                    >
                                        <Tag className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        <span>Segment {selectedLeads.size} Units</span>
                                    </button>

                                    <button
                                        onClick={() => setShowAssignModal(true)}
                                        className="flex items-center space-x-3 bg-primary text-primary-foreground px-8 py-3.5 rounded-2xl font-black hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 text-[10px] uppercase tracking-[0.1em] group"
                                    >
                                        <Layers className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                        <span>Sync {selectedLeads.size} Units</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-3 group">
                                    {leads.length === 0 && !loading && (
                                        <button
                                            onClick={generateDemo}
                                            disabled={actionLoading}
                                            className="flex items-center space-x-3 bg-slate-100 text-slate-900 border border-slate-200 px-8 py-3 rounded-2xl font-black hover:bg-slate-200 transition-all shadow-soft text-[10px] uppercase tracking-widest"
                                        >
                                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                            <span>Bootstrap Demo</span>
                                        </button>
                                    )}
                                </div>
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
                                                {fp.key === 'status' && STATUS_OPTIONS.map(s => {
                                                    const count = listFilteredLeads.filter(l => l.status === s).length;
                                                    return (
                                                        <button
                                                            key={s}
                                                            onClick={() => setFilter('status', s)}
                                                            className={cn(
                                                                "w-full flex items-center justify-between text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1",
                                                                filters.status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                                            )}
                                                        >
                                                            <span>{s.replace('_', ' ')}</span>
                                                            <span className="opacity-40">{count}</span>
                                                        </button>
                                                    );
                                                })}
                                                {fp.key === 'campaignId' && campaigns.map(c => {
                                                    const count = listFilteredLeads.filter(l => l.campaignLeads?.some(cl => (cl.campaign as any).id === c.id)).length;
                                                    return (
                                                        <button key={c.id} onClick={() => setFilter('campaignId', c.id)} className={cn("w-full flex items-center justify-between text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.campaignId === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                            <span className="truncate pr-2">{c.name}</span>
                                                            <span className="opacity-40 flex-shrink-0">{count}</span>
                                                        </button>
                                                    );
                                                })}
                                                {fp.key === 'tags' && uniqueTags.filter(t => !t.startsWith('bot:')).map(t => {
                                                    const count = tagCounts[t] || 0;
                                                    return (
                                                        <button key={t} onClick={() => setFilter('tags', t)} className={cn("w-full flex items-center justify-between text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.tags === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                            <span>{t}</span>
                                                            <span className="opacity-40">{count}</span>
                                                        </button>
                                                    );
                                                })}
                                                {fp.key === 'botAction' && ['invite_sent', 'messaged'].map(a => {
                                                    const tag = `bot:${a}`;
                                                    const count = tagCounts[tag] || 0;
                                                    return (
                                                        <button key={a} onClick={() => setFilter('botAction', a)} className={cn("w-full flex items-center justify-between text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.botAction === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                            <span>{a.replace('_', ' ')}</span>
                                                            <span className="opacity-40">{count}</span>
                                                        </button>
                                                    );
                                                })}
                                                {fp.key === 'country' && uniqueCountries.map(c => {
                                                    const count = listFilteredLeads.filter(l => l.country === c).length;
                                                    return (
                                                        <button key={c} onClick={() => setFilter('country', c)} className={cn("w-full flex items-center justify-between text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.country === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                            <span>{c}</span>
                                                            <span className="opacity-40">{count}</span>
                                                        </button>
                                                    );
                                                })}
                                                {fp.key === 'gender' && GENDER_OPTIONS.map(g => (
                                                    <button key={g} onClick={() => setFilter('gender', g)} className={cn("w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.gender === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                        {g}
                                                    </button>
                                                ))}
                                                {fp.key === 'campaignId' && campaigns.map(c => (
                                                    <button key={c.id} onClick={() => setFilter('campaignId', c.id)} className={cn("w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.campaignId === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                        {c.name}
                                                    </button>
                                                ))}
                                                {fp.key === 'tags' && uniqueTags.map(t => (
                                                    <button key={t} onClick={() => setFilter('tags', t)} className={cn("w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.tags === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                        {t}
                                                    </button>
                                                ))}
                                                {fp.key === 'country' && uniqueCountries.map(c => (
                                                    <button key={c} onClick={() => setFilter('country', c)} className={cn("w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all mb-1", filters.country === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                                                        {c}
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
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={clearFilters}
                                        className="px-4 py-2 rounded-full text-[9px] font-black text-red-500 hover:bg-red-50 transition-colors uppercase tracking-[0.15em] flex items-center space-x-2"
                                    >
                                        <X className="w-3 h-3" />
                                        <span>Reset</span>
                                    </button>
                                    <button
                                        onClick={() => setShowSaveSmartListModal(true)}
                                        className="px-4 py-2 rounded-full text-[9px] font-black text-primary bg-primary/5 hover:bg-primary/10 transition-colors uppercase tracking-[0.15em] flex items-center space-x-2 border border-primary/20"
                                    >
                                        <Zap className="w-3 h-3" />
                                        <span>Save as Smart List</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50 px-4">
                            Matching {filteredLeads.length} Identified Units
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="flex-1 overflow-x-auto scrollbar-hide">
                        <table className="w-full text-left min-w-[1400px]">
                            <thead className="sticky top-0 bg-white/10 backdrop-blur-md text-[9px] font-black border-b border-border text-muted-foreground uppercase tracking-[0.2em] z-20">
                                <tr>
                                    <th className="px-6 py-6 w-12">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="rounded-lg border-2 border-border text-primary focus:ring-primary w-5 h-5 transition-all cursor-pointer"
                                                checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                                                onChange={toggleSelectAll}
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-6 min-w-[250px]">Identity</th>
                                    <th className="px-6 py-6 min-w-[200px]">Organization</th>
                                    <th className="px-6 py-6 min-w-[200px]">E-Mail</th>
                                    <th className="px-6 py-6 w-[120px]">Status</th>
                                    <th className="px-6 py-6 min-w-[180px]">In Campaign</th>
                                    <th className="px-6 py-6 min-w-[250px]">Segments</th>
                                    <th className="px-6 py-6 text-right w-[140px]">Nexus</th>
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
                                            selectedLeads.has(lead.id) && "bg-primary/5",
                                            selectedLead?.id === lead.id && "bg-primary/10 border-l-4 border-l-primary"
                                        )}
                                        onClick={() => setSelectedLead(lead)}
                                    >
                                        <td className="px-6 py-7" onClick={(e) => e.stopPropagation()}>
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
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors truncate">{lead.firstName} {lead.lastName}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate max-w-[300px]">{lead.jobTitle || 'Human Resource'}</p>
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
                                                        <span key={i} className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-tighter truncate max-w-[200px]" title={cl.campaign.name}>
                                                            {cl.campaign.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[9px] font-bold text-muted-foreground/30 uppercase">Not Assigned</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-7">
                                            <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                                                {lead.tags?.length > 0 ? lead.tags.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[8px] font-black bg-muted text-foreground/60 border border-border px-2 py-0.5 rounded-md uppercase tracking-widest">
                                                        {tag}
                                                    </span>
                                                )) : <span className="text-[9px] text-muted-foreground/30 font-black">UNSEGMENTED</span>}
                                                {lead.tags?.length > 2 && <span className="text-[8px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">+{lead.tags.length - 2}</span>}
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <ProspectTagPicker
                                                    leadId={lead.id}
                                                    currentTags={lead.tags || []}
                                                    allAvailableTags={uniqueTags}
                                                    onTagsUpdated={(newTags) => {
                                                        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, tags: newTags } : l));
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-7 text-right">
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
                                                    onClick={(e) => handleEnrich(lead.id, e)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-[1rem] bg-indigo-50 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 transition-all border border-indigo-100 shadow-soft group/enrich"
                                                    title="Deep Enrichment Scanning"
                                                >
                                                    <Database className="w-4 h-4 group-hover/enrich:scale-110 transition-transform" />
                                                </button>
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

            {/* MODAL: Save Smart List */}
            {showSaveSmartListModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-background border border-border w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-10 animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 text-primary">
                            <Zap className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-black text-foreground uppercase tracking-tight italic mb-2">Save List</h2>
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-8">Save these filters for instant access</p>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">List Designation</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Connected High Intent"
                                    className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 font-bold"
                                    value={smartListName}
                                    onChange={(e) => setSmartListName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-10">
                            <button
                                onClick={() => setShowSaveSmartListModal(false)}
                                className="flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all border border-border"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveSmartList}
                                disabled={!smartListName.trim() || actionLoading}
                                className="flex-3 py-4 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                {actionLoading ? 'Saving...' : 'Solidify List'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign Sync Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowAssignModal(false)} />
                    <div className="bg-background w-full max-w-lg rounded-[3.5rem] shadow-2xl border border-white/20 p-12 relative z-[120] animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 text-center">
                        <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                            <Layers className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-3xl font-black text-foreground uppercase tracking-tight italic">Initiate Sync</h3>
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-2 mb-10">{selectedLeads.size} identified units ready for deployment.</p>

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
                            className="w-full py-5 rounded-[2rem] bg-foreground text-background font-black uppercase text-xs tracking-[0.2em] hover:bg-foreground/90 transition-all active:scale-95"
                        >
                            Abort Sync
                        </button>
                    </div>
                </div>
            )}

            {/* Bulk Tag Modal */}
            {showBulkTagModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowBulkTagModal(false)} />
                    <div className="bg-background w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-border p-10 relative z-[120] animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-10">
                            <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Tag className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Mass Segmentation</h3>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2 italic">Define segment for {selectedLeads.size} units.</p>
                        </div>

                        <div className="space-y-4 mb-10">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Segment name..."
                                value={bulkTagInput}
                                onChange={(e) => setBulkTagInput(e.target.value)}
                                className="w-full px-6 py-4 border border-border bg-muted/20 rounded-2xl focus:outline-none focus:border-primary/30 transition-all font-black text-sm uppercase"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowBulkTagModal(false)} className="py-4 rounded-2xl bg-muted font-black uppercase text-[10px] tracking-widest">Cancel</button>
                            <button onClick={handleBulkTag} disabled={actionLoading || !bulkTagInput.trim()} className="py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-50">Apply</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Add Modal */}
            {showManualModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl" onClick={() => setShowManualModal(false)} />
                    <form onSubmit={handleManualLeadSubmit} className="bg-background w-full max-w-2xl rounded-[3rem] shadow-2xl border border-border p-12 relative z-[120] animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-foreground uppercase tracking-tight italic">New Intake</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">Manual unit registration.</p>
                            </div>
                            <button type="button" onClick={() => setShowManualModal(false)} className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center hover:text-red-500 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-10">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">First Name</label>
                                <input required type="text" value={manualLeadData.firstName} onChange={e => setManualLeadData({ ...manualLeadData, firstName: e.target.value })} className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:border-primary/30 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Last Name</label>
                                <input required type="text" value={manualLeadData.lastName} onChange={e => setManualLeadData({ ...manualLeadData, lastName: e.target.value })} className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:border-primary/30 outline-none" />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">LinkedIn URL</label>
                                <input required type="url" value={manualLeadData.linkedinUrl} onChange={e => setManualLeadData({ ...manualLeadData, linkedinUrl: e.target.value })} className="w-full bg-muted/30 border border-border rounded-2xl px-5 py-4 font-bold text-sm focus:border-primary/30 outline-none" />
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
            </div>
            {/* LEAD DETAIL DRAWER */}
            {selectedLead && (
                <div 
                    className="fixed inset-0 z-[200] flex justify-end"
                    onClick={() => setSelectedLead(null)}
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" />
                    <div 
                        className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="p-8 border-b border-border bg-gradient-to-br from-slate-50 to-white">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 rounded-[2rem] bg-indigo-500 text-white flex items-center justify-center text-2xl font-black shadow-xl">
                                        {selectedLead.firstName.charAt(0)}{selectedLead.lastName.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic leading-none">{selectedLead.firstName} {selectedLead.lastName}</h2>
                                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-[0.2em] mt-2 italic">{selectedLead.jobTitle || 'Human Resource'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedLead(null)}
                                    className="p-3 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex items-center space-x-6">
                                <a 
                                    href={selectedLead.linkedinUrl} 
                                    target="_blank" 
                                    className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    <Linkedin className="w-4 h-4" />
                                    <span>Sync Profile</span>
                                </a>
                                {selectedLead.email && (
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secured Email</span>
                                        <span className="text-sm font-bold text-slate-700">{selectedLead.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-10 space-y-12 bg-white">
                            {/* Summary / About */}
                            <section className="space-y-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Zap className="w-4 h-4" /></div>
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Strategic Context</h3>
                                </div>
                                <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                                    {selectedLead.aboutInfo ? (
                                        <p className="text-sm font-medium text-slate-600 leading-relaxed italic whitespace-pre-wrap">"{selectedLead.aboutInfo}"</p>
                                    ) : (
                                        <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                                            <FolderOpen className="w-10 h-10" />
                                            <p className="text-[10px] font-black uppercase tracking-widest italic">Contextual data pending deep scan</p>
                                            <button 
                                                onClick={(e) => handleEnrich(selectedLead.id, e)}
                                                className="text-[9px] font-black text-indigo-600 underline"
                                            >Trigger Enrichment</button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Activity Feed */}
                            <section className="space-y-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><ArrowUpRight className="w-4 h-4" /></div>
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Latest Engagement Vector</h3>
                                </div>
                                {selectedLead.latestPost ? (
                                    <div className="group bg-gradient-to-br from-indigo-50 to-white rounded-[2rem] p-8 border border-indigo-100 shadow-sm hover:shadow-md transition-all">
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed line-clamp-4 mb-6">{selectedLead.latestPost}</p>
                                        <a 
                                            href={selectedLead.latestPostUrl} 
                                            target="_blank" 
                                            className="inline-flex items-center space-x-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-1 transition-transform"
                                        >
                                            <span>Full Collision Intelligence</span>
                                            <ChevronRight className="w-3 h-3" />
                                        </a>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center space-y-4 border border-slate-100">
                                        <Mail className="w-10 h-10 text-slate-200" />
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No recent activations detected</p>
                                            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.1em] mt-1">Run visit node to identify social signals</p>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
