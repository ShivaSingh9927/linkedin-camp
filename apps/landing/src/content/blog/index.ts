import type { ComponentType } from "react";
import type { PostMeta } from "./types";
import * as playbook from "./linkedin-outreach-that-gets-replies";
import * as connectionMessages from "./linkedin-connection-request-messages";

export type { PostMeta };

interface PostModule {
  meta: PostMeta;
  default: ComponentType;
}

// Register each post module here. Newest first.
const modules: PostModule[] = [connectionMessages, playbook];

export const posts: PostMeta[] = modules
  .map((m) => m.meta)
  .sort((a, b) => (a.date < b.date ? 1 : -1));

export function getPost(slug: string): { meta: PostMeta; Content: ComponentType } | null {
  const mod = modules.find((m) => m.meta.slug === slug);
  return mod ? { meta: mod.meta, Content: mod.default } : null;
}

export function allSlugs(): string[] {
  return modules.map((m) => m.meta.slug);
}
