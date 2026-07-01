import type { MetadataRoute } from "next";

const BASE_URL = "https://qampi.com";

// Public, indexable routes. /v2 is intentionally excluded (WIP alternate landing).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${BASE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/extension-privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
