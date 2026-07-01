import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, allSlugs } from "@/content/blog";

const SITE_URL = "https://qampi.com";

export function generateStaticParams() {
  return allSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const { meta } = post;
  const url = `${SITE_URL}/blog/${meta.slug}`;
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: `/blog/${meta.slug}` },
    openGraph: {
      type: "article",
      url,
      title: meta.title,
      description: meta.description,
      publishedTime: meta.date,
      images: ["/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ["/og-image.png"],
    },
  };
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const { meta, Content } = post;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    dateModified: meta.date,
    author: { "@type": "Organization", name: "Qampi", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Qampi",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/android-chrome-512x512.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${meta.slug}` },
    image: `${SITE_URL}/og-image.png`,
  };

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
        <Link href="/blog" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← All articles
        </Link>
        <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">
          <span>{meta.category}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-400">{formatDate(meta.date)}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-400">{meta.readingTime}</span>
        </div>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
          {meta.h1}
        </h1>
        <div className="mt-10">
          <Content />
        </div>

        <div className="mt-16 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 text-center">
          <p className="text-lg font-bold text-slate-900">Turn these tactics into a system</p>
          <p className="mt-2 text-slate-600">
            Qampi reads every prospect and writes reply-worthy outreach across LinkedIn and email —
            sent safely at human-like limits.
          </p>
          <a
            href="https://app.qampi.com/register"
            className="mt-4 inline-block rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            Start free
          </a>
        </div>
      </div>
    </main>
  );
}
