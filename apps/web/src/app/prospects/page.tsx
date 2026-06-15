"use client";

import { useState, useEffect, useRef } from 'react';
import {
    Search,
    Linkedin,
    ChevronRight,
    ChevronDown,
    Plus,
    UserPlus,
    Loader2,
    Upload,
    Trash2,
    X,
    Tag,
    List,
    Users,
    Bookmark,
    FolderOpen,
    Rocket,
    ArrowUpRight,
    Database,
    Mail,
    Briefcase,
    SlidersHorizontal,
    ListPlus,
    Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { degreeLabel, timeAgo } from '@/components/LeadEnrichmentDrawer';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ProspectTagPicker from '@/components/ProspectTagPicker';
import {
    Card,
    Badge,
    Button,
    Avatar,
    EmptyState,
    PageHeader,
} from '@/components/ui';

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
    // Enrichment captured by PROFILE_VISIT
    headline?: string | null;
    location?: string | null;
    phone?: string | null;
    aboutInfo?: string | null;
    connectionDegree?: number | null;
    experience?: any;
    education?: any;
    enrichedAt?: string | null;
}

interface Campaign {
    id: string;
    name: string;
    status: string;
}

const STATUS_OPTIONS = ['UNCONNECTED', 'INVITE_PENDING', 'CONNECTED', 'REPLIED', 'BOUNCED'];
const GENDER_OPTIONS = ['male', 'female']; // Lowercase to match data
const DEGREE_OPTIONS = ['1', '2', '3']; // connectionDegree
const IMPORT_DATE_OPTIONS = ['today', '7d', '30d']; // client-side createdAt windows

// Primary pills shown inline; the rest live behind "More".
const PRIMARY_PILLS = [
    { key: 'status', label: 'Status' },
    { key: 'connectionDegree', label: 'Connection' },
    { key: 'campaignId', label: 'Campaign' },
    { key: 'hasEmail', label: 'Has email' },
];
const MORE_PILLS = [
    { key: 'country', label: 'Country' },
    { key: 'gender', label: 'Gender' },
    { key: 'jobTitle', label: 'Job title' },
    { key: 'company', label: 'Company' },
    { key: 'createdWindow', label: 'Import date' },
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
    const [activeList, setActiveList] = useState<string | null>(null); // null = "All prospects"

    // Filters
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [showMoreFilters, setShowMoreFilters] = useState(false);

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

        // Use the file name (without extension) as the list name, so the import
        // lands in its own browsable list in the rail.
        const listName = file.name.replace(/\.[^.]+$/, '').trim();

        const formData = new FormData();
        formData.append('file', file);
        if (listName) formData.append('listName', listName);

        setActionLoading(true);
        try {
            const response = await api.post('/leads/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const d = response.data;
            toast.success(`Imported ${d.importedTotal ?? d.count ?? 0} prospects${listName ? ` into "${listName}"` : ''}${d.duplicatesSkipped ? ` · ${d.duplicatesSkipped} duplicates skipped` : ''}.`);
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
            await api.post(`/leads/${id}/enrich`);
            toast.success('Enrichment queued! Results will update momentarily.');
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || 'Enrichment trigger failed';
            toast.error(errorMsg);
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

    const handleBulkDelete = async () => {
        if (selectedLeads.size === 0) return;
        if (!confirm(`Delete ${selectedLeads.size} prospect(s)?`)) return;
        const ids = Array.from(selectedLeads);
        try {
            await Promise.all(ids.map(id => api.delete(`/leads/${id}`)));
            setLeads(prev => prev.filter(l => !selectedLeads.has(l.id)));
            setSelectedLeads(new Set());
        } catch (error) {
            console.error('Bulk delete failed:', error);
            alert('Failed to delete some prospects.');
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
    // Lists are derived from tags (excluding bot:* tags).
    const uniqueTags = [...new Set(leads.flatMap(l => l.tags || []))].sort();
    const listTags = uniqueTags.filter(t => !t.startsWith('bot:'));
    const uniqueCountries = [...new Set(leads.map(l => l.country).filter(Boolean))].sort();
    const uniqueJobTitles = [...new Set(leads.map(l => l.jobTitle).filter(Boolean))].sort();
    const uniqueCompanies = [...new Set(leads.map(l => l.company).filter(Boolean))].sort();

    // Count leads per tag
    const tagCounts = uniqueTags.reduce((acc, tag) => {
        acc[tag] = leads.filter(l => (l.tags || []).includes(tag)).length;
        return acc;
    }, {} as Record<string, number>);

    // Step 1: Filter by active list (sidebar)
    const listFilteredLeads = activeList
        ? leads.filter(lead => (lead.tags || []).includes(activeList))
        : leads;

    // Helper: import-date window match
    const matchesCreatedWindow = (createdAt: string, window: string) => {
        const created = new Date(createdAt).getTime();
        if (Number.isNaN(created)) return false;
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        if (window === 'today') return now - created < day;
        if (window === '7d') return now - created < 7 * day;
        if (window === '30d') return now - created < 30 * day;
        return true;
    };

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
        // Connection degree
        if (filters.connectionDegree && String(lead.connectionDegree ?? '') !== filters.connectionDegree) return false;
        // Gender (case-insensitive comparison)
        if (filters.gender && lead.gender?.toLowerCase() !== filters.gender.toLowerCase()) return false;
        // Tags filter (additional tag filter on top of sidebar list)
        if (filters.tags && !(lead.tags || []).includes(filters.tags)) return false;
        // Has Email
        if (filters.hasEmail === 'yes' && !lead.email) return false;
        if (filters.hasEmail === 'no' && lead.email) return false;
        // Country
        if (filters.country && lead.country !== filters.country) return false;
        // Job title
        if (filters.jobTitle && lead.jobTitle !== filters.jobTitle) return false;
        // Company
        if (filters.company && lead.company !== filters.company) return false;
        // Import date window
        if (filters.createdWindow && !matchesCreatedWindow(lead.createdAt, filters.createdWindow)) return false;

        return true;
    });

    const statusTone = (status: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' => {
        switch (status) {
            case 'CONNECTED': return 'success';
            case 'INVITE_PENDING': return 'warning';
            case 'REPLIED': return 'info';
            case 'BOUNCED': return 'danger';
            default: return 'neutral';
        }
    };

    const filterDisplayValue = (key: string, value: string) => {
        if (key === 'hasEmail') return value === 'yes' ? 'Has email' : 'No email';
        if (key === 'gender') return value.charAt(0).toUpperCase() + value.slice(1);
        if (key === 'status') return value.replace('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
        if (key === 'campaignId') return campaigns.find(c => c.id === value)?.name || 'Campaign';
        if (key === 'connectionDegree') return `${value}${value === '1' ? 'st' : value === '2' ? 'nd' : 'rd'}`;
        if (key === 'createdWindow') return value === 'today' ? 'Today' : value === '7d' ? 'Last 7 days' : 'Last 30 days';
        return value;
    };

    if (loading) return (
        <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="w-9 h-9 text-brand animate-spin" />
        </div>
    );

    // Render a single filter pill + its dropdown
    const renderPill = (fp: { key: string; label: string }) => {
        const isActive = !!filters[fp.key];
        return (
            <div key={fp.key} className="relative filter-dropdown-container flex-shrink-0">
                <button
                    onClick={() => setActiveFilter(activeFilter === fp.key ? null : fp.key)}
                    className={cn(
                        "px-3 py-2.5 rounded-control border text-[13px] font-semibold transition-all flex items-center gap-1.5",
                        isActive
                            ? "bg-brand text-white border-brand shadow-lift"
                            : "bg-white text-ink-700 border-line hover:border-brand-200"
                    )}
                >
                    {fp.key === 'status' && !isActive && <Circle className="w-3.5 h-3.5 text-blue-500" />}
                    {fp.key === 'campaignId' && !isActive && <Rocket className="w-3.5 h-3.5 text-ink-400" />}
                    {fp.key === 'hasEmail' && !isActive && <Mail className="w-3.5 h-3.5 text-ink-400" />}
                    <span>{fp.label}</span>
                    {isActive ? (
                        <span className="bg-white/20 px-1.5 py-0.5 rounded-chip text-[11px]">
                            {filterDisplayValue(fp.key, filters[fp.key])}
                        </span>
                    ) : (
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    )}
                </button>

                {activeFilter === fp.key && (
                    <div className="absolute top-full left-0 mt-2 bg-white border border-line rounded-card shadow-lift z-50 p-2 min-w-[200px] max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                        {fp.key === 'status' && STATUS_OPTIONS.map(s => {
                            const count = listFilteredLeads.filter(l => l.status === s).length;
                            return (
                                <DropdownOption key={s} active={filters.status === s} onClick={() => setFilter('status', s)} label={s.replace('_', ' ')} count={count} />
                            );
                        })}
                        {fp.key === 'connectionDegree' && DEGREE_OPTIONS.map(d => {
                            const count = listFilteredLeads.filter(l => String(l.connectionDegree ?? '') === d).length;
                            return (
                                <DropdownOption key={d} active={filters.connectionDegree === d} onClick={() => setFilter('connectionDegree', d)} label={degreeLabel(Number(d)) || `${d}`} count={count} />
                            );
                        })}
                        {fp.key === 'campaignId' && campaigns.map(c => {
                            const count = listFilteredLeads.filter(l => l.campaignLeads?.some(cl => (cl.campaign as any).id === c.id)).length;
                            return (
                                <DropdownOption key={c.id} active={filters.campaignId === c.id} onClick={() => setFilter('campaignId', c.id)} label={c.name} count={count} />
                            );
                        })}
                        {fp.key === 'hasEmail' && ['yes', 'no'].map(v => (
                            <DropdownOption key={v} active={filters.hasEmail === v} onClick={() => setFilter('hasEmail', v)} label={v === 'yes' ? 'Has email' : 'No email'} />
                        ))}
                        {fp.key === 'country' && uniqueCountries.map(c => {
                            const count = listFilteredLeads.filter(l => l.country === c).length;
                            return (
                                <DropdownOption key={c} active={filters.country === c} onClick={() => setFilter('country', c)} label={c} count={count} />
                            );
                        })}
                        {fp.key === 'gender' && GENDER_OPTIONS.map(g => (
                            <DropdownOption key={g} active={filters.gender === g} onClick={() => setFilter('gender', g)} label={g.charAt(0).toUpperCase() + g.slice(1)} />
                        ))}
                        {fp.key === 'jobTitle' && uniqueJobTitles.map(t => {
                            const count = listFilteredLeads.filter(l => l.jobTitle === t).length;
                            return (
                                <DropdownOption key={t} active={filters.jobTitle === t} onClick={() => setFilter('jobTitle', t)} label={t} count={count} />
                            );
                        })}
                        {fp.key === 'company' && uniqueCompanies.map(c => {
                            const count = listFilteredLeads.filter(l => l.company === c).length;
                            return (
                                <DropdownOption key={c} active={filters.company === c} onClick={() => setFilter('company', c)} label={c} count={count} />
                            );
                        })}
                        {fp.key === 'createdWindow' && IMPORT_DATE_OPTIONS.map(w => {
                            const count = listFilteredLeads.filter(l => matchesCreatedWindow(l.createdAt, w)).length;
                            return (
                                <DropdownOption key={w} active={filters.createdWindow === w} onClick={() => setFilter('createdWindow', w)} label={filterDisplayValue('createdWindow', w)} count={count} />
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="animate-in fade-in duration-300">
            <div>
                <PageHeader
                    title="Prospects"
                    subtitle={`${leads.length.toLocaleString()} ${leads.length === 1 ? 'person' : 'people'} across ${listTags.length} ${listTags.length === 1 ? 'list' : 'lists'}. Filter, tag, and add them to campaigns.`}
                    actions={
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv"
                                className="hidden"
                            />
                            <Button variant="outline" onClick={() => setShowManualModal(true)}>
                                <UserPlus className="w-4 h-4" />
                                Add manually
                            </Button>
                            <Button onClick={() => fileInputRef.current?.click()} disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                Import list
                            </Button>
                        </>
                    }
                />

                <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-6">
                    {/* ─── LISTS RAIL ─── */}
                    <aside className="space-y-5">
                        <div>
                            <div className="label mb-2 px-1">Lists</div>
                            <div className="space-y-0.5">
                                <button
                                    onClick={() => { setActiveList(null); setSelectedLeads(new Set()); }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-control text-[13px] font-semibold transition-colors",
                                        activeList === null ? "bg-brand text-white" : "text-ink-700 hover:bg-white"
                                    )}
                                >
                                    <span className="flex items-center gap-2"><Users className="w-4 h-4" />All prospects</span>
                                    <span className={activeList === null ? "opacity-80" : "text-ink-400"}>{leads.length}</span>
                                </button>
                                {listTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => { setActiveList(tag); setSelectedLeads(new Set()); }}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 rounded-control text-[13px] font-semibold transition-colors",
                                            activeList === tag ? "bg-brand text-white" : "text-ink-700 hover:bg-white"
                                        )}
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <List className={cn("w-4 h-4 flex-shrink-0", activeList === tag ? "text-white/80" : "text-ink-400")} />
                                            <span className="truncate">{tag}</span>
                                        </span>
                                        <span className={activeList === tag ? "opacity-80" : "text-ink-400"}>{tagCounts[tag]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="label mb-2 px-1 flex items-center justify-between">
                                <span>Saved views</span>
                                <button
                                    onClick={() => setShowSaveSmartListModal(true)}
                                    className="text-ink-400 hover:text-brand transition-colors"
                                    title="Save current filters as a view"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="space-y-0.5">
                                {smartLists.length === 0 ? (
                                    <p className="px-3 py-2 text-[12px] font-medium text-ink-400">No saved views yet.</p>
                                ) : smartLists.map(list => {
                                    const isActive = JSON.stringify(filters) === JSON.stringify(list.filters);
                                    return (
                                        <button
                                            key={list.id}
                                            onClick={() => { setFilters(list.filters); setActiveList(null); setSelectedLeads(new Set()); }}
                                            className={cn(
                                                "group w-full flex items-center justify-between px-3 py-2 rounded-control text-[13px] font-semibold transition-colors",
                                                isActive ? "bg-brand text-white" : "text-ink-700 hover:bg-white"
                                            )}
                                        >
                                            <span className="flex items-center gap-2 min-w-0">
                                                <Bookmark className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white/80" : "text-ink-400")} />
                                                <span className="truncate">{list.name}</span>
                                            </span>
                                            <Trash2
                                                className={cn("w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all", isActive ? "hover:text-red-200" : "hover:text-red-500")}
                                                onClick={(e) => deleteSmartList(list.id, e)}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* ─── MAIN ─── */}
                    <div className="space-y-4">
                        {/* Search + filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-[220px]">
                                <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    placeholder="Search name, company, title…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-line rounded-control pl-9 pr-3 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                            {PRIMARY_PILLS.map(renderPill)}
                            <div className="relative filter-dropdown-container flex-shrink-0">
                                <button
                                    onClick={() => setShowMoreFilters(v => !v)}
                                    className={cn(
                                        "px-3 py-2.5 rounded-control border text-[13px] font-semibold transition-all flex items-center gap-1.5",
                                        showMoreFilters || MORE_PILLS.some(p => filters[p.key])
                                            ? "bg-white text-ink-700 border-brand-200"
                                            : "bg-white text-ink-400 border-line hover:border-brand-200"
                                    )}
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    More
                                </button>
                            </div>
                            {Object.keys(filters).length > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="px-2.5 py-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 rounded-chip transition-colors flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" />
                                    Reset
                                </button>
                            )}
                        </div>

                        {/* Secondary (More) filter pills */}
                        {showMoreFilters && (
                            <div className="flex items-center gap-2 flex-wrap">
                                {MORE_PILLS.map(renderPill)}
                            </div>
                        )}

                        {/* Bulk action bar */}
                        {selectedLeads.size > 0 && (
                            <div className="bg-ink-900 text-white rounded-control px-4 py-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <span className="text-[13px] font-semibold">{selectedLeads.size} selected</span>
                                <div className="w-px h-5 bg-white/20" />
                                <button onClick={() => setShowAssignModal(true)} className="text-[13px] font-semibold flex items-center gap-1.5 hover:text-brand-200 transition-colors">
                                    <Rocket className="w-4 h-4" />Add to campaign
                                </button>
                                <button onClick={() => setShowBulkTagModal(true)} className="text-[13px] font-semibold flex items-center gap-1.5 hover:text-brand-200 transition-colors">
                                    <Tag className="w-4 h-4" />Tag
                                </button>
                                <button onClick={() => setShowBulkTagModal(true)} className="text-[13px] font-semibold flex items-center gap-1.5 hover:text-brand-200 transition-colors">
                                    <ListPlus className="w-4 h-4" />Move to list
                                </button>
                                <button onClick={handleBulkDelete} className="text-[13px] font-semibold flex items-center gap-1.5 hover:text-red-300 transition-colors ml-auto">
                                    <Trash2 className="w-4 h-4" />Delete
                                </button>
                            </div>
                        )}

                        {/* Table */}
                        {filteredLeads.length === 0 ? (
                            <EmptyState
                                icon={Search}
                                title="No prospects match"
                                description={leads.length === 0
                                    ? "You haven't imported any prospects yet. Import a list or add someone manually to get started."
                                    : "Try clearing filters or adjusting your search."}
                                action={leads.length === 0
                                    ? <Button onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" />Import list</Button>
                                    : <Button variant="outline" onClick={() => { clearFilters(); setSearchQuery(''); setActiveList(null); }}>Clear filters</Button>}
                            />
                        ) : (
                            <Card className="overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[13px]">
                                        <thead>
                                            <tr className="border-b border-line">
                                                <th className="w-10 pl-4">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-line text-brand focus:ring-brand/30 w-4 h-4 cursor-pointer"
                                                        checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                                                        onChange={toggleSelectAll}
                                                    />
                                                </th>
                                                <th className="text-left label px-4 py-3">Name</th>
                                                <th className="text-left label px-4 py-3">Title &amp; company</th>
                                                <th className="text-left label px-4 py-3">Status</th>
                                                <th className="text-left label px-4 py-3">Lists</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredLeads.map((lead) => (
                                                <tr
                                                    key={lead.id}
                                                    onClick={() => setSelectedLead(lead)}
                                                    className={cn(
                                                        "border-b border-line last:border-0 hover:bg-brand-50/40 transition-colors cursor-pointer group",
                                                        selectedLeads.has(lead.id) && "bg-brand-50/60",
                                                        selectedLead?.id === lead.id && "bg-brand-50"
                                                    )}
                                                >
                                                    <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-line text-brand focus:ring-brand/30 w-4 h-4 cursor-pointer"
                                                            checked={selectedLeads.has(lead.id)}
                                                            onChange={() => toggleSelectLead(lead.id)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar name={`${lead.firstName} ${lead.lastName}`} size="md" />
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                                    <span className="truncate">{lead.firstName} {lead.lastName}</span>
                                                                    {degreeLabel(lead.connectionDegree) && (
                                                                        <Badge tone="neutral" className="!px-1.5 !py-0.5 !text-[10px]">{degreeLabel(lead.connectionDegree)}</Badge>
                                                                    )}
                                                                    {lead.enrichedAt && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title={`Enriched ${timeAgo(lead.enrichedAt)}`} />
                                                                    )}
                                                                </div>
                                                                {lead.email && (
                                                                    <div className="text-[12px] text-ink-400 truncate max-w-[240px]">{lead.email}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="font-medium text-ink-700 truncate max-w-[260px]">{lead.jobTitle || lead.headline || '—'}</div>
                                                        <div className="text-[12px] text-ink-400 truncate max-w-[260px]">{lead.company || lead.location || lead.country || '—'}</div>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <Badge tone={statusTone(lead.status)}>{lead.status.replace('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex flex-wrap items-center gap-1.5 max-w-[240px]">
                                                            {(lead.tags || []).filter(t => !t.startsWith('bot:')).slice(0, 2).map(tag => (
                                                                <Badge key={tag} tone="neutral">{tag}</Badge>
                                                            ))}
                                                            {(lead.tags || []).filter(t => !t.startsWith('bot:')).length > 2 && (
                                                                <Badge tone="brand">+{(lead.tags || []).filter(t => !t.startsWith('bot:')).length - 2}</Badge>
                                                            )}
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
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex gap-1 justify-end">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSelectedLeads(new Set([lead.id])); setShowAssignModal(true); }}
                                                                className="w-8 h-8 rounded-control bg-surface hover:bg-brand-50 hover:text-brand grid place-items-center text-ink-500 transition-colors"
                                                                title="Add to campaign"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleEnrich(lead.id, e)}
                                                                className="w-8 h-8 rounded-control hover:bg-surface grid place-items-center text-ink-400 transition-colors"
                                                                title="Enrich"
                                                            >
                                                                <Database className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteLead(lead.id, e)}
                                                                className="w-8 h-8 rounded-control hover:bg-red-50 hover:text-red-500 grid place-items-center text-ink-400 transition-colors"
                                                                title="Delete"
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
                            </Card>
                        )}

                        {filteredLeads.length > 0 && (
                            <div className="flex items-center justify-between text-[12px] font-medium text-ink-400 px-1">
                                <span>Showing {filteredLeads.length} of {leads.length}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL: Save Smart List */}
            {showSaveSmartListModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <Card panel className="w-full max-w-md p-8 animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 bg-brand-50 rounded-control grid place-items-center mb-5 text-brand">
                            <Bookmark className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground">Save view</h2>
                        <p className="text-[13px] font-medium text-ink-500 mt-1 mb-6">Save these filters for quick access.</p>

                        <div className="space-y-2">
                            <label className="label">View name</label>
                            <input
                                type="text"
                                placeholder="e.g. Connected high intent"
                                className="w-full bg-white border border-line rounded-control px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30"
                                value={smartListName}
                                onChange={(e) => setSmartListName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-2 mt-7">
                            <Button variant="outline" className="flex-1" onClick={() => setShowSaveSmartListModal(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSaveSmartList} disabled={!smartListName.trim() || actionLoading}>
                                {actionLoading ? 'Saving…' : 'Save view'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Add to campaign modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAssignModal(false)} />
                    <Card panel className="w-full max-w-lg p-8 relative z-[120] animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 bg-brand-50 rounded-control grid place-items-center mb-5 text-brand">
                            <Rocket className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-foreground">Add to campaign</h3>
                        <p className="text-[13px] font-medium text-ink-500 mt-1 mb-6">{selectedLeads.size} prospect{selectedLeads.size === 1 ? '' : 's'} selected.</p>

                        <div className="space-y-2 mb-6 max-h-[320px] overflow-y-auto">
                            {campaigns.length === 0 ? (
                                <p className="text-[13px] font-medium text-ink-400 py-6 text-center">No active campaigns.</p>
                            ) : campaigns.map(campaign => (
                                <button
                                    key={campaign.id}
                                    onClick={() => assignToCampaign(campaign.id)}
                                    className="w-full flex items-center justify-between p-4 bg-surface border border-transparent hover:border-brand-200 hover:bg-white rounded-control transition-all group text-left"
                                >
                                    <div>
                                        <p className="font-semibold text-foreground group-hover:text-brand transition-colors">{campaign.name}</p>
                                        <Badge tone="neutral" className="mt-1.5">{campaign.status}</Badge>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-ink-400 group-hover:text-brand group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                        </div>

                        <Button variant="outline" className="w-full" onClick={() => setShowAssignModal(false)}>Cancel</Button>
                    </Card>
                </div>
            )}

            {/* Bulk Tag Modal */}
            {showBulkTagModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowBulkTagModal(false)} />
                    <Card panel className="w-full max-w-lg p-8 relative z-[120] animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 bg-brand-50 rounded-control grid place-items-center mb-5 text-brand">
                            <Tag className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-foreground">Tag prospects</h3>
                        <p className="text-[13px] font-medium text-ink-500 mt-1 mb-6">Add a tag to {selectedLeads.size} prospect{selectedLeads.size === 1 ? '' : 's'}. Tags also act as lists.</p>

                        <input
                            autoFocus
                            type="text"
                            placeholder="Tag name…"
                            value={bulkTagInput}
                            onChange={(e) => setBulkTagInput(e.target.value)}
                            className="w-full bg-white border border-line rounded-control px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30 mb-6"
                        />

                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setShowBulkTagModal(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleBulkTag} disabled={actionLoading || !bulkTagInput.trim()}>
                                {actionLoading ? 'Applying…' : 'Apply tag'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Manual Add Modal */}
            {showManualModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowManualModal(false)} />
                    <form onSubmit={handleManualLeadSubmit} className="relative z-[120] w-full max-w-2xl animate-in zoom-in-95 duration-150">
                        <Card panel className="p-8 overflow-y-auto max-h-[90vh]">
                            <div className="flex justify-between items-start mb-7">
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight text-foreground">Add prospect</h3>
                                    <p className="text-[13px] font-medium text-ink-500 mt-1">Add a single prospect manually.</p>
                                </div>
                                <button type="button" onClick={() => setShowManualModal(false)} className="w-9 h-9 rounded-control grid place-items-center text-ink-400 hover:bg-surface hover:text-foreground transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-7">
                                <div className="space-y-1.5">
                                    <label className="label">First name</label>
                                    <input required type="text" value={manualLeadData.firstName} onChange={e => setManualLeadData({ ...manualLeadData, firstName: e.target.value })} className="w-full bg-white border border-line rounded-control px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="label">Last name</label>
                                    <input required type="text" value={manualLeadData.lastName} onChange={e => setManualLeadData({ ...manualLeadData, lastName: e.target.value })} className="w-full bg-white border border-line rounded-control px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30" />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <label className="label">LinkedIn URL</label>
                                    <input required type="url" value={manualLeadData.linkedinUrl} onChange={e => setManualLeadData({ ...manualLeadData, linkedinUrl: e.target.value })} className="w-full bg-white border border-line rounded-control px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="label">Job title</label>
                                    <input type="text" value={manualLeadData.jobTitle} onChange={e => setManualLeadData({ ...manualLeadData, jobTitle: e.target.value })} className="w-full bg-white border border-line rounded-control px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="label">Company</label>
                                    <input type="text" value={manualLeadData.company} onChange={e => setManualLeadData({ ...manualLeadData, company: e.target.value })} className="w-full bg-white border border-line rounded-control px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30" />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <label className="label">Tags (comma separated)</label>
                                    <input type="text" value={manualLeadData.tags} onChange={e => setManualLeadData({ ...manualLeadData, tags: e.target.value })} placeholder="hot-lead, saas, enterprise" className="w-full bg-white border border-line rounded-control px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30" />
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Add prospect
                            </Button>
                        </Card>
                    </form>
                </div>
            )}

            {/* LEAD DETAIL DRAWER */}
            {selectedLead && (
                <div
                    className="fixed inset-0 z-[200] flex justify-end"
                    onClick={() => setSelectedLead(null)}
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
                    <div
                        className="relative w-full max-w-2xl bg-white h-full shadow-lift flex flex-col animate-in slide-in-from-right duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="p-8 border-b border-line bg-surface">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <Avatar name={`${selectedLead.firstName} ${selectedLead.lastName}`} size="lg" />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-2xl font-bold tracking-tight text-foreground leading-none">{selectedLead.firstName} {selectedLead.lastName}</h2>
                                            {degreeLabel(selectedLead.connectionDegree) && (
                                                <Badge tone="info">{degreeLabel(selectedLead.connectionDegree)}</Badge>
                                            )}
                                        </div>
                                        <p className="text-[13px] font-medium text-ink-500 mt-2">{[selectedLead.jobTitle, selectedLead.company].filter(Boolean).join(' · ') || selectedLead.headline || '—'}</p>
                                        {(selectedLead.location || selectedLead.enrichedAt) && (
                                            <p className="text-[12px] font-medium text-ink-400 mt-1 flex items-center gap-2">
                                                {selectedLead.location && <span>{selectedLead.location}</span>}
                                                {selectedLead.enrichedAt && <span className="text-emerald-600">Enriched {timeAgo(selectedLead.enrichedAt)}</span>}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedLead(null)}
                                    className="w-9 h-9 rounded-control grid place-items-center text-ink-400 hover:bg-white hover:text-foreground transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button asChild variant="dark" size="sm">
                                    <a href={selectedLead.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                        <Linkedin className="w-4 h-4" />
                                        View profile
                                    </a>
                                </Button>
                                {selectedLead.email && (
                                    <div className="flex flex-col">
                                        <span className="label">Email</span>
                                        <span className="text-[13px] font-medium text-ink-700">{selectedLead.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white">
                            {/* Summary / About */}
                            <section className="space-y-3">
                                <h3 className="label">About</h3>
                                <Card className="p-6">
                                    {selectedLead.aboutInfo ? (
                                        <p className="text-[13px] font-medium text-ink-700 leading-relaxed whitespace-pre-wrap">{selectedLead.aboutInfo}</p>
                                    ) : (
                                        <div className="py-4 flex flex-col items-center justify-center text-center gap-3 text-ink-400">
                                            <FolderOpen className="w-8 h-8" />
                                            <p className="text-[13px] font-medium">No about info yet.</p>
                                            <button
                                                onClick={(e) => handleEnrich(selectedLead.id, e)}
                                                className="text-[13px] font-semibold text-brand hover:underline"
                                            >Enrich this prospect</button>
                                        </div>
                                    )}
                                </Card>
                            </section>

                            {/* Career history (from PROFILE_VISIT enrichment) */}
                            {(() => {
                                const exp = Array.isArray(selectedLead.experience) ? selectedLead.experience : [];
                                const edu = Array.isArray(selectedLead.education) ? selectedLead.education : [];
                                if (!exp.length && !edu.length) return null;
                                return (
                                    <section className="space-y-3">
                                        <h3 className="label flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" />Career &amp; education</h3>
                                        <Card className="p-6 space-y-4">
                                            {exp.map((e: any, i: number) => (
                                                <div key={`x${i}`} className="border-l-2 border-brand-200 pl-4">
                                                    <p className="text-[13px] font-semibold text-foreground">{e.title || e.jobTitle || '—'}</p>
                                                    <p className="text-[12px] font-medium text-ink-500">{[e.company, e.dateRange || e.duration].filter(Boolean).join(' · ')}</p>
                                                </div>
                                            ))}
                                            {edu.map((e: any, i: number) => (
                                                <div key={`e${i}`} className="border-l-2 border-emerald-200 pl-4">
                                                    <p className="text-[13px] font-semibold text-foreground">{e.school || '—'}</p>
                                                    <p className="text-[12px] font-medium text-ink-500">{[e.degree, e.dateRange || e.dates].filter(Boolean).join(' · ')}</p>
                                                </div>
                                            ))}
                                        </Card>
                                    </section>
                                );
                            })()}

                            {/* Activity */}
                            <section className="space-y-3">
                                <h3 className="label flex items-center gap-2"><ArrowUpRight className="w-3.5 h-3.5" />Recent activity</h3>
                                {selectedLead.latestPost ? (
                                    <Card className="p-6">
                                        <p className="text-[13px] font-medium text-ink-700 leading-relaxed line-clamp-4 mb-4">{selectedLead.latestPost}</p>
                                        <a
                                            href={selectedLead.latestPostUrl}
                                            target="_blank"
                                            className="inline-flex items-center gap-1.5 text-brand font-semibold text-[13px] hover:underline"
                                        >
                                            <span>View post</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </a>
                                    </Card>
                                ) : (
                                    <Card className="p-8 flex flex-col items-center justify-center text-center gap-3 text-ink-400">
                                        <Mail className="w-8 h-8" />
                                        <p className="text-[13px] font-medium">No recent posts found.</p>
                                    </Card>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Reusable dropdown option for filter pills
function DropdownOption({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between text-left px-3 py-2 text-[13px] font-semibold rounded-control transition-colors mb-0.5",
                active ? "bg-brand text-white" : "text-ink-700 hover:bg-surface"
            )}
        >
            <span className="truncate pr-2">{label}</span>
            {count !== undefined && <span className={active ? "opacity-80" : "text-ink-400"}>{count}</span>}
        </button>
    );
}
