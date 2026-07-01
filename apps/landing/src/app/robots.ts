import type { MetadataRoute } from "next";

const BASE_URL = "https://qampi.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/v2"], // WIP alternate landing — not for indexing
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
