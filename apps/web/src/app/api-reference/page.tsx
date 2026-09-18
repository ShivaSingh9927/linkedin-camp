'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink, Menu, Search, Terminal } from 'lucide-react';
import { toast } from 'sonner';

const baseUrl = 'https://api.qampi.com/api/public/v1';
const curlExample = ['curl https://api.qampi.com/api/public/v1/me \\', '  -H "Authorization: Bearer qampi_live_…"'].join('\n');
const pythonExample = ['import requests', '', 'response = requests.get(', '    "https://api.qampi.com/api/public/v1/me",', '    headers={"Authorization": "Bearer qampi_live_…"},', ')', '', 'account = response.json()', 'print(account["linkedin"]["health"])'].join('\n');
const responseExample = ['{', '  "id": "usr_1",', '  "email": "you@company.com",', '  "tier": "PRO",', '  "onboardingComplete": true,', '  "linkedin": { "connected": true, "health": "HEALTHY" }', '}'].join('\n');
const mcpExample = ['[mcp_servers.qampi]', 'command = "npx"', 'args = ["-y", "@qampi/mcp-server"]', 'env = { QAMPI_API_KEY = "qampi_live_…" }'].join('\n');

const groups: Array<[string, Array<{ label: string; id: string }>]> = [
    ['Quick start', [{ label: 'Your first API call', id: 'quick-start' }, { label: 'Authentication', id: 'authentication' }, { label: 'Rate limits', id: 'rate-limits' }, { label: 'Error codes', id: 'error-codes' }]],
    ['API guides', [{ label: 'Campaigns', id: 'guides-campaigns' }, { label: 'Leads', id: 'guides-leads' }, { label: 'Search & enrich', id: 'search-enrich' }, { label: 'Webhooks', id: 'webhooks' }]],
    ['AI integrations', [{ label: 'MCP server', id: 'mcp' }, { label: 'Codex', id: 'codex' }, { label: 'Claude Code', id: 'claude-code' }, { label: 'Cursor', id: 'cursor' }]],
    ['API reference', [{ label: 'Account', id: 'account' }, { label: 'Templates', id: 'templates' }, { label: 'Campaigns', id: 'campaigns' }, { label: 'Leads', id: 'leads' }, { label: 'Webhooks', id: 'reference-webhooks' }]],
];

export default function ApiReferencePage() {
    const [language, setLanguage] = useState('cURL');
    const [copied, setCopied] = useState(false);
    const [query, setQuery] = useState('');
    const [activeSection, setActiveSection] = useState('quick-start');
    const activeCode = language === 'cURL' ? curlExample : pythonExample;
    const filteredGroups = useMemo(() => groups.map(([group, items]) => [group, items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))] as const).filter(([, items]) => items.length > 0), [query]);
    const copy = async (value: string) => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success('Code copied');
        window.setTimeout(() => setCopied(false), 1600);
    };

    return (
        <div className="min-h-screen bg-white text-[#1e2026]">
            <header className="sticky top-0 z-30 h-[72px] border-b border-[#e8e9ed] bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-5 sm:px-7">
                    <Link href="/api-reference" className="flex items-center gap-3">
                        <Image src="/qampi_wbg.png" alt="Qampi" width={40} height={40} className="h-10 w-10 object-contain" priority />
                        <div><div className="text-[16px] font-bold tracking-[-0.03em]">Qampi API Docs</div><div className="text-[10px] font-medium text-[#8a8e9b]">Developer documentation</div></div>
                    </Link>
                    <div className="hidden items-center gap-6 text-[13px] font-medium text-[#555966] md:flex"><a href="#quick-start" className="hover:text-brand">Guides</a><a href="#account" className="hover:text-brand">Reference</a><a href="#mcp" className="hover:text-brand">MCP</a><Link href="/settings?tab=api" className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-2 text-ink-700 hover:bg-surface">API keys <ExternalLink className="h-3.5 w-3.5" /></Link></div>
                    <Menu className="h-5 w-5 text-[#5b6172] md:hidden" />
                </div>
            </header>
            <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)_210px]">
                <aside className="hidden h-[calc(100vh-72px)] overflow-y-auto border-r border-[#e8e9ed] px-4 py-5 lg:block">
                    <div className="relative mb-5"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8e9b]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation" className="w-full rounded-control border border-line bg-[#f8f8fa] py-2.5 pl-9 pr-3 text-[12px] outline-none placeholder:text-[#9296a2] focus:border-brand" /></div>
                    <nav className="space-y-5">{filteredGroups.map(([group, items]) => <div key={group}><div className="mb-1 flex items-center justify-between px-2 text-[13px] font-semibold text-[#59606e]">{group}<ChevronDown className="h-3.5 w-3.5" /></div>{items.map((item) => <a key={item.id} href={'#' + item.id} onClick={() => setActiveSection(item.id)} className={activeSection === item.id ? 'block rounded-chip bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-700' : 'block rounded-chip px-3 py-1.5 text-[13px] text-[#68707e] hover:bg-[#f7f7fb] hover:text-[#232630]'}>{item.label}</a>)}</div>)}</nav>
                    <a href={baseUrl + '/openapi.json'} target="_blank" rel="noreferrer" className="mt-8 flex items-center gap-2 border-t border-line px-2 pt-5 text-[12px] text-[#858b97] hover:text-brand"><Terminal className="h-3.5 w-3.5" /> Download OpenAPI spec</a>
                </aside>
                <main className="min-w-0 px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
                    <article className="mx-auto max-w-[760px]">
                        <div className="mb-7 flex items-center gap-2 text-[12px] text-[#808694]"><span>Docs</span><ChevronRight className="h-3.5 w-3.5" /><span>Quick start</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-brand-700">Your first API call</span></div>
                        <section id="quick-start"><div className="inline-flex items-center gap-2 rounded-chip border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand" /> API v1</div><h1 className="mt-5 text-[38px] font-bold leading-[1.08] tracking-[-0.045em] text-[#1a1c23] sm:text-[48px]">Your first Qampi API call</h1><p className="mt-5 text-[16px] leading-7 text-[#555b68]">Use the Qampi API to bring campaign workflows, leads, and outcomes into your own product. This quick start verifies your account connection in one request.</p></section>
                        <section className="mt-10 rounded-card border border-[#d9ccff] bg-[#faf8ff] p-5"><div className="flex gap-3"><div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-bold text-white">i</div><div><h2 className="text-[15px] font-bold text-[#292039]">Before you begin</h2><p className="mt-1 text-[13px] leading-6 text-[#5e5970]">API access is available on Pro and Business plans. Create a key in <Link href="/settings?tab=api" className="font-semibold text-brand-700 underline underline-offset-2">Settings → API keys</Link>; Qampi only shows the full key once.</p></div></div></section>
                        <DocStep id="authentication" number="1" title="Create an API key"><p>Give each integration its own key so you can revoke it without affecting another workflow.</p><div className="mt-4 flex items-center gap-3 rounded-control border border-line bg-[#fbfbfc] px-4 py-3 text-[13px]"><span className="font-mono text-[#626977]">qampi_live_••••••••••••••••</span><span className="ml-auto rounded-chip bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">Active</span></div></DocStep>
                        <DocStep id="make-request" number="2" title="Make a request"><p>Pass the key in the Authorization header. Start with GET /me to confirm your account and LinkedIn session are ready.</p></DocStep>
                        <div className="mt-5 overflow-hidden rounded-card border border-[#e4e6ea] bg-[#f7f8fa]"><div className="flex items-center justify-between border-b border-[#e4e6ea] bg-white px-4 py-2.5"><div className="flex gap-1"><button onClick={() => setLanguage('cURL')} className={language === 'cURL' ? 'rounded-chip bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700' : 'rounded-chip px-3 py-1.5 text-[12px] font-semibold text-[#777d89]'}>cURL</button><button onClick={() => setLanguage('Python')} className={language === 'Python' ? 'rounded-chip bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700' : 'rounded-chip px-3 py-1.5 text-[12px] font-semibold text-[#777d89]'}>Python</button></div><button onClick={() => copy(activeCode)} aria-label="Copy example" className="grid h-8 w-8 place-items-center rounded-chip text-[#737988] hover:bg-surface hover:text-brand">{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button></div><pre className="overflow-x-auto px-5 py-5 font-mono text-[12px] leading-6 text-[#343944]"><code>{activeCode}</code></pre></div>
                        <DocStep id="read-response" number="3" title="Read the response"><p>A successful response includes your plan, onboarding state, and LinkedIn connection health. Use this check before starting a campaign from an external workflow.</p></DocStep>
                        <CodePanel title="Response · 200 OK" value={responseExample} onCopy={copy} />
                        <DocSection id="rate-limits" title="Rate limits" body="Each API key can make up to 120 requests per minute. When you exceed the limit, the API returns 429 RATE_LIMITED. Keep retries exponential and respect the reset time when it is included in the response." />
                        <DocSection id="error-codes" title="Error codes" body="Every error includes a stable error code and an actionable message. Common setup responses are ONBOARDING_INCOMPLETE, UPGRADE_REQUIRED, LINKEDIN_SESSION_EXPIRED, EMAIL_ACCOUNT_REQUIRED, and QUOTA_EXCEEDED." />
                        <DocSection id="guides-campaigns" title="Campaigns" body="Campaigns are template-based. List templates first, then create a campaign from a chosen template. A launch checks your LinkedIn session, connected email account when needed, quotas, and active-campaign status." endpoints={['GET /templates', 'POST /campaigns/from-template', 'POST /campaigns/{id}/launch']} />
                        <DocSection id="guides-leads" title="Leads" body="Import one lead or up to 100 leads in one request. Qampi deduplicates LinkedIn URLs and preserves enrichment. You can update tags and notes, while campaign status remains managed by Qampi." endpoints={['GET /leads', 'POST /leads', 'PATCH /leads/{id}']} />
                        <DocSection id="search-enrich" title="Search & enrich" body="Search for LinkedIn people with keywords and filters, or find a work email using a person’s name and company. These calls use your plan’s search and email-finder credits." endpoints={['POST /search/people', 'POST /enrich/email']} />
                        <DocSection id="webhooks" title="Webhooks" body="Register a webhook to receive lead lifecycle events. Save the signing secret returned during creation and verify every X-Qampi-Signature against the raw request body." endpoints={['GET /webhooks/events', 'POST /webhooks', 'POST /webhooks/{id}/test']} />
                        <section id="mcp" className="mt-14 scroll-mt-24 border-t border-line pt-12"><div className="inline-flex items-center gap-2 text-[12px] font-semibold text-brand-700"><Terminal className="h-3.5 w-3.5" /> AI integrations</div><h2 className="mt-3 text-[30px] font-bold tracking-[-0.04em] text-[#1a1c23]">Use Qampi through MCP</h2><p className="mt-3 text-[15px] leading-7 text-[#555b68]">The Qampi MCP server connects Codex, Claude Code, and Cursor to the same API. It starts read-only; write tools are unavailable until you deliberately set QAMPI_MODE=full.</p><CodePanel title="Codex · ~/.codex/config.toml" value={mcpExample} onCopy={copy} /></section>
                        <DocSection id="codex" title="Connect from Codex" body="Add the MCP configuration above to ~/.codex/config.toml, replace the API key, and restart Codex. Qampi tools will appear in your available tool list." />
                        <DocSection id="claude-code" title="Connect from Claude Code" body="Add the same server command and QAMPI_API_KEY environment variable to your Claude Code MCP settings, then start a new session to load the server." />
                        <DocSection id="cursor" title="Connect from Cursor" body="Open Cursor settings, add an MCP server using npx -y @qampi/mcp-server, supply QAMPI_API_KEY, then reload the editor window." />
                        <DocSection id="account" title="Account reference" body="Use the account endpoints to identify the current workspace and see remaining invite, search, and email credits. The /me endpoint works before onboarding is complete to help diagnose setup." endpoints={['GET /me', 'GET /usage']} />
                        <DocSection id="templates" title="Templates reference" body="Templates expose their supported channels, required plan, required account connections, campaign duration, and the content fields you can override." endpoints={['GET /templates', 'GET /templates/{id}']} />
                        <DocSection id="campaigns" title="Campaigns reference" body="Create a campaign from a template, inspect its funnel, enroll leads, and launch it after the Qampi preflight checks pass." endpoints={['GET /campaigns', 'GET /campaigns/{id}', 'GET /campaigns/{id}/leads']} />
                        <DocSection id="leads" title="Leads reference" body="List, import, inspect, and tag leads. Lead statuses are calculated by the campaign engine and cannot be set through the API." endpoints={['GET /leads', 'GET /leads/{id}', 'POST /leads']} />
                        <DocSection id="reference-webhooks" title="Webhooks reference" body="List registered destinations, create a new signed subscription, send a test event, or remove a webhook no longer in use." endpoints={['GET /webhooks', 'POST /webhooks', 'DELETE /webhooks/{id}']} />
                    </article>
                </main>
                <aside className="hidden border-l border-[#e8e9ed] px-6 py-11 xl:block"><div className="sticky top-24 border-l border-line pl-4"><div className="mb-3 text-[12px] font-semibold text-brand-700">On this page</div><a href="#quick-start" className="mb-2 block text-[12px] text-[#747b88] hover:text-brand">Before you begin</a><a href="#authentication" className="mb-2 block text-[12px] text-[#747b88] hover:text-brand">Create an API key</a><a href="#make-request" className="mb-2 block text-[12px] text-[#747b88] hover:text-brand">Make a request</a><a href="#mcp" className="mb-2 block text-[12px] text-[#747b88] hover:text-brand">Use Qampi through MCP</a></div></aside>
            </div>
            <footer className="border-t border-line bg-[#fbfbfd] py-8 text-center text-[12px] text-[#858b97]">Qampi API v1 · <a className="text-brand-700 hover:underline" href={baseUrl + '/openapi.json'} target="_blank" rel="noreferrer">OpenAPI specification</a></footer>
        </div>
    );
}

function DocStep({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
    return <section id={id} className="mt-12 flex scroll-mt-24 gap-4"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1e2026] text-[12px] font-bold text-white">{number}</div><div><h2 className="pt-0.5 text-[23px] font-bold tracking-[-0.03em] text-[#20222a]">{title}</h2><div className="mt-2 text-[14px] leading-6 text-[#59606d]">{children}</div></div></section>;
}

function DocSection({ id, title, body, endpoints }: { id: string; title: string; body: string; endpoints?: string[] }) {
    return <section id={id} className="mt-14 scroll-mt-24 border-t border-line pt-12"><h2 className="text-[30px] font-bold tracking-[-0.04em] text-[#1a1c23]">{title}</h2><p className="mt-3 max-w-[680px] text-[15px] leading-7 text-[#555b68]">{body}</p>{endpoints && <div className="mt-5 grid gap-2">{endpoints.map((endpoint) => <div key={endpoint} className="rounded-control border border-[#e4e6ea] bg-[#fbfbfc] px-4 py-3 font-mono text-[12px] font-medium text-[#3b4150]">{endpoint}</div>)}</div>}</section>;
}

function CodePanel({ title, value, onCopy }: { title: string; value: string; onCopy: (value: string) => void }) {
    return <div className="mt-5 overflow-hidden rounded-card border border-[#e4e6ea]"><div className="flex items-center justify-between border-b border-[#e4e6ea] bg-[#fbfbfc] px-4 py-3"><span className="text-[12px] font-semibold text-[#4e5562]">{title}</span><button onClick={() => onCopy(value)} aria-label={'Copy ' + title} className="grid h-7 w-7 place-items-center rounded-chip text-[#737988] hover:bg-white hover:text-brand"><Copy className="h-3.5 w-3.5" /></button></div><pre className="overflow-x-auto bg-[#f7f8fa] px-5 py-5 font-mono text-[12px] leading-6 text-[#343944]"><code>{value}</code></pre></div>;
}
