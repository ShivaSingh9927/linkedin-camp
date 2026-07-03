import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CTASection } from '@/components/CTASection';
import { useCases, getUseCase } from '@/content/use-cases';

const BASE_URL = 'https://qampi.com';

// Server-rendered so all copy + schema is in the initial HTML for crawlers.
export function generateStaticParams() {
  return useCases.map((u) => ({ role: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>;
}): Promise<Metadata> {
  const { role } = await params;
  const uc = getUseCase(role);
  if (!uc) return {};
  const url = `${BASE_URL}/for/${uc.slug}`;
  return {
    title: uc.metaTitle,
    description: uc.metaDescription,
    alternates: { canonical: `/for/${uc.slug}` },
    openGraph: {
      type: 'website',
      url,
      title: uc.metaTitle,
      description: uc.metaDescription,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: uc.h1 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: uc.metaTitle,
      description: uc.metaDescription,
      images: ['/og-image.png'],
    },
  };
}

export default async function UseCasePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  const uc = getUseCase(role);
  if (!uc) notFound();

  const url = `${BASE_URL}/for/${uc.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: uc.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: uc.role, item: url },
        ],
      },
    ],
  };

  const others = useCases.filter((u) => u.slug !== uc.slug);

  return (
    <main className="min-h-screen bg-purple-50/20 text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-36 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-100">
            <Sparkles className="w-3.5 h-3.5" />
            {uc.eyebrow}
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.05] text-balance">
            {uc.h1}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
            {uc.subhead}
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://app.qampi.com/register"
              className="inline-flex items-center justify-center gap-2 btn-primary px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-blue-200 hover:-translate-y-0.5 transition-all"
            >
              Get Started Free <ArrowRight className="w-4.5 h-4.5" />
            </a>
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center gap-2 bg-white text-slate-800 px-8 py-4 rounded-2xl text-lg font-bold border border-slate-200 hover:-translate-y-0.5 transition-all shadow-sm"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-5 text-sm font-medium text-slate-400">
            No credit card needed · Human-like, LinkedIn-safe sending · Cancel anytime
          </p>
        </div>
      </section>

      {/* Pain points */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight text-center mb-12">
            Sound familiar?
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {uc.painPoints.map((p, i) => (
              <div
                key={i}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600 font-medium leading-relaxed"
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Qampi helps */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight text-center mb-4">
            How Qampi helps {uc.role.toLowerCase()}
          </h2>
          <p className="text-center text-slate-500 font-medium max-w-2xl mx-auto mb-12">
            Real per-prospect personalization, sent safely at scale — across LinkedIn and email.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {uc.features.map((f, i) => (
              <div key={i} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center mb-4">
                  <Check className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Outcome band */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-600 p-10 sm:p-14 text-center shadow-xl">
          <ShieldCheck className="w-10 h-10 text-white/90 mx-auto mb-5" />
          <p className="text-2xl sm:text-3xl font-black text-white leading-tight text-balance">
            {uc.outcome}
          </p>
          <a
            href="https://app.qampi.com/register"
            className="mt-8 inline-flex items-center justify-center gap-2 bg-white text-indigo-700 px-8 py-4 rounded-2xl text-lg font-bold hover:-translate-y-0.5 transition-all shadow-lg"
          >
            Start free <ArrowRight className="w-4.5 h-4.5" />
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight text-center mb-12">
            Questions {uc.role.toLowerCase()} ask
          </h2>
          <div className="space-y-4">
            {uc.faqs.map((f, i) => (
              <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">{f.question}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{f.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal links to sibling use cases (crawl depth + relevance) */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">
            Qampi is also built for
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/for/${o.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
              >
                {o.role} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ))}
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
            >
              Outreach guides <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <CTASection />
      <Footer />
    </main>
  );
}
