'use client';

import { useState, useEffect } from 'react';
import { Search, RefreshCw, MessageSquare, Sparkles, Inbox as InboxIcon, ArrowLeft, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, Button, Badge, Avatar, PageHeader } from '@/components/ui';

// Absolute backend base (the inbox calls the backend directly; relative paths
// depend on the Next rewrite which isn't wired the same in prod → 404s).
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');

// The live LinkedIn (Voyager) sync is proxy-bound and lock-guarded server-side.
// We keep manual sync rare: a 5-minute client cooldown on top of the backend
// 409 lock. "Last synced" is tracked per-browser in localStorage (the inbox
// also syncs automatically — daily + after campaigns — server-side).
const SYNC_KEY = 'qampi_inbox_synced_at';
const COOLDOWN_MS = 5 * 60 * 1000;

interface Conversation {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  lastMessage: string;
  timestamp: string;
  isRead: boolean;
  status: 'PENDING' | 'CONNECTED' | 'REPLIED' | 'FAILED';
}

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  REPLIED: 'success', CONNECTED: 'info', PENDING: 'warning', FAILED: 'neutral',
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'replied'>('all');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const [replyText, setReplyText] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [lastReceivedMessage, setLastReceivedMessage] = useState('');

  // Tick so the cooldown / "synced Xm ago" label stays live.
  useEffect(() => {
    const v = localStorage.getItem(SYNC_KEY);
    if (v) setLastSyncedAt(Number(v));
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const cooldownLeftMs = lastSyncedAt ? Math.max(0, COOLDOWN_MS - (now - lastSyncedAt)) : 0;
  const onCooldown = cooldownLeftMs > 0;

  const fetchConversations = async () => {
    try {
      setSyncError(null);
      const res = await fetch(`${API_BASE}/api/v1/inbox/conversations`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSyncError(data?.error || `Failed to load conversations (${res.status})`);
        setConversations([]);
        return;
      }
      const data = await res.json();
      setConversations(
        data.map((c: any) => ({
          id: c.leadId,
          firstName: c.firstName || 'Unknown',
          lastName: c.lastName || '',
          headline: c.jobTitle ? `${c.jobTitle}${c.company ? ` at ${c.company}` : ''}` : c.headline || 'LinkedIn Member',
          lastMessage: c.lastMessage?.content || 'No messages yet',
          timestamp: c.lastMessage ? new Date(c.lastMessage.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          isRead: true,
          status: c.status,
        })),
      );
    } catch (err) {
      console.error('Failed to fetch:', err);
      setSyncError('Network error — please check your connection');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (leadId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/inbox/conversations/${leadId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setMessages(data.messages || []);
      const received = (data.messages || []).filter((m: any) => m.direction === 'RECEIVED');
      if (received.length > 0) setLastReceivedMessage(received[received.length - 1].content || '');
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Load once, then auto-refresh from the DB every 30s so messages saved by the
  // scheduled/auto sync (daily + post-campaign) appear without a manual button.
  useEffect(() => {
    fetchConversations();
    const t = setInterval(fetchConversations, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (selectedConvo) fetchMessages(selectedConvo.id); }, [selectedConvo]);

  const handleSync = async () => {
    if (onCooldown || isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/inbox/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const stamp = Date.now();
        localStorage.setItem(SYNC_KEY, String(stamp));
        setLastSyncedAt(stamp);
        setNow(stamp);
        setTimeout(fetchConversations, 30000); // background pull takes time
      } else if (res.status === 409) {
        setSyncError('LinkedIn is busy with another action — try again in a few seconds.');
      } else {
        const data = await res.json().catch(() => ({}));
        setSyncError(data?.error || `Sync failed (${res.status})`);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncError('Network error — please check your connection');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEnhanceReply = async () => {
    if (!selectedConvo || !lastReceivedMessage) return;
    setIsEnhancing(true);
    try {
      const threadHistory = messages.slice(-6).map((m) => ({
        role: m.direction === 'SENT' ? 'assistant' : 'user',
        content: m.content,
      }));
      const res = await fetch(`${API_BASE}/api/v1/ai/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ original_message: lastReceivedMessage, draft_reply: replyText || '', thread_history: threadHistory }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplyText(data.enhanced);
      }
    } catch (err) {
      console.error('Enhance failed:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = (c.firstName + ' ' + c.lastName).toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'unread') return matchesSearch && !c.isRead;
    if (activeFilter === 'replied') return matchesSearch && c.status === 'REPLIED';
    return matchesSearch;
  });

  const syncLabel = isSyncing
    ? 'Syncing…'
    : onCooldown
      ? `Synced ${lastSyncedAt ? timeAgo(lastSyncedAt) : ''}`
      : 'Sync now';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        subtitle="Your LinkedIn conversations, synced automatically — daily and after each campaign."
      />

      {syncError && (
        <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-control font-medium">{syncError}</p>
      )}

      <Card className="overflow-hidden grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-200px)] min-h-[460px]">
        {/* Conversation list */}
        <div className={cn('border-r border-line flex flex-col min-h-0', selectedConvo && 'hidden md:flex')}>
          <div className="p-3 border-b border-line space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                placeholder="Search conversations"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface rounded-control pl-9 pr-3 py-2 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="flex bg-surface p-1 rounded-control">
              {(['all', 'unread', 'replied'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={cn('flex-1 py-1.5 text-[12px] font-semibold rounded-chip capitalize transition-colors',
                    activeFilter === f ? 'bg-card text-brand shadow-soft' : 'text-ink-500 hover:text-foreground')}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {conversations.length === 0 && !isLoading ? (
              <div className="h-full grid place-items-center p-6 text-center">
                <div>
                  <div className="w-14 h-14 rounded-control bg-surface text-ink-400 grid place-items-center mx-auto mb-4"><InboxIcon className="w-7 h-7" /></div>
                  <h3 className="font-bold text-foreground">No conversations yet</h3>
                  <p className="text-[13px] text-ink-500 font-medium mt-1.5 max-w-[220px]">Replies sync here automatically after your campaigns run. You can also pull now.</p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={handleSync} disabled={isSyncing || onCooldown}>
                    <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} /> {syncLabel}
                  </Button>
                </div>
              </div>
            ) : (
              filteredConversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConvo(convo)}
                  className={cn('w-full text-left p-3 flex gap-3 border-b border-line transition-colors',
                    selectedConvo?.id === convo.id ? 'bg-brand-50/60 border-l-2 border-l-brand' : 'hover:bg-[#faf9ff]')}
                >
                  <Avatar name={`${convo.firstName} ${convo.lastName}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-[13px] text-foreground truncate">{convo.firstName} {convo.lastName}</span>
                      <span className="text-[10px] text-ink-400 font-medium whitespace-nowrap">{convo.timestamp}</span>
                    </div>
                    <p className="text-[12px] text-ink-500 font-medium truncate mt-0.5">{convo.lastMessage}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={cn('flex flex-col min-h-0', !selectedConvo && 'hidden md:flex')}>
          {selectedConvo ? (
            <>
              <div className="px-5 py-3.5 border-b border-line flex items-center gap-3">
                <button onClick={() => setSelectedConvo(null)} className="md:hidden text-ink-400"><ArrowLeft className="w-5 h-5" /></button>
                <Avatar name={`${selectedConvo.firstName} ${selectedConvo.lastName}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] text-foreground truncate">{selectedConvo.firstName} {selectedConvo.lastName}</div>
                  <div className="text-[12px] text-ink-500 font-medium truncate">{selectedConvo.headline}</div>
                </div>
                <Badge tone={STATUS_TONE[selectedConvo.status] || 'neutral'}>{selectedConvo.status.charAt(0) + selectedConvo.status.slice(1).toLowerCase()}</Badge>
              </div>

              <div className="flex-1 p-5 overflow-y-auto bg-[#faf9fc] min-h-0">
                {isLoadingMessages ? (
                  <div className="h-full grid place-items-center"><RefreshCw className="w-6 h-6 animate-spin text-ink-300" /></div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg, idx) => (
                      <div key={msg.id || idx} className={cn('flex flex-col', msg.direction === 'SENT' ? 'items-end' : 'items-start')}>
                        <div className={cn('max-w-[75%] px-4 py-2.5 text-[13px] rounded-card',
                          msg.direction === 'SENT' ? 'bg-brand text-white rounded-tr-chip' : 'bg-card border border-line rounded-tl-chip')}>
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-ink-400 font-medium mt-1 px-1">{new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-line">
                <div className="flex items-end gap-2 bg-surface rounded-control p-2">
                  <button
                    onClick={handleEnhanceReply}
                    disabled={isEnhancing || !lastReceivedMessage}
                    title={lastReceivedMessage ? 'Let AI draft / polish this reply' : 'No incoming message to reply to yet'}
                    className="shrink-0 w-9 h-9 grid place-items-center rounded-chip bg-brand-50 text-brand hover:bg-brand-100 disabled:opacity-50 transition-colors"
                  >
                    {isEnhancing ? <div className="w-4 h-4 border-2 border-brand-200 border-t-brand rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </button>
                  <textarea
                    placeholder="Write a reply… or let AI draft it"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={1}
                    className="flex-1 bg-transparent outline-none text-[13px] font-medium resize-none py-1.5 max-h-32"
                  />
                  <button className="shrink-0 w-9 h-9 grid place-items-center rounded-chip bg-brand text-white hover:bg-brand-600 transition-colors"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full grid place-items-center p-12 text-center">
              <div>
                <div className="w-16 h-16 rounded-control bg-surface text-ink-400 grid place-items-center mx-auto mb-4"><MessageSquare className="w-8 h-8" /></div>
                <h3 className="font-bold text-foreground">Select a conversation</h3>
                <p className="text-[13px] text-ink-500 font-medium mt-1.5">Pick a thread on the left to read and reply.</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
