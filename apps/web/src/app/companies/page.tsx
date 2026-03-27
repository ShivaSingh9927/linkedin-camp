'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Target, 
  ArrowUpRight, 
  Search, 
  Briefcase, 
  ExternalLink,
  Loader2,
  TrendingUp,
  Globe,
  MessageCircle,
  CheckCircle2
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Company {
  id: string;
  name: string;
  totalLeads: number;
  statusCounts: {
    IMPORTED: number;
    PENDING: number;
    CONNECTED: number;
    REPLIED: number;
    BOUNCED: number;
  };
  sampleEmployees: string[];
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data } = await api.get('/leads/companies');
      setCompanies(data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header & Stats Summary */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-3 text-primary">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em]">Account Intelligence</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none uppercase">Market Ecosystem</h1>
          <p className="text-slate-500 font-bold max-w-lg text-sm uppercase tracking-widest leading-relaxed opacity-60">
            Strategic grouping of {companies.length} target organizations across your outreach landscape.
          </p>
        </div>

        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search Organizations..." 
            className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[2rem] shadow-soft focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-[4rem] p-32 text-center border border-slate-100 shadow-soft">
          <div className="w-24 h-24 bg-slate-50 rounded-[3rem] flex items-center justify-center mx-auto mb-8 border-4 border-dashed border-slate-200">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 uppercase">No Organizations Detected</h3>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">Import prospects with company data to populate this hub.</p>
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {filteredCompanies.map((company) => {
            const connectedRatio = company.totalLeads > 0 
              ? Math.round(((company.statusCounts.CONNECTED + company.statusCounts.REPLIED) / company.totalLeads) * 100) 
              : 0;
            
            return (
              <motion.div
                key={company.name}
                variants={item}
                className="group relative bg-white border border-slate-100 rounded-[3.5rem] p-10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden"
              >
                {/* Background Decoration */}
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/[0.02] rounded-full blur-3xl group-hover:bg-primary/[0.05] transition-colors duration-500" />
                
                <div className="relative space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center border border-slate-100 shadow-sm group-hover:scale-110 group-hover:rotate-[-3deg] transition-all duration-500 bg-gradient-to-br from-white to-slate-50">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black uppercase">
                        {company.name.charAt(0)}
                      </div>
                    </div>
                    
                    <Link 
                      href={`/prospects?company=${encodeURIComponent(company.name)}`}
                      className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all shadow-soft"
                    >
                      <ArrowUpRight className="w-5 h-5" />
                    </Link>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors truncate uppercase tracking-tight">
                      {company.name}
                    </h3>
                    <div className="flex items-center space-x-2 mt-2 opacity-50">
                      <Globe className="w-3 h-3" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{company.totalLeads} Identified Units</span>
                    </div>
                  </div>

                  {/* Status Bar */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Market Penetration</span>
                      <span className="text-xs font-black text-primary truncate leading-none">{connectedRatio}% REACHED</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${connectedRatio}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-primary rounded-full shadow-lg shadow-primary/20 relative overflow-hidden"
                      >
                         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                      </motion.div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl space-y-1">
                      <div className="flex items-center space-x-2 text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Connections</span>
                      </div>
                      <p className="text-xl font-black text-emerald-700">{company.statusCounts.CONNECTED + company.statusCounts.REPLIED}</p>
                    </div>
                    <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl space-y-1">
                      <div className="flex items-center space-x-2 text-blue-600">
                        <MessageCircle className="w-3 h-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Responses</span>
                      </div>
                      <p className="text-xl font-black text-blue-700">{company.statusCounts.REPLIED}</p>
                    </div>
                  </div>

                  {/* Sample Team */}
                  <div className="pt-4 border-t border-slate-50">
                    <div className="flex -space-x-3 overflow-hidden">
                      {company.sampleEmployees.map((name, i) => (
                        <div key={i} className="inline-block h-8 w-8 rounded-xl bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-600 shadow-sm" title={name}>
                          {name.split(' ').map(n => n[0]).join('')}
                        </div>
                      ))}
                      {company.totalLeads > 3 && (
                        <div className="inline-block h-8 w-8 rounded-xl bg-primary/10 border-2 border-white flex items-center justify-center text-[9px] font-black text-primary shadow-sm">
                          +{company.totalLeads - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
