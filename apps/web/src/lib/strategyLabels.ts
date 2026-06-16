/**
 * Goal-aware labels for the Strategy workspace.
 *
 * The strategy JSON keeps ONE shape across every goal (so the editor/renderer
 * stay generic), but the words a user sees must match WHY they're on Qampi.
 * "Go-to-Market" / "Ideal Customer" / "Avg deal size" mean nothing to a job
 * seeker. This map swaps the visible labels per `goalType` while the underlying
 * keys (gtm, icp, salesMotion, averageDealSize, …) never change.
 *
 * `sell` is the canonical/default set. Any goal falls back to `sell` for any
 * label it doesn't override, so adding a new goal only requires the labels
 * that actually differ.
 */

export type GoalType = 'sell' | 'job_seeking' | string;

export interface StrategyLabels {
  /** Left-nav / section header per strategy key. */
  sections: Record<string, string>;
  /** Field labels inside the gtm section editor. */
  gtm: {
    positioning: string;
    primaryChannel: string;
    salesMotion: string;
    averageDealSize: string;
    salesCycle: string;
    buyingCommittee: string;
    buyingCommitteePlaceholder: string;
  };
  /** Field labels inside the icp section editor. */
  icp: {
    primaryHeader: string;
    secondaryHeader: string;
    title: string;
    companySize: string;
    painPoints: string;
    painPointsPlaceholder: string;
  };
  /** Field labels inside the competitiveLandscape editor. */
  competitive: {
    directCompetitors: string;
    directCompetitorsPlaceholder: string;
    ourAdvantages: string;
    theirWeaknesses: string;
    whenToMention: string;
  };
  /** Labels + placeholders for the AI Profile "Inputs" form. */
  inputs: {
    businessTab: string;
    audienceTab: string;
    companyDescription: string;
    companyDescriptionPlaceholder: string;
    products: string;
    productsPlaceholder: string;
    website: string;
    differentiators: string;
    differentiatorsPlaceholder: string;
    caseStudies: string;
    caseStudiesPlaceholder: string;
    targetAudience: string;
    targetAudiencePlaceholder: string;
    mainPainPoint: string;
    mainPainPointPlaceholder: string;
  };
}

const SELL: StrategyLabels = {
  sections: {
    gtm: 'Go-to-Market',
    icp: 'Ideal Customer',
    messagingPillars: 'Messaging Pillars',
    outreachAngles: 'Outreach Angles',
    objections: 'Objection Handling',
    competitiveLandscape: 'Competitive Landscape',
    commentStrategy: 'Comment Strategy',
  },
  gtm: {
    positioning: 'Positioning',
    primaryChannel: 'Primary channel',
    salesMotion: 'Sales motion',
    averageDealSize: 'Avg deal size',
    salesCycle: 'Sales cycle',
    buyingCommittee: 'Buying committee',
    buyingCommitteePlaceholder: 'Add a role…',
  },
  icp: {
    primaryHeader: 'Primary ICP',
    secondaryHeader: 'Secondary ICP',
    title: 'Title',
    companySize: 'Company size',
    painPoints: 'Pain points',
    painPointsPlaceholder: 'Add a pain point…',
  },
  competitive: {
    directCompetitors: 'Direct competitors',
    directCompetitorsPlaceholder: 'Add a competitor…',
    ourAdvantages: 'Our advantages',
    theirWeaknesses: 'Their weaknesses',
    whenToMention: 'When to mention',
  },
  inputs: {
    businessTab: 'Business',
    audienceTab: 'Audience',
    companyDescription: 'Company Description',
    companyDescriptionPlaceholder: 'Describe what your company does in 2-3 sentences…',
    products: 'Products / Services',
    productsPlaceholder: 'List your main products or services, comma-separated…',
    website: 'Website URL',
    differentiators: 'Key Differentiators',
    differentiatorsPlaceholder: 'What makes you different from competitors…',
    caseStudies: 'Case Studies / Results',
    caseStudiesPlaceholder: 'Key metrics, results, or testimonials…',
    targetAudience: 'Target Audience / ICP',
    targetAudiencePlaceholder: 'Who are your ideal customers? (titles, company size, industry)…',
    mainPainPoint: 'Main Pain Point You Solve',
    mainPainPointPlaceholder: 'The core problem your product solves for customers…',
  },
};

const JOB_SEEKING: StrategyLabels = {
  sections: {
    gtm: 'Your Positioning',
    icp: 'Who You Target',
    messagingPillars: 'Your Value Pillars',
    outreachAngles: 'Outreach Angles',
    objections: 'Handling Concerns',
    competitiveLandscape: 'How You Stand Out',
    commentStrategy: 'Engagement Strategy',
  },
  gtm: {
    positioning: 'Positioning',
    primaryChannel: 'Primary channel',
    salesMotion: 'Search approach',
    averageDealSize: 'Target role & comp',
    salesCycle: 'Hiring timeline',
    buyingCommittee: 'Who decides the hire',
    buyingCommitteePlaceholder: 'Add a role…',
  },
  icp: {
    primaryHeader: 'Primary target',
    secondaryHeader: 'Secondary target',
    title: 'Who to reach',
    companySize: 'Company size',
    painPoints: 'What they need solved',
    painPointsPlaceholder: 'Add a need…',
  },
  competitive: {
    directCompetitors: 'Typical applicants',
    directCompetitorsPlaceholder: 'Add an applicant type…',
    ourAdvantages: 'Your advantages',
    theirWeaknesses: 'Where they fall short',
    whenToMention: 'When to mention',
  },
  inputs: {
    businessTab: 'About You',
    audienceTab: 'Targets',
    companyDescription: 'About You',
    companyDescriptionPlaceholder: 'Describe your background and what you do in 2-3 sentences…',
    products: 'Skills & Expertise',
    productsPlaceholder: 'List your key skills and areas of expertise, comma-separated…',
    website: 'Portfolio / Personal Site',
    differentiators: 'What Makes You Stand Out',
    differentiatorsPlaceholder: 'What sets you apart from other candidates…',
    caseStudies: 'Achievements / Results',
    caseStudiesPlaceholder: 'Key accomplishments, metrics, or impact you’ve delivered…',
    targetAudience: 'Who You’re Targeting',
    targetAudiencePlaceholder: 'Target roles, companies, industries, and the people who hire for them…',
    mainPainPoint: 'Problems You Solve',
    mainPainPointPlaceholder: 'The kind of problems you’re great at solving for a team…',
  },
};

const RECRUITING: StrategyLabels = {
  sections: {
    gtm: 'The Opportunity',
    icp: 'Ideal Candidate',
    messagingPillars: 'Why They’d Join',
    outreachAngles: 'Outreach Angles',
    objections: 'Handling Concerns',
    competitiveLandscape: 'Competing Employers',
    commentStrategy: 'Employer Brand',
  },
  gtm: {
    positioning: 'Role pitch',
    primaryChannel: 'Primary channel',
    salesMotion: 'Sourcing approach',
    averageDealSize: 'Comp & level',
    salesCycle: 'Time to hire',
    buyingCommittee: 'Who influences the decision',
    buyingCommitteePlaceholder: 'Add an influencer…',
  },
  icp: {
    primaryHeader: 'Primary candidate',
    secondaryHeader: 'Secondary candidate',
    title: 'Current title',
    companySize: 'Where they work today',
    painPoints: 'What they want next',
    painPointsPlaceholder: 'Add a motivator…',
  },
  competitive: {
    directCompetitors: 'Competing employers',
    directCompetitorsPlaceholder: 'Add an employer…',
    ourAdvantages: 'Why we win the candidate',
    theirWeaknesses: 'Where they fall short',
    whenToMention: 'When to mention',
  },
  inputs: {
    businessTab: 'The Role',
    audienceTab: 'Candidates',
    companyDescription: 'Company & Role',
    companyDescriptionPlaceholder: 'Describe the company and the role you’re hiring for in 2-3 sentences…',
    products: 'What the Role Offers',
    productsPlaceholder: 'Key things a candidate gets: scope, tech, mission, growth — comma-separated…',
    website: 'Company Website',
    differentiators: 'Why Candidates Choose You',
    differentiatorsPlaceholder: 'What makes this opportunity stand out vs other employers…',
    caseStudies: 'Team & Traction',
    caseStudiesPlaceholder: 'Notable wins, funding, team quality, growth — proof the role is exciting…',
    targetAudience: 'Ideal Candidate Profile',
    targetAudiencePlaceholder: 'Target titles, skills, experience level, and where they likely work today…',
    mainPainPoint: 'What Candidates Want',
    mainPainPointPlaceholder: 'The motivations/frustrations this role speaks to for great candidates…',
  },
};

const FUNDRAISING: StrategyLabels = {
  sections: {
    gtm: 'The Raise',
    icp: 'Ideal Investor',
    messagingPillars: 'Why It’s Investable',
    outreachAngles: 'Outreach Angles',
    objections: 'Handling Pushback',
    competitiveLandscape: 'Market & Comparables',
    commentStrategy: 'Investor Visibility',
  },
  gtm: {
    positioning: 'Investment pitch',
    primaryChannel: 'Primary channel',
    salesMotion: 'Raise approach',
    averageDealSize: 'Round & check size',
    salesCycle: 'Raise timeline',
    buyingCommittee: 'Who decides at the fund',
    buyingCommitteePlaceholder: 'Add a decision-maker…',
  },
  icp: {
    primaryHeader: 'Primary investor',
    secondaryHeader: 'Secondary investor',
    title: 'Investor type',
    companySize: 'Fund size / type',
    painPoints: 'What they’re hunting for',
    painPointsPlaceholder: 'Add a thesis driver…',
  },
  competitive: {
    directCompetitors: 'Comparable companies',
    directCompetitorsPlaceholder: 'Add a comparable…',
    ourAdvantages: 'Why you’re the better bet',
    theirWeaknesses: 'Where they fall short',
    whenToMention: 'When to mention',
  },
  inputs: {
    businessTab: 'The Company',
    audienceTab: 'Investors',
    companyDescription: 'What You’re Building',
    companyDescriptionPlaceholder: 'Describe the company, the market, and why now in 2-3 sentences…',
    products: 'Traction & Metrics',
    productsPlaceholder: 'Revenue, growth, users, key milestones — comma-separated…',
    website: 'Company / Deck Site',
    differentiators: 'Why You Win',
    differentiatorsPlaceholder: 'Your edge vs incumbents and other startups…',
    caseStudies: 'Proof & Milestones',
    caseStudiesPlaceholder: 'Notable customers, growth numbers, team pedigree, past rounds…',
    targetAudience: 'Ideal Investor Profile',
    targetAudiencePlaceholder: 'Stage, sector thesis, check size, and funds you’re targeting…',
    mainPainPoint: 'The Problem You Solve',
    mainPainPointPlaceholder: 'The core market problem your company addresses…',
  },
};

const NETWORKING: StrategyLabels = {
  sections: {
    gtm: 'Your Brand',
    icp: 'People to Connect With',
    messagingPillars: 'Your Story',
    outreachAngles: 'Outreach Angles',
    objections: 'Breaking the Ice',
    competitiveLandscape: 'Your Space',
    commentStrategy: 'Content & Engagement',
  },
  gtm: {
    positioning: 'Personal brand',
    primaryChannel: 'Primary channel',
    salesMotion: 'Engagement approach',
    averageDealSize: 'What a great connection looks like',
    salesCycle: 'Relationship horizon',
    buyingCommittee: 'Your target circle',
    buyingCommitteePlaceholder: 'Add a type of person…',
  },
  icp: {
    primaryHeader: 'Primary circle',
    secondaryHeader: 'Secondary circle',
    title: 'Who they are',
    companySize: 'Where they are',
    painPoints: 'Shared interests',
    painPointsPlaceholder: 'Add common ground…',
  },
  competitive: {
    directCompetitors: 'Voices in your space',
    directCompetitorsPlaceholder: 'Add a voice…',
    ourAdvantages: 'Your unique angle',
    theirWeaknesses: 'Gaps you can fill',
    whenToMention: 'How to position yourself',
  },
  inputs: {
    businessTab: 'About You',
    audienceTab: 'Your Circle',
    companyDescription: 'About You',
    companyDescriptionPlaceholder: 'Who you are and what you’re about, in 2-3 sentences…',
    products: 'What You Talk About',
    productsPlaceholder: 'Your topics, expertise, and interests — comma-separated…',
    website: 'Portfolio / Personal Site',
    differentiators: 'Your Unique Angle',
    differentiatorsPlaceholder: 'What makes your perspective distinct…',
    caseStudies: 'What You’re Known For',
    caseStudiesPlaceholder: 'Notable work, talks, writing, or moments that build your credibility…',
    targetAudience: 'Who You Want to Connect With',
    targetAudiencePlaceholder: 'The kinds of people, communities, and spaces you want in your circle…',
    mainPainPoint: 'What You Care About',
    mainPainPointPlaceholder: 'The themes and conversations you want to be part of…',
  },
};

const REGISTRY: Record<string, StrategyLabels> = {
  sell: SELL,
  job_seeking: JOB_SEEKING,
  recruiting: RECRUITING,
  fundraising: FUNDRAISING,
  networking: NETWORKING,
};

/** Resolve the label set for a goal, falling back to `sell` for unknown goals. */
export function getStrategyLabels(goalType?: GoalType | null): StrategyLabels {
  return REGISTRY[goalType || 'sell'] || SELL;
}
