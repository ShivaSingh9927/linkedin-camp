'use client';

import { useState } from 'react';
import { 
  BarChart3, 
  Users, 
  Send, 
  Zap, 
  ArrowUpRight, 
  Layout, 
  Target, 
  Clock, 
  Sparkles,
  ChevronRight,
  Plus,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { CampaignBuilder } from '@/components/CampaignBuilder';
import { TopBar } from '@/components/TopBar';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
       <TopBar 
          title="Orion Dashboard" 
          description="Track your performance and manage high-intent leads."
          action={
            <div className="flex items-center space-x-3">
              <div className="px-3 py-1.5 bg-slate-100 rounded-full flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Session Active</span>
              </div>
              <button className="flex items-center space-x-2 bg-primary text-white pl-4 pr-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:scale-95 group">
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                <span>New Campaign</span>
              </button>
            </div>
          }
       />

      <main className="flex-1 p-8 space-y-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Active Leads', value: '1,420', change: '+12.5%', icon: Users, color: 'text-primary' },
            { label: 'Sent Requests', value: '842', change: '+18.2%', icon: Target, color: 'text-emerald-500' },
            { label: 'Reply Rate', value: '24.8%', change: '+4.3%', icon: Zap, color: 'text-amber-500' },
            { label: 'Daily Remaining', value: '18/80', change: '82%', icon: Clock, color: 'text-blue-500' },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 group hover:border-primary/20 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-2xl bg-slate-50 group-hover:animate-bounce-slow", stat.color)}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <span className={cn(
                  "text-[10px] font-black px-2 py-1 rounded-full",
                  stat.change.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                )}>
                  {stat.change}
                </span>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Content Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
             <div className="flex bg-white p-2 rounded-[2rem] border shadow-sm w-fit">
                {['summary', 'builder', 'ai-insights'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-8 py-2.5 rounded-[1.5rem] text-sm font-bold uppercase tracking-wider transition-all",
                      activeTab === tab 
                        ? "bg-slate-900 text-white shadow-xl" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {tab.replace('-', ' ')}
                  </button>
                ))}
             </div>

             {activeTab === 'builder' ? (
                <CampaignBuilder />
             ) : (
                <div className="bg-white rounded-[3rem] border shadow-xl shadow-slate-200/50 overflow-hidden">
                  <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">Recent Performance</h3>
                      <p className="text-sm font-bold text-slate-400 mt-1">Daily engagement and response analytics.</p>
                    </div>
                    <button className="flex items-center space-x-2 text-primary font-black text-xs uppercase tracking-widest hover:underline">
                      <span>View Detailed Report</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-10 bg-slate-50/50 h-[400px] flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <BarChart3 className="w-16 h-16 text-slate-200 mx-auto" />
                      <p className="text-slate-400 font-bold">Chart visualization coming in next update.</p>
                    </div>
                  </div>
                </div>
             )}
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary to-blue-700 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-primary/20">
              <Sparkles className="absolute -right-4 -top-4 w-32 h-32 text-white/10" />
              <div className="relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">Pro Tip</span>
                <h3 className="text-2xl font-black mt-6 leading-tight">Increase your reply rate by 40%</h3>
                <p className="text-sm font-medium mt-4 text-white/80 leading-relaxed">
                  Connect your profile to use "Visit Before Invite" automation. It increases trust and visibility.
                </p>
                <button className="mt-8 flex items-center justify-between w-full bg-white text-primary px-8 py-4 rounded-[1.5rem] font-black group">
                  <span>Upgrade to advanced</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/50">
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6 px-2">Live Activity</h4>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start space-x-4 p-4 hover:bg-slate-50 rounded-3xl transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate"><span className="font-black">Sarah Johnson</span> accepted your invite</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">2 minutes ago</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-4 border-2 border-slate-100 rounded-[1.5rem] text-xs font-black text-slate-500 uppercase tracking-widest hover:border-primary hover:text-primary transition-all">
                View Full Feed
              </button>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
