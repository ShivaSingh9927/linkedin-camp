import { prisma, Prisma } from '@repo/db';
import Redis from 'ioredis';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Rate limiting configuration
const STRATEGY_RATE_LIMIT_SECONDS = 300; // 5 minutes
const RATE_LIMIT_KEY_PREFIX = 'strategy_rate_limit:';

// Lazy Redis connection
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redisClient && REDIS_URL) {
    redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redisClient;
}

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const redis = getRedisClient();
  if (!redis) {
    // No Redis available, skip rate limiting
    return { allowed: true };
  }

  const key = `${RATE_LIMIT_KEY_PREFIX}${userId}`;
  const lastGenerated = await redis.get(key);

  if (lastGenerated) {
    const lastTime = parseInt(lastGenerated, 10);
    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;

    if (elapsed < STRATEGY_RATE_LIMIT_SECONDS) {
      const retryAfter = Math.ceil(STRATEGY_RATE_LIMIT_SECONDS - elapsed);
      return { allowed: false, retryAfter };
    }
  }

  return { allowed: true };
}

async function setRateLimit(userId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const key = `${RATE_LIMIT_KEY_PREFIX}${userId}`;
  await redis.set(key, Date.now().toString(), 'EX', STRATEGY_RATE_LIMIT_SECONDS);
}

export class StrategyService {
  async generateStrategy(userId: string, trigger: string = 'manual', forceRegenerate: boolean = false) {
    // Check rate limit (skip if force regenerate)
    if (!forceRegenerate) {
      const rateLimit = await checkRateLimit(userId);
      if (!rateLimit.allowed) {
        throw new Error(`Rate limit exceeded. Please wait ${rateLimit.retryAfter} seconds before generating another strategy.`);
      }
    }

    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
    });

    if (!businessProfile) {
      throw new Error('Business profile not found');
    }

    const payload = {
      user_id: userId,
      company: businessProfile.company || '',
      industry: businessProfile.industry || '',
      persona: businessProfile.persona || '',
      valueProp: businessProfile.valueProp || '',
      targetAudience: businessProfile.targetAudience || '',
      mainPainPoint: businessProfile.mainPainPoint || '',
      companyDescription: businessProfile.companyDescription || '',
      products: businessProfile.products || '',
      differentiators: businessProfile.differentiators || '',
      caseStudies: businessProfile.caseStudies || '',
      communicationStyle: businessProfile.communicationStyle || '',
      writingSamples: businessProfile.writingSamples || [],
      tonePreferences: businessProfile.tonePreferences || [],
      website: businessProfile.website || '',
      goalType: businessProfile.goalType || 'sell',
      trigger,
      force_regenerate: forceRegenerate,
    };

    const response = await fetch(`${AI_SERVICE_URL}/ai/generate-strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }

    const result = await response.json();
    const strategy = result.strategy;

    // Set rate limit after successful generation
    await setRateLimit(userId);

    // Save to BusinessProfile. A fresh strategy resets confirmation so the user
    // reviews the new version (the old confirm no longer applies).
    await prisma.businessProfile.update({
      where: { userId },
      data: {
        aiStrategy: strategy,
        aiStrategyGeneratedAt: new Date(),
        websiteScrapedAt: businessProfile.website ? new Date() : undefined,
        strategyConfirmedAt: null,
        strategyConfirmedSections: Prisma.JsonNull,
      },
    });

    // Save to StrategyHistory
    const latestVersion = await prisma.strategyHistory.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });

    await prisma.strategyHistory.create({
      data: {
        userId,
        version: (latestVersion?.version || 0) + 1,
        trigger,
        inputSnapshot: payload,
        outputStrategy: strategy,
        reviewIssues: result.isFallback ? JSON.parse('{"note": "Fallback strategy used"}') : undefined,
      },
    });

    return strategy;
  }

  async getStrategy(userId: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
      select: {
        aiStrategy: true,
        aiStrategyGeneratedAt: true,
        strategyConfirmedAt: true,
        strategyConfirmedSections: true,
        goalType: true,
      },
    });

    return {
      strategy: businessProfile?.aiStrategy || null,
      generatedAt: businessProfile?.aiStrategyGeneratedAt || null,
      confirmedAt: businessProfile?.strategyConfirmedAt || null,
      confirmedSections: businessProfile?.strategyConfirmedSections || {},
      goalType: businessProfile?.goalType || 'sell',
    };
  }

  /**
   * Soft confirmation. Two modes:
   *  - { section, confirmed }: toggle a single section's "looks good" state.
   *  - { all: true }: mark the whole strategy confirmed (sets strategyConfirmedAt).
   * Non-blocking — campaigns run regardless; this just records review state and
   * powers the dashboard nudge. Returns the updated confirm state.
   */
  async confirmStrategy(userId: string, opts: { section?: string; confirmed?: boolean; all?: boolean }) {
    const bp = await prisma.businessProfile.findUnique({
      where: { userId },
      select: { strategyConfirmedSections: true },
    });
    if (!bp) throw new Error('Business profile not found');

    const sections: Record<string, boolean> = { ...((bp.strategyConfirmedSections as any) || {}) };
    const data: any = {};

    if (opts.all) {
      data.strategyConfirmedAt = new Date();
    } else if (opts.section) {
      sections[opts.section] = opts.confirmed !== false;
      data.strategyConfirmedSections = sections;
    }

    const updated = await prisma.businessProfile.update({
      where: { userId },
      data,
      select: { strategyConfirmedAt: true, strategyConfirmedSections: true },
    });
    return {
      confirmedAt: updated.strategyConfirmedAt,
      confirmedSections: updated.strategyConfirmedSections || {},
    };
  }

  async updateStrategy(userId: string, overrides: any) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
    });

    if (!businessProfile) {
      throw new Error('Business profile not found');
    }

    const currentStrategy = (businessProfile.aiStrategy as any) || {};
    const updatedStrategy = { ...currentStrategy, ...overrides };

    await prisma.businessProfile.update({
      where: { userId },
      data: { aiStrategy: updatedStrategy },
    });

    return updatedStrategy;
  }

  async getHistory(userId: string) {
    return prisma.strategyHistory.findMany({
      where: { userId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        generatedAt: true,
        trigger: true,
        outputStrategy: true,
        reviewIssues: true,
      },
    });
  }

  async rollback(userId: string, version: number) {
    const historyEntry = await prisma.strategyHistory.findFirst({
      where: { userId, version },
    });

    if (!historyEntry) {
      throw new Error('Strategy version not found');
    }

    await prisma.businessProfile.update({
      where: { userId },
      data: {
        aiStrategy: historyEntry.outputStrategy,
        aiStrategyGeneratedAt: historyEntry.generatedAt,
      },
    });

    return historyEntry.outputStrategy;
  }

  async editPillar(userId: string, instruction: string, pillarName: string, pillarAngle: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
    });
    if (!businessProfile) {
      throw new Error('Business profile not found');
    }

    const strategy = (businessProfile.aiStrategy as any) || {};
    const pillars = strategy.messagingPillars || [];
    const otherPillars = pillars
      .filter((p: any) => p.pillar !== pillarName)
      .map((p: any) => ({ name: p.pillar, angle: p.angle }));

    const brandContext = [
      `Company: ${businessProfile.company || ''}`,
      `Persona: ${businessProfile.persona || ''}`,
      `Value Prop: ${businessProfile.valueProp || ''}`,
    ].filter(Boolean).join('. ');

    const response = await fetch(`${AI_SERVICE_URL}/ai/edit-pillar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        pillar_name: pillarName,
        pillar_angle: pillarAngle,
        brand_context: brandContext,
        other_pillars: otherPillars,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service edit pillar error: ${response.statusText}`);
    }

    return response.json();
  }

  async editCommentStyle(userId: string, instruction: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
    });
    if (!businessProfile) {
      throw new Error('Business profile not found');
    }

    const strategy = (businessProfile.aiStrategy as any) || {};
    const commentStrategy = strategy.commentStrategy || {};
    const currentStrategyStr = [
      `Goal: ${commentStrategy.goal || ''}`,
      `Approach: ${commentStrategy.approach || ''}`,
      `Topics: ${(commentStrategy.topics || []).join(', ')}`,
      `Avoid: ${(commentStrategy.avoid || []).join(', ')}`,
    ].filter(Boolean).join('\n');

    const preferences = (businessProfile.aiPreferences as any) || {};
    const currentInstruction = preferences.commentInstruction || '';

    const brandContext = [
      `Company: ${businessProfile.company || ''}`,
      `Persona: ${businessProfile.persona || ''}`,
      `Value Prop: ${businessProfile.valueProp || ''}`,
    ].filter(Boolean).join('. ');

    const response = await fetch(`${AI_SERVICE_URL}/ai/edit-comment-style`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        brand_context: brandContext,
        current_strategy: currentStrategyStr,
        current_instruction: currentInstruction,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service edit comment style error: ${response.statusText}`);
    }

    return response.json();
  }

  async getCommentInstruction(userId: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
      select: { aiPreferences: true },
    });
    const preferences = (businessProfile?.aiPreferences as any) || {};
    return { instruction: preferences.commentInstruction || '' };
  }

  async setCommentInstruction(userId: string, instruction: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
    });
    if (!businessProfile) {
      throw new Error('Business profile not found');
    }
    const currentPreferences = (businessProfile.aiPreferences as any) || {};
    await prisma.businessProfile.update({
      where: { userId },
      data: {
        aiPreferences: { ...currentPreferences, commentInstruction: instruction },
      },
    });
    return { success: true };
  }

  /**
   * Fast "here's what I understand about your business" reflection, surfaced
   * inline on the AI Profile page the instant the user saves. Single LLM call
   * — NOT the full strategy pipeline. Reads the persisted BusinessProfile so
   * it reflects exactly what was just saved. Never writes anything.
   */
  async understandBusiness(userId: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
    });
    if (!businessProfile) {
      throw new Error('Business profile not found');
    }

    const response = await fetch(`${AI_SERVICE_URL}/ai/understand-business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: businessProfile.company || '',
        companyDescription: businessProfile.companyDescription || '',
        products: businessProfile.products || '',
        differentiators: businessProfile.differentiators || '',
        caseStudies: businessProfile.caseStudies || '',
        targetAudience: businessProfile.targetAudience || '',
        industry: businessProfile.industry || '',
        mainPainPoint: businessProfile.mainPainPoint || '',
        valueProp: businessProfile.valueProp || '',
        communicationStyle: businessProfile.communicationStyle || '',
        tonePreferences: businessProfile.tonePreferences || [],
        website: businessProfile.website || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service understand-business error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Minimal-ask onboarding inference: scrape the user's website, derive a draft
   * business profile + a warm "here's what I understand" reflection, and MERGE
   * the draft into BusinessProfile — filling only empty fields so we never
   * clobber anything the user typed. Returns the understanding for the reveal.
   */
  async inferFromWebsite(userId: string) {
    const businessProfile = await prisma.businessProfile.findUnique({ where: { userId } });
    const website = businessProfile?.website?.trim();
    if (!website) {
      return { understanding: null, scrapeEmpty: true, reason: 'no_website' };
    }

    const response = await fetch(`${AI_SERVICE_URL}/ai/infer-from-website`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website,
        jobTitle: businessProfile?.persona || '',
        selfHeadline: (businessProfile as any)?.selfHeadline || '',
      }),
    });
    if (!response.ok) {
      throw new Error(`AI service infer-from-website error: ${response.statusText}`);
    }
    const result: any = await response.json();
    if (result.scrapeEmpty) {
      return { understanding: null, scrapeEmpty: true, reason: 'scrape_empty' };
    }

    // Fill-empty-only merge: a user's explicit input always wins over inference.
    const draft = result.draft || {};
    const fillIfEmpty: Record<string, string> = {};
    const fields = ['companyDescription', 'products', 'industry', 'targetAudience', 'mainPainPoint', 'valueProp', 'differentiators'] as const;
    for (const f of fields) {
      const existing = (businessProfile as any)?.[f];
      if ((!existing || String(existing).trim() === '') && draft[f]) {
        fillIfEmpty[f] = draft[f];
      }
    }
    if (Object.keys(fillIfEmpty).length > 0) {
      await prisma.businessProfile.update({ where: { userId }, data: fillIfEmpty }).catch((e: any) =>
        console.error('[STRATEGY] inferFromWebsite merge failed:', e.message));
    }

    return { understanding: result.understanding || null, draft, applied: Object.keys(fillIfEmpty), scrapeEmpty: false };
  }

  async getUserContext(userId: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { userId },
    });

    if (!businessProfile) {
      return null;
    }

    return {
      persona: businessProfile.persona,
      company: businessProfile.company,
      companyDescription: businessProfile.companyDescription,
      products: businessProfile.products,
      differentiators: businessProfile.differentiators,
      caseStudies: businessProfile.caseStudies,
      targetAudience: businessProfile.targetAudience,
      industry: businessProfile.industry,
      keywords: businessProfile.keywords,
      mainPainPoint: businessProfile.mainPainPoint,
      usp: businessProfile.usp,
      valueProp: businessProfile.valueProp,
      communicationStyle: businessProfile.communicationStyle,
      writingSamples: businessProfile.writingSamples,
      tonePreferences: businessProfile.tonePreferences,
      aiStrategy: businessProfile.aiStrategy,
    };
  }
}

export const strategyService = new StrategyService();
