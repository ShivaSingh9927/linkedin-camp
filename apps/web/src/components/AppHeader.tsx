'use client';

import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertCircle, Loader2, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { cn } from '@/lib/utils';
import LinkedInConnectivity from './LinkedInConnectivity';

/**
 * Slim top bar for the sidebar layout: search + LinkedIn connectivity +
 * real-time notifications. The notification socket logic is migrated verbatim
 * from the old TopNav (which the sidebar layout replaces).
 */
export function AppHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
    const newSocket: Socket = io(apiBase);
    const token = localStorage.getItem('token');
    if (token) newSocket.emit('join_room', { token });
    newSocket.on('campaign_activity', (data: any) => {
      setActivities((prev) => [data, ...prev].slice(0, 20));
      setUnreadCount((prev) => prev + 1);
    });
    return () => { newSocket.disconnect(); };
  }, []);

  return (
    <header className="h-16 bg-background/80 backdrop-blur border-b border-line sticky top-0 z-20 flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Mobile menu trigger */}
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="lg:hidden w-9 h-9 grid place-items-center rounded-control text-ink-600 hover:bg-surface shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <LinkedInConnectivity />

        <div className="relative">
          <button
            onClick={() => { setShowNotifications((v) => !v); setUnreadCount(0); }}
            className={cn('w-9 h-9 grid place-items-center rounded-control transition-colors relative',
              showNotifications ? 'bg-brand-50 text-brand' : 'text-ink-500 hover:bg-surface')}
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-background" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  className="absolute top-full right-0 mt-2 w-80 bg-card border border-line rounded-card shadow-lift z-50 overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                    <h3 className="font-bold text-foreground">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-chip">{unreadCount} new</span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {activities.length === 0 ? (
                      <div className="text-center py-12 text-ink-400">
                        <Bell className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-[13px] font-semibold">No activity yet</p>
                        <p className="text-[12px] mt-1 font-medium">Start a campaign to see updates</p>
                      </div>
                    ) : activities.slice(0, 10).map((a: any, idx: number) => {
                      const isSuccess = a.action === 'success';
                      const isFailed = a.action === 'failed';
                      return (
                        <div key={idx} className="flex items-start gap-3 p-3 hover:bg-surface rounded-control transition-colors">
                          <div className={cn('w-9 h-9 rounded-control grid place-items-center shrink-0',
                            isSuccess ? 'bg-emerald-50 text-emerald-600' : isFailed ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand')}>
                            {a.action === 'executing' ? <Loader2 className="w-4 h-4 animate-spin" /> : isSuccess ? <CheckCircle2 className="w-4 h-4" /> : isFailed ? <AlertCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-foreground truncate">
                              {a.node === 'profile-visit' ? 'Profile visited' : a.node === 'connect' ? 'Connection sent' : a.node === 'send-message' ? 'Message sent' : a.node === 'like-nth-post' ? 'Post liked' : a.node === 'comment-nth-post' ? 'Comment added' : a.node}
                            </p>
                            <p className="text-[12px] text-ink-500 font-medium truncate">{a.leadName}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
