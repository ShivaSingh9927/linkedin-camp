"use client";

import { useState, useEffect, useRef } from 'react';
import {
    Search,
    MessageSquare,
    Send,
    ChevronRight,
    Loader2,
    Users,
    Tag,
    Linkedin,
    Building2,
    MapPin,
    Clock,
    FileText,
    Plus,
    X,
    Trash2,
    Edit3,
    Copy,
    BookTemplate,
    Bookmark,
    ArrowLeft,
    Filter,
    Mail,
    User as UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    id: string;
    direction: 'SENT' | 'RECEIVED';
    content: string;
    source: string;
    sentAt: string;
    campaignId?: string;
    templateId?: string;
}

interface Conversation {
    leadId: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    company: string;
    linkedinUrl: string;
    country: string;
    gender: string;
    status: string;
    tags: string[];
    lastMessage: Message | null;
    messageCount: number;
    campaigns: { id: string; name: string; status: string }[];
}

interface MessageTemplate {
    id: string;
    name: string;
    content: string;
    variables: string[];
    category: string;
    createdAt: string;
    updatedAt: string;
}

type InboxFilter = 'all' | 'sent' | 'awaiting';

export default function InboxPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConv, setActiveConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<InboxFilter>('all');
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);

    // Template Modal
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
    const [templateForm, setTemplateForm] = useState({ name: '', content: '', category: '' });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        fetchConversations();
        fetchTemplates();
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const fetchConversations = async () => {
        try {
            const response = await api.get('/inbox/conversations');
            setConversations(response.data);
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const response = await api.get('/inbox/templates');
            setTemplates(response.data);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        }
    };

    const openConversation = async (conv: Conversation) => {
        setActiveConv(conv);
        setMessagesLoading(true);
        try {
            const response = await api.get(`/inbox/conversations/${conv.leadId}`);
            setMessages(response.data.messages);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setMessagesLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!replyText.trim() || !activeConv) return;

        setSending(true);
        try {
            const response = await api.post(`/inbox/conversations/${activeConv.leadId}/messages`, {
                content: replyText.trim(),
                source: 'MANUAL',
                direction: 'SENT',
            });
            setMessages(prev => [...prev, response.data]);
            setReplyText('');
            // Refresh conversations to update last message
            fetchConversations();
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to log message.');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Template CRUD
    const handleCreateTemplate = async () => {
        if (!templateForm.name || !templateForm.content) return;
        try {
            if (editingTemplate) {
                await api.put(`/inbox/templates/${editingTemplate.id}`, templateForm);
            } else {
                await api.post('/inbox/templates', templateForm);
            }
            fetchTemplates();
            setShowTemplateModal(false);
            setEditingTemplate(null);
            setTemplateForm({ name: '', content: '', category: '' });
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Failed to save template';
            alert(msg);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            await api.delete(`/inbox/templates/${id}`);
            fetchTemplates();
        } catch (error) {
            alert('Failed to delete template.');
        }
    };

    const insertTemplate = (template: MessageTemplate) => {
        if (!activeConv) return;

        let content = template.content;
        // Replace variables with lead data
        const varMap: Record<string, string> = {
            firstName: activeConv.firstName || '',
            lastName: activeConv.lastName || '',
            company: activeConv.company || '',
            jobTitle: activeConv.jobTitle || '',
            country: activeConv.country || '',
        };

        content = content.replace(/\{\{(\w+)\}\}/g, (_, key) => varMap[key] || `{{${key}}}`);

        setReplyText(content);
        setShowTemplatePicker(false);
        textareaRef.current?.focus();
    };

    // Filtered conversations
    const filteredConversations = conversations.filter(conv => {
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const match = [conv.firstName, conv.lastName, conv.company, conv.jobTitle]
                .filter(Boolean)
                .some(v => v?.toLowerCase().includes(q));
            if (!match) return false;
        }
        // Status filter — for now simplified
        if (filter === 'sent' && conv.lastMessage?.direction !== 'SENT') return false;
        if (filter === 'awaiting' && conv.lastMessage?.direction !== 'SENT') return false;

        return true;
    });

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString();
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'CONNECTED': return 'bg-emerald-500';
            case 'INVITE_PENDING': return 'bg-amber-500';
            case 'REPLIED': return 'bg-blue-500';
            case 'BOUNCED': return 'bg-red-500';
            default: return 'bg-slate-400';
        }
    };

    return (
        <div className="flex h-full animate-in fade-in duration-500">
            {/* ─── Left: Conversation List ─── */}
            <div className="w-80 flex-shrink-0 border-r bg-white flex flex-col">
                {/* Header */}
                <div className="p-4 border-b space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Inbox</h2>
                        <button
                            onClick={() => {
                                setShowTemplateModal(true);
                                setEditingTemplate(null);
                                setTemplateForm({ name: '', content: '', category: '' });
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Manage Templates"
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border rounded-xl bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                        />
                    </div>

                    {/* Filter tabs */}
                    <div className="flex space-x-1 bg-slate-100 rounded-xl p-0.5">
                        {(['all', 'sent', 'awaiting'] as InboxFilter[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                    filter === f
                                        ? "bg-white shadow-sm text-slate-700"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {f === 'all' ? 'All' : f === 'sent' ? 'Sent' : 'Awaiting'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="text-center py-16 px-6">
                            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-7 h-7 text-slate-300" />
                            </div>
                            <p className="text-sm font-bold text-slate-500">No conversations yet</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Messages from your campaigns will appear here.
                            </p>
                        </div>
                    ) : (
                        filteredConversations.map((conv) => (
                            <button
                                key={conv.leadId}
                                onClick={() => openConversation(conv)}
                                className={cn(
                                    "w-full text-left p-4 border-b hover:bg-slate-50 transition-all",
                                    activeConv?.leadId === conv.leadId && "bg-indigo-50/50 border-l-2 border-l-indigo-600"
                                )}
                            >
                                <div className="flex items-start space-x-3">
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-black">
                                            {(conv.firstName?.[0] || '?').toUpperCase()}
                                        </div>
                                        <span className={cn(
                                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                                            statusColor(conv.status)
                                        )} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-slate-800 truncate">
                                                {conv.firstName} {conv.lastName}
                                            </p>
                                            {conv.lastMessage && (
                                                <span className="text-[10px] text-slate-400 font-medium flex-shrink-0 ml-2">
                                                    {timeAgo(conv.lastMessage.sentAt)}
                                                </span>
                                            )}
                                        </div>
                                        {conv.jobTitle && (
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                {conv.jobTitle}{conv.company ? ` @ ${conv.company}` : ''}
                                            </p>
                                        )}
                                        {conv.lastMessage && (
                                            <p className="text-xs text-slate-500 truncate mt-1">
                                                {conv.lastMessage.direction === 'SENT' && (
                                                    <span className="text-indigo-500 font-bold">You: </span>
                                                )}
                                                {conv.lastMessage.content}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Tags */}
                                {conv.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2 ml-[52px]">
                                        {conv.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ─── Center: Message Thread ─── */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
                {!activeConv ? (
                    // Empty state
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-5 border">
                                <MessageSquare className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-black text-slate-700">Select a Conversation</h3>
                            <p className="text-sm text-slate-400 mt-2 max-w-xs">
                                Choose a conversation from the left to view messages and reply.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Conversation header */}
                        <div className="px-6 py-4 bg-white border-b flex items-center justify-between shadow-sm">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-black">
                                    {(activeConv.firstName?.[0] || '?').toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">
                                        {activeConv.firstName} {activeConv.lastName}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {activeConv.jobTitle}{activeConv.company ? ` @ ${activeConv.company}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className={cn(
                                    "text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter border",
                                    activeConv.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                        activeConv.status === 'REPLIED' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            activeConv.status === 'INVITE_PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                'bg-slate-50 text-slate-600 border-slate-100'
                                )}>
                                    {activeConv.status.replace('_', ' ')}
                                </span>
                                {activeConv.linkedinUrl && (
                                    <a
                                        href={activeConv.linkedinUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                                    >
                                        <Linkedin className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                            {messagesLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-20">
                                    <p className="text-sm text-slate-400">No messages yet. Start the conversation!</p>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex",
                                            msg.direction === 'SENT' ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        <div className={cn(
                                            "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm",
                                            msg.direction === 'SENT'
                                                ? "bg-indigo-600 text-white rounded-br-md"
                                                : "bg-white text-slate-700 border rounded-bl-md"
                                        )}>
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                            <div className={cn(
                                                "flex items-center space-x-2 mt-2",
                                                msg.direction === 'SENT' ? 'justify-end' : 'justify-start'
                                            )}>
                                                {msg.source && msg.source !== 'MANUAL' && (
                                                    <span className={cn(
                                                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
                                                        msg.direction === 'SENT'
                                                            ? "bg-indigo-500 text-indigo-200"
                                                            : "bg-slate-100 text-slate-400"
                                                    )}>
                                                        {msg.source === 'CAMPAIGN' ? '⚡ Campaign' : '🔄 Synced'}
                                                    </span>
                                                )}
                                                <span className={cn(
                                                    "text-[10px]",
                                                    msg.direction === 'SENT' ? "text-indigo-300" : "text-slate-400"
                                                )}>
                                                    {timeAgo(msg.sentAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply box */}
                        <div className="px-6 py-4 bg-white border-t">
                            <div className="relative">
                                <textarea
                                    ref={textareaRef}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                                    rows={3}
                                    className="w-full px-4 py-3 pr-24 border rounded-2xl bg-slate-50 resize-none text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                />
                                <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                                    {/* Template picker */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                                            className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                            title="Insert Template"
                                        >
                                            <Bookmark className="w-4 h-4" />
                                        </button>
                                        {showTemplatePicker && (
                                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-white border rounded-2xl shadow-xl z-30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                                                <div className="p-3 border-b bg-slate-50">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-slate-600">Insert Template</p>
                                                        <button
                                                            onClick={() => setShowTemplatePicker(false)}
                                                            className="p-1 rounded-lg hover:bg-slate-200 transition-colors"
                                                        >
                                                            <X className="w-3 h-3 text-slate-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="max-h-[250px] overflow-y-auto">
                                                    {templates.length === 0 ? (
                                                        <div className="p-4 text-center">
                                                            <p className="text-xs text-slate-400">No templates yet</p>
                                                            <button
                                                                onClick={() => {
                                                                    setShowTemplatePicker(false);
                                                                    setShowTemplateModal(true);
                                                                    setEditingTemplate(null);
                                                                    setTemplateForm({ name: '', content: '', category: '' });
                                                                }}
                                                                className="text-xs text-indigo-600 font-bold mt-1"
                                                            >
                                                                Create one →
                                                            </button>
                                                        </div>
                                                    ) : templates.map((t) => (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => insertTemplate(t)}
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b last:border-b-0"
                                                        >
                                                            <p className="text-sm font-bold text-slate-700">{t.name}</p>
                                                            <p className="text-xs text-slate-400 truncate mt-0.5">{t.content}</p>
                                                            {t.variables?.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                                    {t.variables.map(v => (
                                                                        <span key={v} className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-bold">
                                                                            {`{{${v}}}`}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Send */}
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!replyText.trim() || sending}
                                        className={cn(
                                            "p-2 rounded-xl transition-all",
                                            replyText.trim()
                                                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                                                : "bg-slate-100 text-slate-300"
                                        )}
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ─── Right: Lead Details ─── */}
            {activeConv && (
                <div className="w-72 flex-shrink-0 border-l bg-white overflow-y-auto">
                    <div className="p-5 space-y-5">
                        {/* Profile */}
                        <div className="text-center pb-4 border-b">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-black mx-auto mb-3">
                                {(activeConv.firstName?.[0] || '?').toUpperCase()}
                            </div>
                            <h4 className="text-base font-bold text-slate-800">
                                {activeConv.firstName} {activeConv.lastName}
                            </h4>
                            {activeConv.jobTitle && (
                                <p className="text-xs text-slate-500 mt-1">{activeConv.jobTitle}</p>
                            )}
                        </div>

                        {/* Details */}
                        <div className="space-y-3">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</h5>

                            {activeConv.company && (
                                <div className="flex items-center space-x-2.5">
                                    <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-600">{activeConv.company}</span>
                                </div>
                            )}
                            {activeConv.country && (
                                <div className="flex items-center space-x-2.5">
                                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-600">{activeConv.country}</span>
                                </div>
                            )}
                            {activeConv.gender && (
                                <div className="flex items-center space-x-2.5">
                                    <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-600 capitalize">{activeConv.gender}</span>
                                </div>
                            )}
                            {activeConv.linkedinUrl && (
                                <div className="flex items-center space-x-2.5">
                                    <Linkedin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                    <a
                                        href={activeConv.linkedinUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline truncate"
                                    >
                                        LinkedIn Profile
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Status */}
                        <div className="space-y-3">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</h5>
                            <span className={cn(
                                "text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter border inline-block",
                                activeConv.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    activeConv.status === 'REPLIED' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        activeConv.status === 'INVITE_PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                            'bg-slate-50 text-slate-600 border-slate-100'
                            )}>
                                {activeConv.status.replace('_', ' ')}
                            </span>
                        </div>

                        {/* Tags */}
                        {activeConv.tags?.length > 0 && (
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tags</h5>
                                <div className="flex flex-wrap gap-1.5">
                                    {activeConv.tags.map(tag => (
                                        <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-bold">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Campaigns */}
                        {activeConv.campaigns?.length > 0 && (
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campaigns</h5>
                                <div className="space-y-2">
                                    {activeConv.campaigns.map(camp => (
                                        <Link
                                            key={camp.id}
                                            href={`/campaigns/${camp.id}/builder`}
                                            className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors group"
                                        >
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-600">{camp.name}</p>
                                                <div className="flex items-center space-x-1 mt-0.5">
                                                    <span className={cn(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        camp.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                                                    )} />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{camp.status}</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-400" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Message stats */}
                        <div className="space-y-3 pt-3 border-t">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity</h5>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-black text-slate-700">{activeConv.messageCount}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Messages</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-black text-slate-700">{activeConv.campaigns?.length || 0}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Campaigns</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Template Management Modal ─── */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-5 border-b bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                    {editingTemplate ? 'Edit Template' : 'Message Templates'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Create reusable messages with variables like {'{{firstName}}'}, {'{{company}}'}
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
                                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {/* Create/Edit form */}
                            <div className="bg-slate-50 rounded-2xl p-5 border mb-6 space-y-4">
                                <h4 className="text-sm font-bold text-slate-700">
                                    {editingTemplate ? 'Update Template' : '+ New Template'}
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Template name"
                                        value={templateForm.name}
                                        onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="px-3 py-2 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    />
                                    <select
                                        value={templateForm.category}
                                        onChange={(e) => setTemplateForm(prev => ({ ...prev, category: e.target.value }))}
                                        className="px-3 py-2 border rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    >
                                        <option value="">Category (optional)</option>
                                        <option value="invite">Invite Note</option>
                                        <option value="follow_up">Follow-up</option>
                                        <option value="intro">Introduction</option>
                                        <option value="closing">Closing</option>
                                    </select>
                                </div>
                                <textarea
                                    placeholder={"Hi {{firstName}}, I noticed you're at {{company}}..."}
                                    value={templateForm.content}
                                    onChange={(e) => setTemplateForm(prev => ({ ...prev, content: e.target.value }))}
                                    rows={4}
                                    className="w-full px-3 py-2 border rounded-xl text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                />
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-wrap gap-1">
                                        {['firstName', 'lastName', 'company', 'jobTitle', 'country'].map(v => (
                                            <button
                                                key={v}
                                                onClick={() => setTemplateForm(prev => ({
                                                    ...prev,
                                                    content: prev.content + `{{${v}}}`
                                                }))}
                                                className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-bold hover:bg-indigo-100 transition-colors"
                                            >
                                                + {`{{${v}}}`}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex space-x-2">
                                        {editingTemplate && (
                                            <button
                                                onClick={() => {
                                                    setEditingTemplate(null);
                                                    setTemplateForm({ name: '', content: '', category: '' });
                                                }}
                                                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button
                                            onClick={handleCreateTemplate}
                                            disabled={!templateForm.name || !templateForm.content}
                                            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {editingTemplate ? 'Update' : 'Create'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Existing templates */}
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                Saved Templates ({templates.length})
                            </h4>
                            {templates.length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-8">
                                    No templates yet. Create your first one above!
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {templates.map(t => (
                                        <div key={t.id} className="border rounded-2xl p-4 hover:shadow-sm transition-shadow">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2">
                                                        <p className="text-sm font-bold text-slate-700">{t.name}</p>
                                                        {t.category && (
                                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
                                                                {t.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap line-clamp-3">{t.content}</p>
                                                    {t.variables?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {t.variables.map(v => (
                                                                <span key={v} className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-bold">
                                                                    {`{{${v}}}`}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex space-x-1 ml-3">
                                                    <button
                                                        onClick={() => {
                                                            setEditingTemplate(t);
                                                            setTemplateForm({
                                                                name: t.name,
                                                                content: t.content,
                                                                category: t.category || '',
                                                            });
                                                        }}
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTemplate(t.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
