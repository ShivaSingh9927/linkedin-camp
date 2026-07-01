import type { Metadata } from "next";
import Link from "next/link";
import { posts } from "@/content/blog";

export const metadata: Metadata = {
  title: "Blog — LinkedIn & Email Outreach Tips | Qampi",
  description:
    "Practical guides on LinkedIn outreach, cold email, personalization, and getting more replies — from the team at Qampi.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Qampi Blog — LinkedIn & Email Outreach Tips",
    description:
      "Practical guides on LinkedIn outreach, cold email, personalization, and getting more replies.",
    url: "https://qampi.com/blog",
    type: "website",
  },
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

export default function BlogIndex() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Qampi Blog</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Outreach that gets replies
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-500">
          Practical guides on LinkedIn outreach, cold email, personalization, and turning cold
          prospects into conversations.
        </p>

        <div className="mt-12 divide-y divide-slate-100">
          {posts.map((post) => (
            <article key={post.slug} className="py-8">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">
                <span>{post.category}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">{formatDate(post.date)}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">{post.readingTime}</span>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                <Link href={`/blog/${post.slug}`} className="hover:text-indigo-600">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-slate-500">{post.description}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:underline"
              >
                Read more →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
