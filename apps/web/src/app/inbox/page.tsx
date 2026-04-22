'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  RotateCcw, 
  ChevronRight, 
  RefreshCw, 
  MessageSquare,
  Sparkles,
  Inbox as InboxIcon,
  Filter,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TopBar } from '@/components/TopBar';

interface Conversation {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  avatarUrl?: string;
  lastMessage: string;
  timestamp: string;
  isRead: boolean;
  status: 'PENDING' | 'CONNECTED' | 'REPLIED' | 'FAILED';
}

// (Removing mock data)

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'replied'>('all');

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/v1/inbox/conversations', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      const mapped = data.map((c: any) => ({
        id: c.leadId,
        firstName: c.firstName || 'Unknown',
        lastName: c.lastName || '',
        headline: c.jobTitle ? `${c.jobTitle} at ${c.company}` : (c.headline || 'LinkedIn Member'),
        lastMessage: c.lastMessage?.content || 'No messages yet',
        timestamp: c.lastMessage ? new Date(c.lastMessage.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        isRead: true,
        status: c.status
      }));
      setConversations(mapped);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (leadId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/v1/inbox/conversations/${leadId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setMessages(data.messages || []);
      
      const receivedMessages = (data.messages || []).filter((m: any) => !m.isFromMe);
      if (receivedMessages.length > 0) {
        const lastReceived = receivedMessages[receivedMessages.length - 1];
        setLastReceivedMessage(lastReceived.content || '');
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConvo) {
      fetchMessages(selectedConvo.id);
    }
  }, [selectedConvo]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/v1/inbox/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        // Background sync takes time — auto-refresh in 30s
        setTimeout(fetchConversations, 30000);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const [replyText, setReplyText] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [lastReceivedMessage, setLastReceivedMessage] = useState('');

  const handleEnhanceReply = async () => {
    if (!selectedConvo || !lastReceivedMessage) return;
    
    setIsEnhancing(true);
    try {
      // Prepare the last 6 messages for context
      const threadHistory = messages.slice(-6).map(m => ({
        role: m.direction === 'SENT' ? 'assistant' : 'user',
        content: m.content
      }));

      const res = await fetch('/api/v1/ai/enhance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ 
          original_message: lastReceivedMessage,
          draft_reply: replyText || '',
          thread_history: threadHistory
        })
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

  const handleSendMessage = async () => {
    if (!selectedConvo || !replyText.trim()) return;
    try {
      const res = await fetch(`/api/v1/inbox/conversations/${selectedConvo.id}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ content: replyText })
      });
      if (res.ok) {
        setReplyText('');
        fetchMessages(selectedConvo.id);
      }
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = (c.firstName + ' ' + c.lastName).toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'unread') return matchesSearch && !c.isRead;
    if (activeFilter === 'replied') return matchesSearch && c.status === 'REPLIED';
    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <TopBar 
        title="Inbox" 
        description="Manage your LinkedIn conversations in one place."
        action={
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setIsLoading(true); fetchConversations(); }}
              className="flex items-center space-x-2 bg-white border text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
              <span>{isSyncing ? "Syncing..." : "Sync LinkedIn"}</span>
            </button>
          </div>
        }
      />
      <main className="flex-1 flex overflow-hidden p-3 sm:p-6 gap-6 relative">
        {/* Convo List - Hidden on mobile if a conversation is selected */}
        <div className={cn(
          "w-full md:w-96 flex flex-col bg-white rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden transition-all",
          selectedConvo && "hidden md:flex"
        )}>
          <div className="p-4 border-b space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>
            
            <div className="flex bg-slate-50 p-1 rounded-xl">
              {['all', 'unread', 'replied'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter as any)}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg capitalize transition-all",
                    activeFilter === filter 
                      ? "bg-white text-primary shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {conversations.length === 0 && !isLoading ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-soft flex items-center justify-center mb-4 text-slate-300">
                  <InboxIcon className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800">No conversations yet</h3>
                <button 
                  onClick={handleSync}
                  className="mt-6 text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Sync Inbox</span>
                </button>
              </div>
            ) : filteredConversations.map((convo) => (
              <motion.div
                key={convo.id}
                layoutId={convo.id}
                onClick={() => setSelectedConvo(convo)}
                className={cn(
                  "p-4 cursor-pointer transition-all hover:bg-slate-50 group relative border-b border-slate-50",
                  selectedConvo?.id === convo.id && "bg-primary/5",
                  !convo.isRead && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary"
                )}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm font-bold text-slate-400">
                      {convo.firstName[0]}
                    </div>
                    {convo.status === 'REPLIED' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-accent rounded-full border-2 border-white flex items-center justify-center">
                        <CheckCheck className="w-2 h-2 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={cn("text-xs sm:text-sm truncate", !convo.isRead ? "font-bold text-slate-900" : "font-medium text-slate-700")}>
                        {convo.firstName} {convo.lastName}
                      </h4>
                      <span className="text-[9px] text-slate-400 whitespace-nowrap ml-2">
                        {convo.timestamp}
                      </span>
                    </div>
                    <p className={cn("text-[10px] sm:text-xs truncate mt-1", !convo.isRead ? "text-slate-900 font-medium" : "text-slate-500")}>
                      {convo.lastMessage}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Conversation View */}
        <div className={cn(
          "flex-1 bg-white rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col relative overflow-hidden transition-all",
          !selectedConvo && "hidden md:flex"
        )}>
          {selectedConvo ? (
            <>
              {/* Convo Header */}
              <div className="p-3 sm:p-5 border-b flex items-center justify-between">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <button 
                    onClick={() => setSelectedConvo(null)}
                    className="md:hidden p-2 -ml-2 text-slate-400 hover:text-primary transition-colors"
                  >
                    <RotateCcw className="w-5 h-5 rotate-180" />
                  </button>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">
                    {selectedConvo.firstName[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">{selectedConvo.firstName} {selectedConvo.lastName}</h3>
                    <p className="text-[10px] sm:text-xs text-primary font-bold truncate">{selectedConvo.headline}</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center space-x-1">
                  <button className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-primary/5 rounded-xl">
                    <Users className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-primary/5 rounded-xl">
                    <MessageSquare className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages Content */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50/30">
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-300" />
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    {messages.map((msg, idx) => (
                      <div 
                        key={msg.id || idx} 
                        className={cn("flex flex-col space-y-1.5", msg.direction === 'SENT' ? "items-end" : "items-start")}
                      >
                        <div className={cn(
                          "max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-sm",
                          msg.direction === 'SENT' 
                            ? "bg-primary text-white rounded-tr-none shadow-lg shadow-primary/20" 
                            : "bg-white text-slate-700 rounded-tl-none border"
                        )}>
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium px-1">
                          {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Box */}
              <div className="p-3 sm:p-6 sm:pt-2 border-t sm:border-t-0">
                <div className="relative group">
                  <textarea 
                    placeholder="Type a message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full p-3 sm:p-4 pr-20 sm:pr-32 bg-slate-50 border-none rounded-2xl sm:rounded-3xl text-xs sm:text-sm focus:ring-2 focus:ring-primary/20 min-h-[80px] sm:min-h-[100px] resize-none transition-all"
                  />
                  <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 flex items-center gap-1.5">
                    <button 
                      onClick={handleEnhanceReply}
                      disabled={isEnhancing || !lastReceivedMessage}
                      className="bg-purple-100 text-purple-600 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-sm hover:bg-purple-200 transition-all disabled:opacity-50 flex items-center gap-1 text-[10px] font-black uppercase tracking-tight"
                    >
                      {isEnhancing ? (
                        <div className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden xs:inline">{replyText ? 'Fix' : 'AI'}</span>
                    </button>
                    <button 
                      onClick={handleSendMessage}
                      className="bg-primary text-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all"
                    >
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="font-bold text-lg text-slate-800">Select a conversation</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
