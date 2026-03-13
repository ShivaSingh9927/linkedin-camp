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

const mockConversations: Conversation[] = [
  {
    id: '1',
    firstName: 'Alex',
    lastName: 'Rivera',
    headline: 'Senior Cloud Architect at AWS',
    lastMessage: 'Hey! I saw your profile and would love to connect...',
    timestamp: '10:45 AM',
    isRead: false,
    status: 'REPLIED'
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Chen',
    headline: 'Product Lead @ Google',
    lastMessage: 'Thanks for reaching out. Let me check my schedule.',
    timestamp: 'Yesterday',
    isRead: true,
    status: 'CONNECTED'
  }
];

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'replied'>('all');

  const handleSync = async () => {
    setIsSyncing(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 2000));
    setConversations(mockConversations);
    setIsSyncing(false);
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
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            <span>{isSyncing ? "Syncing..." : "Sync LinkedIn"}</span>
          </button>
        }
      />

      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Convo List */}
        <div className="w-96 flex flex-col bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>
            
            <div className="flex bg-slate-50 p-1 rounded-2xl">
              {['all', 'unread', 'replied'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter as any)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-xl capitalize transition-all",
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

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-soft flex items-center justify-center mb-4 text-slate-300">
                  <InboxIcon className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800">No conversations yet</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-[200px]">
                  Sync your LinkedIn account to see your messages.
                </p>
                <button 
                  onClick={handleSync}
                  className="mt-6 text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                >
                  <Sparkles className="w-4 h-4" />
                  Primary Inbox Sync
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredConversations.map((convo) => (
                  <motion.div
                    key={convo.id}
                    layoutId={convo.id}
                    onClick={() => setSelectedConvo(convo)}
                    className={cn(
                      "p-4 cursor-pointer transition-all hover:bg-slate-50 group relative",
                      selectedConvo?.id === convo.id && "bg-primary/5",
                      !convo.isRead && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary"
                    )}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                          {convo.avatarUrl ? (
                            <img src={convo.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-slate-400 font-bold">{convo.firstName[0]}</span>
                          )}
                        </div>
                        {convo.status === 'REPLIED' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-accent rounded-full border-2 border-white flex items-center justify-center">
                            <CheckCheck className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className={cn("text-sm truncate", !convo.isRead ? "font-bold text-slate-900" : "font-medium text-slate-700")}>
                            {convo.firstName} {convo.lastName}
                          </h4>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                            {convo.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{convo.headline}</p>
                        <p className={cn("text-xs truncate mt-2", !convo.isRead ? "text-slate-900 font-medium" : "text-slate-500")}>
                          {convo.lastMessage}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conversation View */}
        <div className="flex-1 bg-white rounded-3xl border shadow-sm flex flex-col relative overflow-hidden">
          {selectedConvo ? (
            <>
              {/* Convo Header */}
              <div className="p-5 border-b flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                    {selectedConvo.firstName[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{selectedConvo.firstName} {selectedConvo.lastName}</h3>
                    <p className="text-xs text-primary font-bold">{selectedConvo.headline}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-primary/5 rounded-xl">
                    <Users className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-primary/5 rounded-xl">
                    <MessageSquare className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages Content */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <span className="bg-slate-200/50 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Conversation Started
                    </span>
                  </div>
                  
                  {/* Mock message bubble */}
                  <div className="flex flex-col space-y-2">
                    <div className="max-w-[80%] bg-white p-4 rounded-2xl rounded-tl-none border shadow-sm text-sm text-slate-700">
                      {selectedConvo.lastMessage}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium ml-1">10:45 AM</span>
                  </div>

                  <div className="flex flex-col items-end space-y-2">
                    <div className="max-w-[80%] bg-primary text-white p-4 rounded-2xl rounded-tr-none shadow-lg shadow-primary/20 text-sm font-medium">
                      Hey {selectedConvo.firstName}, thanks for reaching out! I'd love to chat more about how we can help.
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mr-1">10:48 AM</span>
                  </div>
                </div>
              </div>

              {/* Reply Box */}
              <div className="p-6 pt-2">
                <div className="relative group">
                  <textarea 
                    placeholder="Type a message..."
                    className="w-full p-4 pr-16 bg-slate-50 border-none rounded-3xl text-sm focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none transition-all group-focus-within:bg-white group-focus-within:shadow-xl"
                  />
                  <button className="absolute bottom-4 right-4 bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95">
                    <Sparkles className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-4">
                    <button className="hover:text-primary font-bold flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5" />
                      Templates
                    </button>
                    <button className="hover:text-primary font-bold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Variables
                    </button>
                  </div>
                  <span className="font-medium">ESC to cancel • ENTER to send</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-12 h-12 text-slate-200" />
              </div>
              <h3 className="font-bold text-xl text-slate-800">Select a conversation</h3>
              <p className="text-slate-500 mt-2 max-w-sm">
                Choose a conversation from the left to start chatting or manage leads.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
