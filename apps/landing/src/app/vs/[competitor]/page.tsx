import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CTASection } from '@/components/CTASection';
import { competitors, getCompetitor } from '@/content/competitors';

const BASE_URL = 'https://qampi.com';

export function generateStaticParams() {
  return competitors.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>;
}): Promise<Metadata> {
  const { competitor } = await params;
  const c = getCompetitor(competitor);
  if (!c) return {};
  const url = `${BASE_URL}/vs/${c.slug}`;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `/vs/${c.slug}` },
    openGraph: {
      type: 'website',
      url,
      title: c.metaTitle,
      description: c.metaDescription,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: c.h1 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: c.metaTitle,
      description: c.metaDescription,
      images: ['/og-image.png'],
    },
  };
}

export default async function VersusPage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = await params;
  const c = getCompetitor(competitor);
  if (!c) notFound();

  const url = `${BASE_URL}/vs/${c.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: c.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: `Qampi vs ${c.name}`, item: url },
        ],
      },
    ],
  };

  const others = competitors.filter((x) => x.slug !== c.slug);

  return (
    <main className="min-h-screen bg-purple-50/20 text-slate-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-36 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-100">
            <Sparkles className="w-3.5 h-3.5" />
            {c.category} comparison
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.05] text-balance">
            {c.h1}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
            {c.subhead}
          </p>
          <div className="mt-9">
            <a
              href="https://app.qampi.com/register"
              className="inline-flex items-center justify-center gap-2 btn-primary px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-blue-200 hover:-translate-y-0.5 transition-all"
            >
              Try Qampi Free <ArrowRight className="w-4.5 h-4.5" />
            </a>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-5 text-xs font-black uppercase tracking-widest text-slate-400">Feature</th>
                  <th className="p-5 text-sm font-black text-indigo-600">Qampi</th>
                  <th className="p-5 text-sm font-black text-slate-500">{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.comparison.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="p-5 text-sm font-bold text-slate-700">{row.feature}</td>
                    <td className="p-5 text-sm text-slate-700 font-medium">
                      <span className="inline-flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        {row.qampi}
                      </span>
                    </td>
                    <td className="p-5 text-sm text-slate-500 font-medium">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400 font-medium text-center">
            Comparison reflects general product positioning. Check each vendor’s site for current features and pricing.
          </p>
        </div>
      </section>

      {/* Fair take + Qampi edge */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-3">Where {c.name} is strong</h2>
            <p className="text-slate-500 font-medium leading-relaxed">{c.theirStrengths}</p>
          </div>
          <div className="rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white p-7 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-3">Where Qampi pulls ahead</h2>
            <ul className="space-y-3">
              {c.qampiEdge.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600 font-medium leading-relaxed">
                  <Check className="w-4 h-4 text-indigo-500 mt-1 shrink-0" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Best-for split */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-900 text-white p-7">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Choose {c.name} if</p>
            <p className="font-semibold leading-relaxed">{c.bestForThem}</p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-7">
            <p className="text-xs font-black uppercase tracking-widest text-white/70 mb-2">Choose Qampi if</p>
            <p className="font-semibold leading-relaxed">{c.bestForQampi}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight text-center mb-10">
            Qampi vs {c.name} — FAQ
          </h2>
          <div className="space-y-4">
            {c.faqs.map((f, i) => (
              <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">{f.question}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{f.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal links to other comparisons + use cases */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Compare Qampi with</p>
          <div className="flex flex-wrap justify-center gap-3">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/vs/${o.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
              >
                vs {o.name} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ))}
            <Link
              href="/for/sales-teams"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
            >
              Qampi for sales teams <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <CTASection />
      <Footer />
    </main>
  );
}
