'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Loader2,
  CheckCircle2,
  MessageCircle,
  ArrowUpRight,
  Rocket,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, EmptyState, PageHeader } from '@/components/ui';

interface Company {
  id: string; // normalized grouping key (stable across spelling variants)
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

// Mirror the backend's company normalization so multi-company launch matches
// the same leads the grouping used.
const normalizeCompany = (raw?: string | null) =>
  (raw || '')
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(inc|incorporated|llc|llp|ltd|limited|corp|corporation|co|company|gmbh|pvt|private|plc|sa|ag|bv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState(false);
  const router = useRouter();

  useEffect(() => { fetchCompanies(); }, []);

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

  const filtered = companies.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedCompanies = companies.filter(c => selected.has(c.id));
  const selectedLeadTotal = selectedCompanies.reduce((n, c) => n + c.totalLeads, 0);

  // Launch a campaign for one company → carry the company name; the builder
  // pre-selects its leads after a template is picked.
  const launchOne = (name: string) => {
    router.push(`/campaigns?company=${encodeURIComponent(name)}&create=1`);
  };

  // Launch for several companies at once → resolve every matching lead id, then
  // hand off to the templates gallery with that lead set pre-selected.
  const launchSelected = async () => {
    if (!selectedCompanies.length) return;
    setLaunching(true);
    try {
      const keys = new Set(selectedCompanies.map(c => c.id));
      const res = await api.get('/leads');
      const leads = res.data.leads || res.data || [];
      const ids = (Array.isArray(leads) ? leads : [])
        .filter((l: any) => keys.has(normalizeCompany(l.company)))
        .map((l: any) => l.id);
      if (!ids.length) { setLaunching(false); return; }
      router.push(`/campaigns?leadIds=${ids.join(',')}&view=templates`);
    } catch {
      setLaunching(false);
    }
  };

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="w-8 h-8 text-brand animate-spin" />
    </div>
  );

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader
        eyebrow="By company"
        title="Companies"
        subtitle={`Your leads grouped by company · ${companies.length} ${companies.length === 1 ? 'company' : 'companies'}.`}
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-line rounded-control pl-9 pr-3 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        }
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-ink-900 text-white rounded-control px-4 py-2.5 flex items-center gap-3 mb-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-[13px] font-semibold">{selected.size} {selected.size === 1 ? 'company' : 'companies'} · {selectedLeadTotal} leads</span>
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={launchSelected}
            disabled={launching}
            className="text-[13px] font-bold flex items-center gap-1.5 bg-brand text-white px-3.5 py-1.5 rounded-control hover:bg-brand-600 transition-colors shadow-lift disabled:opacity-60"
          >
            {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Launch campaign
          </button>
          <button onClick={() => setSelected(new Set())} className="text-[13px] font-semibold flex items-center gap-1.5 hover:text-brand-200 transition-colors ml-auto">
            <X className="w-4 h-4" />Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Import leads with a company to see them grouped here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((company) => {
            const reached = company.totalLeads > 0
              ? Math.round(((company.statusCounts.CONNECTED + company.statusCounts.REPLIED) / company.totalLeads) * 100)
              : 0;
            const isSelected = selected.has(company.id);
            return (
              <Card
                key={company.id}
                interactive
                className={cn('p-5 relative', isSelected && 'border-brand-200 ring-2 ring-brand/20')}
              >
                <div className="flex items-start justify-between mb-4">
                  <button
                    onClick={() => toggle(company.id)}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    {isSelected
                      ? <CheckSquare className="w-5 h-5 text-brand flex-shrink-0" />
                      : <Square className="w-5 h-5 text-ink-300 flex-shrink-0" />}
                    <div className="w-9 h-9 rounded-control bg-brand-50 text-brand grid place-items-center font-bold uppercase flex-shrink-0">
                      {company.name.charAt(0)}
                    </div>
                  </button>
                  <Link
                    href={`/prospects?company=${encodeURIComponent(company.name)}`}
                    className="w-8 h-8 rounded-control bg-surface grid place-items-center text-ink-400 hover:text-brand hover:bg-brand-50 transition-colors"
                    title="View prospects"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>

                <h3 className="font-semibold text-foreground truncate">{company.name}</h3>
                <p className="text-[12px] font-medium text-ink-400 mt-0.5">
                  {company.totalLeads} {company.totalLeads === 1 ? 'lead' : 'leads'}
                </p>

                {/* Reached progress */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="label">Reached</span>
                    <span className="text-[12px] font-bold text-brand">{reached}%</span>
                  </div>
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${reached}%` }} />
                  </div>
                </div>

                {/* Disjoint funnel stats */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="rounded-control bg-emerald-50/60 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="w-3 h-3" /><span className="text-[10px] font-bold uppercase tracking-wide">Connected</span></div>
                    <p className="text-base font-bold text-emerald-700 mt-0.5">{company.statusCounts.CONNECTED}</p>
                  </div>
                  <div className="rounded-control bg-blue-50/60 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-blue-600"><MessageCircle className="w-3 h-3" /><span className="text-[10px] font-bold uppercase tracking-wide">Replied</span></div>
                    <p className="text-base font-bold text-blue-700 mt-0.5">{company.statusCounts.REPLIED}</p>
                  </div>
                </div>

                <Button variant="outline" className="w-full mt-4" onClick={() => launchOne(company.name)}>
                  <Rocket className="w-4 h-4" />
                  Launch campaign
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
