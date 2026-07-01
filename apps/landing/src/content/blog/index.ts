import type { ComponentType } from "react";
import type { PostMeta } from "./types";
import * as playbook from "./linkedin-outreach-that-gets-replies";
import * as connectionMessages from "./linkedin-connection-request-messages";
import * as coldVsLinkedin from "./cold-email-vs-linkedin-outreach";
import * as findEmail from "./how-to-find-someones-email-address";
import * as automationSafe from "./is-linkedin-automation-safe";

export type { PostMeta };

interface PostModule {
  meta: PostMeta;
  default: ComponentType;
}

// Register each post module here. Order doesn't matter — the list is sorted by date.
const modules: PostModule[] = [
  automationSafe,
  findEmail,
  coldVsLinkedin,
  connectionMessages,
  playbook,
];

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
