import type { MetadataRoute } from "next";

const BASE_URL = "https://qampi.com";

// AI-search crawlers we explicitly welcome so ChatGPT / Perplexity / Claude /
// Gemini / Copilot can read and CITE Qampi (blocking them = no citation). The
// wildcard already allows them; naming them makes intent explicit and guards
// against any future blanket block.
const AI_CRAWLERS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", // OpenAI / ChatGPT
  "PerplexityBot", "Perplexity-User", // Perplexity
  "ClaudeBot", "anthropic-ai", "Claude-User", // Anthropic / Claude
  "Google-Extended", // Gemini + AI Overviews
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/v2"] }, // /v2 = WIP alternate landing
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: ["/v2"] })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
