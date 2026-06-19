"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Plus,
    MoreVertical,
    Play,
    Pause,
    Clock,
    CheckCircle2,
    Loader2,
    Trash2,
    Info,
    X,
    AlertCircle,
    ChevronDown,
    Linkedin,
    Mail,
    Wrench,
    LayoutTemplate,
    Target,
    User,
    Send,
    ThumbsUp,
    MessageSquare,
    Eye,
    Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { SafetyQuotaBadge } from '@/components/SafetyQuotaBadge';
import { CampaignEta } from '@/components/CampaignEta';
import { CampaignNameModal } from '@/components/CampaignNameModal';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { Card, Badge, Button, EmptyState, Skeleton, PageHeader } from '@/components/ui';
import { FALLBACK_TEMPLATES } from '@/lib/template-data';
import { Layers, ChevronRight, Clock as ClockIcon } from 'lucide-react';

// Humanize a stepSequence subtype into a short chip label.
const SUBTYPE_LABEL: Record<string, string> = {
  PROFILE_VISIT: 'Visit', VISIT: 'Visit', INVITE: 'Invite', CONNECT: 'Connect',
  MESSAGE: 'Message', EMAIL: 'Email', EMAIL_FINDER: 'Find email', WAIT: 'Wait',
  DELAY: 'Wait', LIKE: 'Like', COMMENT: 'Comment', FOLLOW: 'Follow',
};
const stepLabel = (s: string) => SUBTYPE_LABEL[s] || s.replace(/_/g, ' ');

// Control-flow / plumbing nodes carry no meaning on a card — they just made the
// old chip row read "Visit › Wait › CHECK CONNECTION › IF ELSE". Drop them so
// the mini-flow shows only the actions a user actually cares about.
const STEP_CHIP_HIDDEN = new Set(['START', 'END', 'CHECK_CONNECTION', 'IF_ELSE', 'CONDITION']);

// Color a flow chip by the channel/action it represents, so the sequence reads
// as a flow at a glance: connect = brand, message = blue, email = green,
// waits recede, everything else stays neutral.
const stepChipTone = (s: string): string => {
  if (s === 'CONNECT' || s === 'INVITE') return 'bg-brand-50 text-brand';
  if (s === 'MESSAGE') return 'bg-blue-50 text-blue-600';
  if (s === 'EMAIL' || s === 'EMAIL_FINDER') return 'bg-emerald-50 text-emerald-600';
  if (s === 'WAIT' || s === 'DELAY') return 'bg-surface text-ink-400';
  return 'bg-surface text-ink-500';
};

const CATEGORY_META: Record<string, { label: string; icon: any; tone: 'info' | 'brand' | 'success' }> = {
  linkedin: { label: 'LinkedIn', icon: Linkedin, tone: 'info' },
  'multi-channel': { label: 'Multi-channel', icon: Layers, tone: 'brand' },
  email: { label: 'Email', icon: Mail, tone: 'success' },
};

// Template group tabs (matches the /templates grouping).
const GROUP_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'my-network', label: 'My Network' },
  { key: 'out-of-network', label: 'Out of Network' },
  { key: 'objective-based', label: 'Objective-Based' },
];

interface CampaignActivity {
    campaignId: string;
    leadId: string;
    leadName: string;
    node: string;
    action: 'executing' | 'success' | 'failed';
    details: Record<string, any>;
    error?: string;
    timestamp: string;
}

const nodeIcons: Record<string, any> = {
    'warmup': Eye,
    'profile-visit': User,
    'connect': User,
    'like-nth-post': ThumbsUp,
    'comment-nth-post': MessageSquare,
    'send-message': Send,
    'delay': Clock,
};

const nodeLabels: Record<string, string> = {
    'warmup': 'Warmup',
    'profile-visit': 'Profile Visit',
    'connect': 'Connect',
    'like-nth-post': 'Like Post',
    'comment-nth-post': 'Comment',
    'send-message': 'Send Message',
    'delay': 'Delay',
};

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusPanel, setStatusPanel] = useState<{ campaignId: string; data: any } | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [view, setView] = useState<'mine' | 'templates'>('mine');
    const [tplGroup, setTplGroup] = useState<string>('all');
    const [templates, setTemplates] = useState<any[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [pendingTemplate, setPendingTemplate] = useState<any | null>(null);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const createMenuRef = useRef<HTMLDivElement>(null);
    const [pendingCreate, setPendingCreate] = useState<{ defaultName: string; workflowJson: any; aiDetails?: { objective: string; description: string; cta: string; toneOverride: string; } } | null>(null);
    const [activities, setActivities] = useState<CampaignActivity[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [strategyData, setStrategyData] = useState<any>(null);
    const [strategyLoading, setStrategyLoading] = useState(false);
    const [aiGuidance, setAiGuidance] = useState<{
        objective: string;
        description: string;
        cta: string;
        toneOverride: string;
    } | null>(null);
    const router = useRouter();
    // Set when the user arrived from a company card ("Launch campaign"). Carried
    // through create → builder so the builder pre-selects that company's leads.
    const [targetCompany, setTargetCompany] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const company = params.get('company');
        if (company) {
            setTargetCompany(company);
            if (params.get('create') === '1') setShowCreateMenu(true);
        }
    }, []);

    // Append the target company so the builder can pre-filter the launch modal.
    const builderHref = (campaignId: string) =>
        `/campaigns/${campaignId}/builder${targetCompany ? `?company=${encodeURIComponent(targetCompany)}` : ''}`;

    useEffect(() => {
        fetchCampaigns();
        fetchUserStrategy();
        api.get('/templates')
            .then((res) => setTemplates(res.data.templates || []))
            .catch((err) => {
                console.error('Failed to load templates from API, using fallback:', err);
                setTemplates(FALLBACK_TEMPLATES);
            })
            .finally(() => setTemplatesLoading(false));
    }, []);

    const fetchUserStrategy = async () => {
        setStrategyLoading(true);
        try {
            const userContext = await api.get('/strategy/user-context');
            if (userContext.data && userContext.data.aiStrategy) {
                const aiStrategy = userContext.data.aiStrategy;
                // Extract guidance from AI strategy
                const guidance = extractCampaignGuidance(aiStrategy);
                setAiGuidance(guidance);
            }
        } catch (error) {
            console.error('Failed to fetch user strategy:', error);
        } finally {
            setStrategyLoading(false);
        }
    };

    const extractCampaignGuidance = (strategy: any) => {
        // Default values
        let objective = 'Connect with prospects and generate leads';
        let description = 'Targeted outreach to decision makers in relevant industries';
        let cta = 'connect';
        let toneOverride = 'professional';

        // Try to extract from strategy if available
        if (typeof strategy === 'string') {
            try {
                const parsed = JSON.parse(strategy);
                if (parsed.objective) objective = parsed.objective;
                if (parsed.description) description = parsed.description;
                if (parsed.cta) cta = parsed.cta;
                if (parsed.toneOverride) toneOverride = parsed.toneOverride;
            } catch (e) {
                // If not JSON, try to extract from text
                if (strategy.includes('objective')) {
                    // Simple extraction - in a real app this would be more sophisticated
                    objective = 'Based on your AI strategy: ' + strategy.substring(0, 100) + '...';
                }
            }
        } else if (strategy && typeof strategy === 'object') {
            if (strategy.objective) objective = strategy.objective;
            if (strategy.description) description = strategy.description;
            if (strategy.cta) cta = strategy.cta;
            if (strategy.toneOverride) toneOverride = strategy.toneOverride;
        }

        return { objective, description, cta, toneOverride };
    };

    // Real-time campaign activity via Socket.IO
    useEffect(() => {
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
        const newSocket = io(apiBase);
        setSocket(newSocket);

        const token = localStorage.getItem('token');
        if (token) {
            newSocket.emit('join_room', { token });
        }

        newSocket.on('campaign_activity', (data: CampaignActivity) => {
            console.log('[SOCKET] Campaign activity:', data);
            setActivities(prev => [data, ...prev].slice(0, 50));
            
            // Show toast for completed actions
            if (data.action === 'success') {
                const nodeLabel = nodeLabels[data.node] || data.node;
                toast.success(`${nodeLabel} completed for ${data.leadName}`, {
                    description: data.details?.company ? `Company: ${data.details.company}` : undefined,
                    duration: 2,
                });
            } else if (data.action === 'failed') {
                const nodeLabel = nodeLabels[data.node] || data.node;
                toast.error(`${nodeLabel} failed for ${data.leadName}`, {
                    description: data.error || undefined,
                    duration: 3,
                });
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
                setShowCreateMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchCampaigns = async () => {
        try {
            const response = await api.get('/campaigns');
            setCampaigns(response.data);
        } catch (error) {
            console.error('Failed to fetch campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        try {
            if (currentStatus === 'ACTIVE') {
                await api.post(`/campaigns/${id}/pause`);
            } else if (currentStatus === 'QUEUED') {
                // Pulling out of the queue → DRAFT
                await api.post(`/campaigns/${id}/unqueue`);
            } else {
                await api.post(`/campaigns/${id}/start`);
            }
            fetchCampaigns();
        } catch (error: any) {
            // 409 ACTIVE_CAMPAIGN_EXISTS — offer to queue this one instead.
            if (error?.response?.status === 409 && error.response.data?.error === 'ACTIVE_CAMPAIGN_EXISTS') {
                const activeName = error.response.data?.message?.match(/"([^"]+)"/)?.[1] || 'another campaign';
                const shouldQueue = confirm(
                    `You already have an active campaign (${activeName}). ` +
                    `Only one campaign can run at a time on LinkedIn.\n\n` +
                    `Queue this campaign to run next when the current one finishes?`
                );
                if (shouldQueue) {
                    try {
                        await api.post(`/campaigns/${id}/queue`);
                        toast.success('Campaign queued. It will start automatically when the active one completes.');
                        fetchCampaigns();
                    } catch (qErr: any) {
                        toast.error('Failed to queue campaign: ' + (qErr?.response?.data?.error || qErr.message));
                    }
                }
                return;
            }
            // 400 LEAD_CAP_EXCEEDED — show the cap clearly.
            if (error?.response?.status === 400 && error.response.data?.error === 'LEAD_CAP_EXCEEDED') {
                const { cap, provided } = error.response.data;
                toast.error(`Too many leads (${provided}/${cap}). Remove some leads or upgrade your plan.`);
                return;
            }
            console.error('Failed to toggle campaign status:', error);
            toast.error('Failed to update campaign');
        }
    };

    const deleteCampaign = async (id: string) => {
        if (!confirm('Are you absolutely sure? This will remove all progress for this campaign.')) return;
        try {
            await api.delete(`/campaigns/${id}`);
            if (statusPanel?.campaignId === id) setStatusPanel(null);
            fetchCampaigns();
        } catch (error) {
            console.error('Failed to delete campaign:', error);
        }
    };

    const fetchStatus = async (campaignId: string) => {
        setStatusLoading(true);
        setStatusPanel({ campaignId, data: null });
        try {
            const response = await api.get(`/campaigns/${campaignId}/status`);
            const allLeadsRes = await api.get('/leads');

            // Filter out leads already in this campaign
            const currentLeadIds = new Set(response.data.leads.map((l: any) => l.lead.id));
            const availableLeads = allLeadsRes.data.filter((l: any) => !currentLeadIds.has(l.id));

            setStatusPanel({
                campaignId,
                data: {
                    ...response.data,
                    availableLeads
                }
            });
        } catch (error) {
            console.error('Failed to fetch campaign status:', error);
            setStatusPanel(null);
        } finally {
            setStatusLoading(false);
        }
    };

const removeLeadFromCampaign = async (campaignId: string, leadId: string) => {
        try {
            await api.delete(`/campaigns/${campaignId}/leads/${leadId}`);
            fetchStatus(campaignId);
        } catch (error) {
            console.error('Failed to remove lead:', error);
        }
    };

    const exportCampaign = async (campaignId: string, format: 'json' | 'csv' = 'csv') => {
        try {
            const response = await api.get(`/campaigns/${campaignId}/export?format=${format}`);
            
            // For CSV, create download
            if (format === 'csv') {
                const blob = new Blob([response.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `campaign-export-${campaignId.slice(0, 8)}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                // JSON - show in new tab
                const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `campaign-export-${campaignId.slice(0, 8)}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Failed to export:', error);
        }
    };

    const addLeadToCampaign = async (campaignId: string, leadId: string) => {
        try {
            await api.post(`/campaigns/${campaignId}/start`, { leadIds: [leadId] });
            fetchStatus(campaignId);
        } catch (error) {
            alert('Failed to add lead.');
        }
    };

    const startCreateCampaign = (type: 'linkedin' | 'email' | 'enrichment' | 'custom') => {
        setShowCreateMenu(false);
        let defaultName = 'New Campaign';
        let workflowJson: any = { nodes: [], edges: [] };

        if (type === 'linkedin') {
            defaultName = 'LinkedIn Campaign';
            // Gate-first: visit → check degree → IF_ELSE. Already connected → DM
            // straight away (no point sending an invite); not connected → send
            // the invite instead. One decision, no waiting — the lead takes
            // whichever single path fits their current connection state.
            workflowJson = {
                nodes: [
                    { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added', type: 'TRIGGER', subType: 'START' }, position: { x: 250, y: 0 } },
                    { id: 'n1', type: 'ACTION', subType: 'PROFILE_VISIT', data: { label: 'Visit Profile', type: 'ACTION', subType: 'PROFILE_VISIT', enrichCompany: true, enrichAbout: true }, position: { x: 250, y: 100 } },
                    { id: 'n2', type: 'ACTION', subType: 'CHECK_CONNECTION', data: { label: 'Check Connection', type: 'ACTION', subType: 'CHECK_CONNECTION' }, position: { x: 250, y: 200 } },
                    { id: 'n3', type: 'CONDITION', subType: 'IF_ELSE', data: { label: 'Connected?', type: 'CONDITION', subType: 'IF_ELSE', condition: { source: 'connectionState', field: 'connected', operator: 'is_true', probeOnNull: true } }, position: { x: 250, y: 300 } },
                    { id: 'n4', type: 'ACTION', subType: 'MESSAGE', data: { label: 'Send Message (AI)', type: 'ACTION', subType: 'MESSAGE', aiEnabled: true, message: '' }, position: { x: 80, y: 400 } },
                    { id: 'n5', type: 'ACTION', subType: 'CONNECT', data: { label: 'Send Invite (AI note)', type: 'ACTION', subType: 'CONNECT', aiEnabled: true, message: '' }, position: { x: 420, y: 400 } },
                    { id: 'end_msg', type: 'ACTION', subType: 'END', data: { label: 'End', type: 'ACTION', subType: 'END' }, position: { x: 80, y: 500 } },
                    { id: 'end_inv', type: 'ACTION', subType: 'END', data: { label: 'Invite Sent', type: 'ACTION', subType: 'END' }, position: { x: 420, y: 500 } },
                ],
                edges: [
                    { id: 'e1', source: 'trigger', target: 'n1' },
                    { id: 'e2', source: 'n1', target: 'n2' },
                    { id: 'e3', source: 'n2', target: 'n3' },
                    { id: 'e4', source: 'n3', target: 'n4', sourceHandle: 'true' },
                    { id: 'e5', source: 'n3', target: 'n5', sourceHandle: 'false' },
                    { id: 'e6', source: 'n4', target: 'end_msg' },
                    { id: 'e7', source: 'n5', target: 'end_inv' },
                ],
            };
        } else if (type === 'enrichment') {
            defaultName = 'Lead Enrichment';
            workflowJson = {
                nodes: [
                    { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added' }, position: { x: 250, y: 0 } },
                    { 
                        id: 'n1', 
                        type: 'ACTION', 
                        subType: 'VISIT', 
                        data: { 
                            label: 'Profile Visit (Enrich)', 
                            enrichCompany: true, 
                            enrichAbout: true, 
                            enrichContact: true, 
                            enrichPosts: true 
                        }, 
                        position: { x: 250, y: 100 } 
                    },
                ],
                edges: [
                    { id: 'e1', source: 'trigger', target: 'n1' },
                ],
            };
        } else if (type === 'email') {
            defaultName = 'Email Campaign';
            // Visit → find the email → IF_ELSE(email found?). Got one → send the
            // AI email; none found → end (don't fire blind with no address).
            workflowJson = {
                nodes: [
                    { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added', type: 'TRIGGER', subType: 'START' }, position: { x: 250, y: 0 } },
                    { id: 'n1', type: 'ACTION', subType: 'PROFILE_VISIT', data: { label: 'Visit Profile', type: 'ACTION', subType: 'PROFILE_VISIT', enrichCompany: true, enrichAbout: true, enrichContact: true }, position: { x: 250, y: 100 } },
                    { id: 'n2', type: 'ACTION', subType: 'EMAIL_FINDER', data: { label: 'Find Email', type: 'ACTION', subType: 'EMAIL_FINDER' }, position: { x: 250, y: 200 } },
                    { id: 'n3', type: 'CONDITION', subType: 'IF_ELSE', data: { label: 'Email Found?', type: 'CONDITION', subType: 'IF_ELSE', condition: { source: 'storedOutputs', field: 'email-finder.email', operator: 'is_not_null' } }, position: { x: 250, y: 300 } },
                    { id: 'n4', type: 'ACTION', subType: 'EMAIL', data: { label: 'Send Email (AI)', type: 'ACTION', subType: 'EMAIL', aiEnabled: true }, position: { x: 80, y: 400 } },
                    { id: 'end_ok', type: 'ACTION', subType: 'END', data: { label: 'End', type: 'ACTION', subType: 'END' }, position: { x: 80, y: 500 } },
                    { id: 'end_no', type: 'ACTION', subType: 'END', data: { label: 'No email', type: 'ACTION', subType: 'END' }, position: { x: 420, y: 400 } },
                ],
                edges: [
                    { id: 'e1', source: 'trigger', target: 'n1' },
                    { id: 'e2', source: 'n1', target: 'n2' },
                    { id: 'e3', source: 'n2', target: 'n3' },
                    { id: 'e4', source: 'n3', target: 'n4', sourceHandle: 'true' },
                    { id: 'e5', source: 'n3', target: 'end_no', sourceHandle: 'false' },
                    { id: 'e6', source: 'n4', target: 'end_ok' },
                ],
            };
        } else {
            workflowJson = {
                nodes: [
                    { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added' }, position: { x: 250, y: 50 } },
                ],
                edges: [],
            };
        }

        setPendingCreate({
            defaultName,
            // Everything except the Custom builder is structurally locked — users
            // tweak content & AI per step, but can't rewire a prebuilt flow.
            workflowJson: { ...workflowJson, locked: type !== 'custom' },
        });
    };

    // Template create flow — fetches the full workflow (summaries omit it), then
    // creates the campaign and opens the builder. Mirrors the templates hub page.
    const handleTemplateConfirm = async (name: string) => {
        if (!pendingTemplate) return;
        const summary = pendingTemplate;
        setPendingTemplate(null);
        try {
            let tpl = summary.workflow ? summary : null;
            if (!tpl) {
                try {
                    const res = await api.get<{ template: any }>(`/templates/${summary.id}`);
                    tpl = res.data.template;
                } catch {
                    tpl = FALLBACK_TEMPLATES.find((t) => t.id === summary.id) || null;
                }
            }
            if (!tpl) throw new Error('Template not found');
            const res = await api.post('/campaigns', {
                name,
                // Template-derived campaigns are content-only (locked structure).
                workflowJson: { ...tpl.workflow, locked: true },
                objective: tpl.aiStrategyHint?.objective,
                description: tpl.aiStrategyHint?.description,
                cta: tpl.aiStrategyHint?.cta,
                toneOverride: tpl.aiStrategyHint?.toneOverride,
            });
            router.push(builderHref(res.data.id));
        } catch (err) {
            console.error(err);
            toast.error('Error creating campaign from template.');
        }
    };

    const handleConfirmCreate = async (name: string, details: any) => {
        if (!pendingCreate) return;
        setPendingCreate(null);
        try {
            // Use AI guidance as default values, but allow user to override
            const finalObjective = details.objective || pendingCreate.aiDetails?.objective || '';
            const finalDescription = details.description || pendingCreate.aiDetails?.description || '';
            const finalCta = details.cta || pendingCreate.aiDetails?.cta || 'connect';
            const finalToneOverride = details.toneOverride || pendingCreate.aiDetails?.toneOverride || 'professional';
            
            const res = await api.post('/campaigns', { 
                name, 
                workflowJson: pendingCreate.workflowJson,
                objective: finalObjective,
                description: finalDescription,
                cta: finalCta,
                toneOverride: finalToneOverride
            });
            router.push(builderHref(res.data.id));
        } catch (err) {
            alert('Error creating campaign. Make sure the backend is running.');
        }
    };

    // Order: ACTIVE first (one of), then QUEUED by queuePosition asc, then
    // everything else by createdAt desc. This makes the user's pipeline
    // obvious at a glance: what's running, what's next, what's done.
    const sortedCampaigns = [...campaigns].sort((a, b) => {
        const rank = (s: string) => s === 'ACTIVE' ? 0 : s === 'QUEUED' ? 1 : 2;
        const ra = rank(a.status), rb = rank(b.status);
        if (ra !== rb) return ra - rb;
        if (a.status === 'QUEUED' && b.status === 'QUEUED') {
            return (a.queuePosition ?? 999) - (b.queuePosition ?? 999);
        }
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    const filteredCampaigns = filter === 'ALL'
        ? sortedCampaigns
        : sortedCampaigns.filter(c => c.status === filter);

    const statusCounts = {
        ALL: campaigns.length,
        ACTIVE: campaigns.filter(c => c.status === 'ACTIVE').length,
        QUEUED: campaigns.filter(c => c.status === 'QUEUED').length,
        PAUSED: campaigns.filter(c => c.status === 'PAUSED').length,
        DRAFT: campaigns.filter(c => c.status === 'DRAFT').length,
    };

    const filteredTemplates = tplGroup === 'all' ? templates : templates.filter((t) => t.group === tplGroup);
    const groupCount = (key: string) => (key === 'all' ? templates.length : templates.filter((t) => t.group === key).length);

    const createButton = (
        <div className="relative" ref={createMenuRef}>
            <Button onClick={() => setShowCreateMenu(!showCreateMenu)}>
                <Plus className="w-4 h-4" />
                New Campaign
                <ChevronDown className={cn('w-4 h-4 transition-transform', showCreateMenu && 'rotate-180')} />
            </Button>
            <AnimatePresence>
                {showCreateMenu && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute right-0 top-full mt-2 w-64 bg-card border border-line rounded-card shadow-lift z-40 p-2"
                    >
                        {[
                            { type: 'linkedin' as const, icon: Linkedin, label: 'LinkedIn', sub: 'Connect & message', tone: 'bg-blue-50 text-blue-600' },
                            { type: 'email' as const, icon: Mail, label: 'Cold email', sub: 'Direct inbox', tone: 'bg-emerald-50 text-emerald-600' },
                            { type: 'enrichment' as const, icon: Wrench, label: 'Lead enrichment', sub: 'Scrape & save', tone: 'bg-amber-50 text-amber-600' },
                            // Custom builder is disabled for now — users start from
                            // prebuilt/quick flows and tailor each step's content.
                        ].map((o) => (
                            <button key={o.type} onClick={() => startCreateCampaign(o.type)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-control hover:bg-surface transition-colors text-left">
                                <div className={cn('w-9 h-9 rounded-control grid place-items-center', o.tone)}><o.icon className="w-[18px] h-[18px]" /></div>
                                <div><p className="text-[13px] font-semibold text-foreground">{o.label}</p><p className="text-[11px] font-medium text-ink-400">{o.sub}</p></div>
                            </button>
                        ))}
                        <div className="border-t border-line my-1.5" />
                        <button onClick={() => { setShowCreateMenu(false); setView('templates'); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-control hover:bg-brand-50 transition-colors text-left group">
                            <div className="w-9 h-9 rounded-control bg-brand-50 text-brand grid place-items-center group-hover:bg-white"><LayoutTemplate className="w-[18px] h-[18px]" /></div>
                            <div><p className="text-[13px] font-semibold text-brand">Browse templates</p><p className="text-[11px] font-medium text-brand/60">{templates.length} prebuilt flows</p></div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Campaigns"
                subtitle="One campaign runs at a time; the rest queue automatically."
                actions={createButton}
            />

            {/* Segmented toggle: My Campaigns | Templates */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="bg-card border border-line rounded-control p-1 inline-flex gap-1 shadow-soft">
                    <button onClick={() => setView('mine')} className={cn('px-4 py-2 rounded-chip text-[13px] font-semibold flex items-center gap-2 transition-colors', view === 'mine' ? 'bg-brand text-white' : 'text-ink-500 hover:text-foreground')}>
                        <Target className="w-4 h-4" /> My Campaigns
                        <span className={cn('text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center', view === 'mine' ? 'bg-white/20 text-white' : 'bg-surface text-ink-400')}>{campaigns.length}</span>
                    </button>
                    <button onClick={() => setView('templates')} className={cn('px-4 py-2 rounded-chip text-[13px] font-semibold flex items-center gap-2 transition-colors', view === 'templates' ? 'bg-brand text-white' : 'text-ink-500 hover:text-foreground')}>
                        <LayoutTemplate className="w-4 h-4" /> Templates
                        <span className={cn('text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center', view === 'templates' ? 'bg-white/20 text-white' : 'bg-surface text-ink-400')}>{templates.length}</span>
                    </button>
                </div>
                {view === 'mine' && <SafetyQuotaBadge />}
            </div>

            {loading ? (
                <Skeleton className="h-64 rounded-card" />
            ) : view === 'templates' ? (
                /* ===== TEMPLATES ===== */
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                        {GROUP_TABS.map((g) => (
                            <button key={g.key} onClick={() => setTplGroup(g.key)} className={cn('px-3.5 py-2 rounded-chip text-[12px] font-semibold transition-colors flex items-center gap-2', tplGroup === g.key ? 'bg-ink-900 text-white' : 'bg-card border border-line text-ink-500 hover:bg-surface')}>
                                {g.label}
                                <span className={cn('text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center', tplGroup === g.key ? 'bg-white/20 text-white' : 'bg-surface text-ink-400')}>{groupCount(g.key)}</span>
                            </button>
                        ))}
                    </div>
                    {templatesLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-60 rounded-card" />)}
                        </div>
                    ) : filteredTemplates.length === 0 ? (
                        <EmptyState icon={LayoutTemplate} title="No templates here" description="Try a different group — your templates are organized by intent." />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredTemplates.map((tpl) => {
                                const meta = CATEGORY_META[tpl.category] || CATEGORY_META.linkedin;
                                const steps: string[] = (tpl.stepSequence || []).filter((s: string) => !STEP_CHIP_HIDDEN.has(s));
                                const gradient = tpl.color || 'from-brand-500 to-indigo-600';
                                return (
                                    <Card key={tpl.id} interactive onClick={() => router.push(`/campaigns/templates/${tpl.id}`)} className="p-5 flex flex-col cursor-pointer">
                                        <div className="flex items-start justify-between">
                                            <Badge tone={meta.tone}><meta.icon className="w-3 h-3" />{meta.label}</Badge>
                                            {/* Gradient identity tile carries the template's accent color + its
                                                channel icon (no emoji). */}
                                            <div className={cn('w-11 h-11 rounded-control grid place-items-center text-white shadow-lift bg-gradient-to-br', gradient)}>
                                                <meta.icon className="w-[22px] h-[22px]" />
                                            </div>
                                        </div>
                                        <h3 className="font-semibold text-[15px] mt-3.5 text-foreground tracking-[-0.01em]">{tpl.name}</h3>
                                        <p className="text-[12.5px] text-ink-500 font-medium mt-1.5 leading-relaxed flex-1 line-clamp-2">{tpl.description}</p>
                                        {steps.length > 0 && (
                                            <div className="flex items-center gap-1 flex-wrap mt-4">
                                                {steps.slice(0, 6).map((s, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1">
                                                        <span className={cn('text-[10px] font-bold rounded-chip px-2 py-1', stepChipTone(s))}>{stepLabel(s)}</span>
                                                        {i < Math.min(steps.length, 6) - 1 && <ChevronRight className="w-3 h-3 text-ink-400/60" />}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-3.5 text-[11.5px] font-semibold text-ink-400">
                                            {tpl.durationDays ? <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" />{tpl.durationDays} days</span> : null}
                                            {tpl.durationDays && tpl.stepCount ? <span className="w-[3px] h-[3px] rounded-full bg-ink-400/50" /> : null}
                                            {tpl.stepCount ? <span>{tpl.stepCount} steps</span> : null}
                                        </div>
                                        {tpl.bestFor ? (
                                            <p className="text-[11.5px] text-ink-400 leading-relaxed mt-3 line-clamp-2">
                                                <span className="font-bold text-ink-500">Best for</span> {tpl.bestFor.replace(/^Best for:\s*/i, '')}
                                            </p>
                                        ) : null}
                                        <div className="mt-4">
                                            <Button className="w-full" onClick={(e) => { e.stopPropagation(); setPendingTemplate(tpl); }}>Use template</Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                /* ===== MY CAMPAIGNS ===== */
                <div className="space-y-4">
                    {/* Status filter chips */}
                    <div className="flex flex-wrap items-center gap-2">
                        {(['ALL', 'ACTIVE', 'QUEUED', 'PAUSED', 'DRAFT'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={cn(
                                    'px-3.5 py-2 rounded-chip text-[12px] font-semibold transition-colors',
                                    filter === tab ? 'bg-ink-900 text-white' : 'bg-card border border-line text-ink-500 hover:bg-surface',
                                )}
                            >
                                {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()} <span className="opacity-70">{statusCounts[tab]}</span>
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    {filteredCampaigns.length === 0 ? (
                        <EmptyState
                            icon={Target}
                            title={filter === 'ALL' ? 'No campaigns yet' : `No ${filter.toLowerCase()} campaigns`}
                            description={filter === 'ALL' ? 'Start from a prebuilt template or build your own — your campaigns will appear here.' : 'Try a different filter, or start a new campaign.'}
                            action={<Button onClick={() => setView('templates')}><LayoutTemplate className="w-4 h-4" />Browse templates</Button>}
                        />
                    ) : (
                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
                            <table className="w-full text-[13px] min-w-[640px]">
                                <thead>
                                    <tr className="border-b border-line">
                                        <th className="text-left label px-5 py-3">Campaign</th>
                                        <th className="text-left label px-5 py-3">Status</th>
                                        <th className="text-left label px-5 py-3 hidden sm:table-cell">Leads</th>
                                        <th className="px-5 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCampaigns.map((campaign) => {
                                        const tone = campaign.status === 'ACTIVE' ? 'success' : campaign.status === 'QUEUED' ? 'info' : campaign.status === 'PAUSED' ? 'warning' : 'neutral';
                                        const leadCount = campaign._count?.CampaignLead ?? campaign.leadCount ?? null;
                                        return (
                                            <tr key={campaign.id} className="border-b border-line last:border-0 hover:bg-[#faf9ff] transition-colors">
                                                <td className="px-5 py-4">
                                                    <Link href={`/campaigns/${campaign.id}`} className="block group">
                                                        <span className="font-semibold text-foreground group-hover:text-brand transition-colors">{campaign.name}</span>
                                                        <span className="block text-[11px] text-ink-400 font-medium mt-0.5">ID {campaign.id.slice(0, 8)}</span>
                                                    </Link>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Badge tone={tone} dot>
                                                            {campaign.status.charAt(0) + campaign.status.slice(1).toLowerCase()}{campaign.status === 'QUEUED' && campaign.queuePosition ? ` #${campaign.queuePosition}` : ''}
                                                        </Badge>
                                                        {(campaign.status === 'ACTIVE' || campaign.status === 'QUEUED') && <CampaignEta campaignId={campaign.id} />}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 num hidden sm:table-cell">{leadCount ?? '—'}</td>
                                                <td className="px-5 py-4">
                                                    <div className="flex gap-1 justify-end">
                                                        <button onClick={() => toggleStatus(campaign.id, campaign.status)} title={campaign.status === 'ACTIVE' ? 'Pause' : 'Start'} className={cn('w-8 h-8 rounded-control grid place-items-center transition-colors', campaign.status === 'ACTIVE' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50')}>{campaign.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
                                                        <Link href={`/campaigns/${campaign.id}/builder`} title="Edit" className="w-8 h-8 rounded-control grid place-items-center text-ink-400 hover:bg-surface hover:text-foreground transition-colors"><Wrench className="w-4 h-4" /></Link>
                                                        <button onClick={() => deleteCampaign(campaign.id)} title="Delete" className="w-8 h-8 rounded-control grid place-items-center text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </Card>
                    )}

                    {/* Templates nudge */}
                    <div className="rounded-card bg-gradient-to-r from-brand-50 to-white border border-brand-100 p-4 pl-5 flex items-center gap-4">
                        <div className="w-9 h-9 rounded-control bg-card text-brand grid place-items-center shrink-0 shadow-soft"><LayoutTemplate className="w-4 h-4" /></div>
                        <p className="text-[13px] font-medium text-ink-700 flex-1">Not sure where to start? <b>{templates.length} prebuilt templates</b> — launch in one click.</p>
                        <Button variant="outline" size="sm" onClick={() => setView('templates')}>Browse templates →</Button>
                    </div>
                </div>
            )}

            {/* Status Panel Modal */}
            <AnimatePresence>
                {statusPanel && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setStatusPanel(null)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md cursor-pointer"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 30 }}
                            className="bg-background rounded-[3rem] shadow-2xl border border-border w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col relative z-50"
                        >
                            <div className="px-10 py-10 border-b border-border flex items-center justify-between bg-muted/30">
                                <div>
                                    <h3 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Engine Status</h3>
                                    {statusPanel.data && (
                                        <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-70">
                                            {statusPanel.data.campaign.name} • {statusPanel.data.campaign.status}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={() => exportCampaign(statusPanel.campaignId, 'csv')}
                                        className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/20 transition-all"
                                        title="Export CSV"
                                    >
                                        <Download className="w-4 h-4 text-emerald-600" />
                                    </button>
                                    <button
                                        onClick={() => fetchStatus(statusPanel.campaignId)}
                                        className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center hover:bg-muted transition-all"
                                        title="Refresh Status"
                                    >
                                        <Loader2 className={cn("w-4 h-4", statusLoading && "animate-spin")} />
                                    </button>
                                    <button
                                        onClick={() => setStatusPanel(null)}
                                        className="w-12 h-12 rounded-2xl bg-white border border-border flex items-center justify-center hover:bg-muted transition-all shadow-sm"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Live Activity Feed */}
                            {activities.length > 0 && (
                                <div className="bg-gradient-to-r from-emerald-500/5 to-primary/5 px-10 py-6 border-b border-border">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            Live Activity
                                        </span>
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                            {activities.filter(a => a.action === 'success').length} completed
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {activities.slice(0, 5).map((activity, idx) => {
                                            const Icon = nodeIcons[activity.node] || Loader2;
                                            const isSuccess = activity.action === 'success';
                                            const isFailed = activity.action === 'failed';
                                            return (
                                                <div key={idx} className={cn(
                                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-xs",
                                                    isSuccess && "bg-emerald-500/10 text-emerald-700",
                                                    isFailed && "bg-red-500/10 text-red-700",
                                                    activity.action === 'executing' && "bg-primary/10 text-primary"
                                                )}>
                                                    {activity.action === 'executing' ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : isSuccess ? (
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    ) : (
                                                        <AlertCircle className="w-3 h-3" />
                                                    )}
                                                    <span className="font-bold">{nodeLabels[activity.node] || activity.node}</span>
                                                    <span className="truncate flex-1">{activity.leadName}</span>
                                                    <span className="opacity-60">
                                                        {new Date(activity.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="bg-primary/5 px-10 py-6 border-b border-border flex items-center justify-between">
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Lead Management Control</span>
                                {statusPanel.data?.stats && (
                                    <div className="flex gap-4 text-[10px] font-bold">
                                        <span className="text-muted-foreground">Total: {statusPanel.data.stats.total}</span>
                                        <span className="text-emerald-600">✓ {statusPanel.data.stats.completed || 0}</span>
                                        <span className="text-red-500">✗ {statusPanel.data.stats.failed || 0}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                                {statusLoading ? (
                                    <div className="flex h-64 items-center justify-center">
                                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                    </div>
                                ) : statusPanel.data?.leads?.length === 0 ? (
                                    <div className="text-center py-20 opacity-50 space-y-4">
                                        <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground" />
                                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Engine is currently empty.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-12">
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between px-2">
                                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Active Deployment ({statusPanel.data?.leads?.length})</h4>
                                            </div>
                                            {statusPanel.data?.leads?.map((lead: any) => (
                                                <div key={lead.campaignLeadId} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-soft hover:shadow-xl transition-all relative group">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h4 className="text-lg font-black text-foreground uppercase tracking-tight">{lead.lead.firstName} {lead.lead.lastName}</h4>
                                                            <a href={lead.lead.linkedinUrl} target="_blank" className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:underline mt-1 inline-block opacity-80">View Nexus Link</a>
                                                        </div>
                                                        <div className="flex items-center space-x-3">
                                                            <span className={cn(
                                                                "text-[9px] font-black px-4 py-1.5 rounded-full border shadow-sm uppercase tracking-widest",
                                                                lead.isCompleted ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-primary/10 text-primary border-primary/20"
                                                            )}>
                                                                {lead.isCompleted ? 'Finalized' : 'Operational'}
                                                            </span>
                                                            <button
                                                                onClick={() => removeLeadFromCampaign(statusPanel.campaignId, lead.lead.id)}
                                                                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all"
                                                                title="Remove from Campaign"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Enriched Data */}
                                                    {(lead.lead.company || lead.lead.jobTitle || lead.nodeOutputs?.['profile-visit']?.company) && (
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            {lead.lead.company || lead.nodeOutputs?.['profile-visit']?.company ? (
                                                                <span className="text-[10px] font-bold px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full">
                                                                    {lead.lead.company || lead.nodeOutputs?.['profile-visit']?.company}
                                                                </span>
                                                            ) : null}
                                                            {lead.lead.jobTitle || lead.nodeOutputs?.['profile-visit']?.jobTitle ? (
                                                                <span className="text-[10px] font-bold px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full">
                                                                    {lead.lead.jobTitle || lead.nodeOutputs?.['profile-visit']?.jobTitle}
                                                                </span>
                                                            ) : null}
                                                            {(lead.lead.aboutInfo || lead.nodeOutputs?.['profile-visit']?.about) && (
                                                                <span className="text-[10px] font-bold px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full">
                                                                    About extracted
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-4 mt-8">
                                                        <div className="bg-muted p-5 rounded-3xl border border-border/50">
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Execution Point</span>
                                                            <p className="text-sm font-black text-foreground uppercase tracking-tight mt-1 truncate">{lead.currentStepId?.slice(-8) || 'INITIAL'}</p>
                                                        </div>
                                                        <div className="bg-muted p-5 rounded-3xl border border-border/50">
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Synchronizer</span>
                                                            <p className="text-sm font-black text-foreground mt-1 tracking-tight">
                                                                {lead.nextActionDate ? new Date(lead.nextActionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'READY'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Execution Log - Show failed steps */}
                                                    {lead.execLog?.some((e: any) => e.status === 'failed') && (
                                                        <div className="mt-6 p-4 bg-red-500/5 rounded-2xl border border-red-500/20">
                                                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Failed Steps</span>
                                                            {lead.execLog?.filter((e: any) => e.status === 'failed').map((e: any, idx: number) => (
                                                                <div key={idx} className="text-xs text-red-500 mt-2">
                                                                    {e.node}: {e.error || 'Unknown error'}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {lead.personalization && (
                                                        <div className="mt-6 p-6 bg-primary/5 rounded-[2rem] border border-primary/10 italic">
                                                            <p className="text-sm text-foreground leading-relaxed font-medium">"{lead.personalization}"</p>
                                                        </div>
                                                    )}

                                                    {lead.recentLogs?.length > 0 && (
                                                        <div className="mt-8 border-t border-border pt-6">
                                                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 block">Operation Sequence</span>
                                                            <div className="space-y-3">
                                                                {lead.recentLogs.map((log: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between bg-muted/40 p-4 rounded-2xl border border-border/30">
                                                                        <div className="flex items-center space-x-4">
                                                                            <div className={cn("w-2 h-2 rounded-full", log.status === 'SUCCESS' ? "bg-emerald-500" : "bg-red-500")} />
                                                                            <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{log.actionType.replace(/_/g, ' ')}</span>
                                                                        </div>
                                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                                                            {new Date(log.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Leads Section */}
                                        <div className="pt-10 border-t border-border">
                                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 italic">Available Prospects for Reinforcement</h4>
                                            {statusPanel.data?.availableLeads?.length === 0 ? (
                                                <p className="text-xs font-bold text-muted-foreground/40 text-center py-10 uppercase italic">No available prospects in global list.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {statusPanel.data?.availableLeads?.map((lead: any) => (
                                                        <div key={lead.id} className="flex items-center justify-between p-5 bg-muted/20 border border-border/50 rounded-3xl hover:bg-white transition-all group">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-black text-foreground uppercase truncate">{lead.firstName} {lead.lastName}</p>
                                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{lead.company || 'Global Entity'}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => addLeadToCampaign(statusPanel.campaignId, lead.id)}
                                                                className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <CampaignNameModal
                isOpen={!!pendingCreate}
                defaultName={pendingCreate?.defaultName || 'New Campaign'}
                onConfirm={handleConfirmCreate}
                onCancel={() => setPendingCreate(null)}
            />

            <CampaignNameModal
                isOpen={!!pendingTemplate}
                defaultName={pendingTemplate?.name || 'New Campaign'}
                onConfirm={handleTemplateConfirm}
                onCancel={() => setPendingTemplate(null)}
            />
        </div>
    );
}
