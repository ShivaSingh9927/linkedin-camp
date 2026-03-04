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
            await api.post(`/campaigns/${campaignId}/start`, {
                leadIds: Array.from(selectedLeads)
            });
            alert(`Success! ${selectedLeads.size} leads assigned to campaign.`);
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
            case 'CONNECTED': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'INVITE_PENDING': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'REPLIED': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'BOUNCED': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    const filterDisplayValue = (key: string, value: string) => {
        if (key === 'hasEmail') return value === 'yes' ? 'Has email' : 'No email';
        if (key === 'gender') return value.charAt(0).toUpperCase() + value.slice(1);
        if (key === 'status') return value.replace('_', ' ');
        return value;
    };

    return (
        <div className="flex h-full animate-in fade-in duration-500">
            {/* ─── Left Sidebar: Lists ─── */}
            <div className="w-64 flex-shrink-0 border-r bg-slate-50/50 flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        Prospect Lists
                    </h3>

                    {/* All Prospects */}
                    <button
                        onClick={() => { setActiveList(null); setSelectedLeads(new Set()); }}
                        className={cn(
                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-1",
                            activeList === null
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
                                : "text-slate-600 hover:bg-white hover:shadow-sm border border-transparent"
                        )}
                    >
                        <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4" />
                            <span>All Prospects</span>
                        </div>
                        <span className={cn(
                            "text-[10px] font-black px-2 py-0.5 rounded-full",
                            activeList === null
                                ? "bg-indigo-100 text-indigo-600"
                                : "bg-slate-200 text-slate-500"
                        )}>
                            {leads.length}
                        </span>
                    </button>
                </div>

                {/* Tag-based lists */}
                <div className="flex-1 overflow-y-auto p-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center space-x-1">
                        <Tag className="w-3 h-3" />
                        <span>Lists (by tag)</span>
                    </h3>

                    {uniqueTags.length === 0 ? (
                        <div className="text-center py-8">
                            <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-400 font-medium">No lists yet</p>
                            <p className="text-[10px] text-slate-300 mt-1">Import leads with tags to create lists</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {uniqueTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => { setActiveList(tag); setSelectedLeads(new Set()); }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                                        activeList === tag
                                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
                                            : "text-slate-600 hover:bg-white hover:shadow-sm border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center space-x-2 min-w-0">
                                        <List className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="truncate">{tag}</span>
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ml-2",
                                        activeList === tag
                                            ? "bg-indigo-100 text-indigo-600"
                                            : "bg-slate-200 text-slate-500"
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
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">
                                {activeList ? activeList : 'All Prospects'}
                            </h2>
                            <p className="text-slate-500 font-medium">
                                {activeList
                                    ? `Prospects tagged with "${activeList}"`
                                    : 'Manage your LinkedIn contacts and prospects.'}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center space-x-2 bg-white border border-slate-200 px-4 py-2 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm text-sm"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-indigo-500" />}
                                <span>Import</span>
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                            </button>
                            {leads.length === 0 && !loading && (
                                <button
                                    onClick={generateDemo}
                                    disabled={actionLoading}
                                    className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-colors shadow-sm text-sm"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    <span>Demo Data</span>
                                </button>
                            )}
                            {selectedLeads.size > 0 && (
                                <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="flex items-center space-x-2 bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-sm animate-in fade-in slide-in-from-right-4"
                                >
                                    <Layers className="w-4 h-4" />
                                    <span>Add {selectedLeads.size} to Campaign</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search & Filters */}
                    <div className="space-y-3">
                        <div className="flex space-x-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, company, title..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 border rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm"
                                />
                            </div>
                        </div>

                        {/* Filter Pills */}
                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                            {FILTER_PILLS.map((fp) => {
                                const isActive = !!filters[fp.key];
                                return (
                                    <div key={fp.key} className="relative filter-dropdown-container">
                                        <button
                                            onClick={() => setActiveFilter(activeFilter === fp.key ? null : fp.key)}
                                            className={cn(
                                                "px-3 py-2 rounded-full border text-xs font-bold transition-all flex items-center space-x-1",
                                                isActive
                                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                    : "text-slate-500 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            <span>{fp.label}</span>
                                            {isActive && (
                                                <>
                                                    <span className="text-indigo-400">:</span>
                                                    <span className="text-indigo-700">{filterDisplayValue(fp.key, filters[fp.key])}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeFilter(fp.key);
                                                        }}
                                                        className="ml-1 p-0.5 rounded-full hover:bg-indigo-200 transition-colors"
                                                        title={`Remove ${fp.label} filter`}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </>
                                            )}
                                            {!isActive && <ChevronDown className="w-3 h-3" />}
                                        </button>

                                        {activeFilter === fp.key && (
                                            <div className="absolute top-full left-0 mt-1 bg-white border rounded-2xl shadow-xl z-30 p-2 min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-150 max-h-[300px] overflow-y-auto">
                                                {fp.key === 'status' && STATUS_OPTIONS.map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => setFilter('status', s)}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors",
                                                            filters.status === s
                                                                ? "bg-indigo-50 text-indigo-700"
                                                                : "text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "inline-block w-2 h-2 rounded-full mr-2",
                                                            s === 'CONNECTED' ? 'bg-emerald-500' :
                                                                s === 'INVITE_PENDING' ? 'bg-amber-500' :
                                                                    s === 'REPLIED' ? 'bg-blue-500' :
                                                                        s === 'BOUNCED' ? 'bg-red-500' :
                                                                            'bg-slate-400'
                                                        )} />
                                                        {s.replace('_', ' ')}
                                                    </button>
                                                ))}

                                                {fp.key === 'gender' && GENDER_OPTIONS.map(g => (
                                                    <button
                                                        key={g}
                                                        onClick={() => setFilter('gender', g)}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors",
                                                            filters.gender === g
                                                                ? "bg-indigo-50 text-indigo-700"
                                                                : "text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        {g === 'male' ? '♂ Male' : '♀ Female'}
                                                    </button>
                                                ))}

                                                {fp.key === 'hasEmail' && ['yes', 'no'].map(v => (
                                                    <button
                                                        key={v}
                                                        onClick={() => setFilter('hasEmail', v)}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors",
                                                            filters.hasEmail === v
                                                                ? "bg-indigo-50 text-indigo-700"
                                                                : "text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        {v === 'yes' ? '✉️ Has email' : '📭 No email'}
                                                    </button>
                                                ))}

                                                {fp.key === 'country' && (
                                                    uniqueCountries.length > 0
                                                        ? uniqueCountries.map(c => (
                                                            <button
                                                                key={c}
                                                                onClick={() => setFilter('country', c!)}
                                                                className={cn(
                                                                    "w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors",
                                                                    filters.country === c
                                                                        ? "bg-indigo-50 text-indigo-700"
                                                                        : "text-slate-600 hover:bg-slate-50"
                                                                )}
                                                            >
                                                                🌍 {c}
                                                            </button>
                                                        ))
                                                        : <p className="px-3 py-2 text-xs text-slate-400 italic">No countries set</p>
                                                )}

                                                {fp.key === 'tags' && (
                                                    uniqueTags.length > 0
                                                        ? uniqueTags.map(t => (
                                                            <button
                                                                key={t}
                                                                onClick={() => setFilter('tags', t)}
                                                                className={cn(
                                                                    "w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors",
                                                                    filters.tags === t
                                                                        ? "bg-indigo-50 text-indigo-700"
                                                                        : "text-slate-600 hover:bg-slate-50"
                                                                )}
                                                            >
                                                                🏷️ {t}
                                                            </button>
                                                        ))
                                                        : <p className="px-3 py-2 text-xs text-slate-400 italic">No tags assigned</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {Object.keys(filters).length > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="px-3 py-2 rounded-full text-xs font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center space-x-1"
                                >
                                    <X className="w-3 h-3" />
                                    <span>Clear all</span>
                                </button>
                            )}

                            <span className="text-xs text-slate-400 font-bold ml-auto">
                                {filteredLeads.length} prospect{filteredLeads.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white border rounded-3xl shadow-sm overflow-x-auto border-slate-200">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead className="bg-slate-50/80 text-[10px] font-bold border-b text-slate-500 uppercase tracking-widest">
                                <tr>
                                    <th className="px-4 py-4 w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                            checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-4 py-4">Name</th>
                                    <th className="px-4 py-4">Company</th>
                                    <th className="px-4 py-4">Email</th>
                                    <th className="px-4 py-4">Status</th>
                                    <th className="px-4 py-4">Tags</th>
                                    <th className="px-4 py-4">Country</th>
                                    <th className="px-4 py-4">Gender</th>
                                    <th className="px-4 py-4">Import Date</th>
                                    <th className="px-4 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-slate-700">
                                {loading ? (
                                    <tr><td colSpan={10} className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></td></tr>
                                ) : filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="p-20 text-center space-y-4">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Linkedin className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <p className="text-slate-500 font-bold">
                                                {Object.keys(filters).length > 0 || searchQuery || activeList
                                                    ? 'No prospects match your filters.'
                                                    : 'No signs of life detected.'}
                                            </p>
                                            <p className="text-sm text-slate-400 max-w-xs mx-auto">
                                                {Object.keys(filters).length > 0
                                                    ? 'Try adjusting your filters or clear them.'
                                                    : activeList
                                                        ? `No prospects tagged with "${activeList}" yet.`
                                                        : 'Your mission: Import prospects.'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : filteredLeads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        className={cn(
                                            "hover:bg-slate-50 transition-colors cursor-pointer group text-sm",
                                            selectedLeads.has(lead.id) && "bg-indigo-50/50"
                                        )}
                                        onClick={() => toggleSelectLead(lead.id)}
                                    >
                                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                                checked={selectedLeads.has(lead.id)}
                                                onChange={() => toggleSelectLead(lead.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="font-bold text-slate-900">{lead.firstName} {lead.lastName}</span>
                                            {lead.jobTitle && <p className="text-xs text-slate-400 mt-0.5">{lead.jobTitle}</p>}
                                        </td>
                                        <td className="px-4 py-4 text-slate-600">{lead.company || '—'}</td>
                                        <td className="px-4 py-4">
                                            {lead.email ? (
                                                <span className="text-xs text-slate-600">{lead.email}</span>
                                            ) : (
                                                <span className="text-xs text-slate-300 italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={cn(
                                                "text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter shadow-sm border",
                                                statusColor(lead.status)
                                            )}>
                                                {lead.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {lead.tags?.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {lead.tags.map(tag => (
                                                        <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : <span className="text-xs text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-4 text-xs text-slate-600">{lead.country || '—'}</td>
                                        <td className="px-4 py-4 text-xs text-slate-600">
                                            {lead.gender ? (
                                                <span className="flex items-center space-x-1">
                                                    <span>{lead.gender.toLowerCase() === 'female' ? '♀' : lead.gender.toLowerCase() === 'male' ? '♂' : ''}</span>
                                                    <span>{lead.gender.charAt(0).toUpperCase() + lead.gender.slice(1).toLowerCase()}</span>
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-4 text-xs text-slate-400">
                                            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {lead.linkedinUrl && (
                                                    <a
                                                        href={lead.linkedinUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Linkedin className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={(e) => handleDeleteLead(lead.id, e)}
                                                    className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* ─── Assign to Campaign Modal ─── */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 border animate-in zoom-in-95 duration-200">
                        <div className="mb-8">
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Add to Campaign</h3>
                            <p className="text-sm text-slate-500 font-medium">
                                Select target campaign for <span className="text-indigo-600 font-bold">{selectedLeads.size}</span> prospects
                                {activeList && (
                                    <span className="text-indigo-500"> from list &quot;{activeList}&quot;</span>
                                )}
                                .
                            </p>
                        </div>

                        <div className="space-y-3 max-h-[350px] overflow-y-auto mb-8 pr-2">
                            {campaigns.length === 0 ? (
                                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border-2 border-dashed">
                                    <p className="text-slate-500 font-bold italic mb-2">No campaigns found.</p>
                                    <Link href="/campaigns" className="text-indigo-600 font-bold hover:underline">Create your first campaign →</Link>
                                </div>
                            ) : campaigns.map(campaign => (
                                <button
                                    key={campaign.id}
                                    onClick={() => assignToCampaign(campaign.id)}
                                    className="w-full flex items-center justify-between p-5 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-indigo-600/20 transition-all text-left group"
                                >
                                    <div>
                                        <p className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-sm">{campaign.name}</p>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{campaign.status}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowAssignModal(false)}
                            className="w-full py-4 rounded-2xl bg-slate-100 font-black text-slate-600 hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest"
                        >
                            Nevermind
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
