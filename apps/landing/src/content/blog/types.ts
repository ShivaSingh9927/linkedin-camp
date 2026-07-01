export interface PostMeta {
  slug: string;
  /** SEO <title> */
  title: string;
  /** meta description */
  description: string;
  /** on-page H1 (can differ from SEO title) */
  h1: string;
  /** ISO date, e.g. "2026-06-20" */
  date: string;
  readingTime: string;
  category: string;
  keywords: string[];
}
