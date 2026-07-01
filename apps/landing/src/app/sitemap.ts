import type { MetadataRoute } from "next";
import { posts } from "@/content/blog";

const BASE_URL = "https://qampi.com";

// Public, indexable routes. /v2 is intentionally excluded (WIP alternate landing).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const blogEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: `${BASE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogEntries,
    {
      url: `${BASE_URL}/extension-privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
