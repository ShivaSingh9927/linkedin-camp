// Use-case landing pages — one indexable page per ICP, targeting
// "LinkedIn outreach for <role>" commercial-intent queries. Data-driven so the
// template stays DRY while every page carries genuinely unique copy (no thin
// variable-swapping). Rendered by app/for/[role]/page.tsx.

export interface UseCaseFeature {
  title: string;
  body: string;
}

export interface UseCaseFAQ {
  question: string;
  answer: string;
}

export interface UseCase {
  slug: string; // /for/<slug>
  role: string; // used in headings
  eyebrow: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  subhead: string;
  painPoints: string[];
  features: UseCaseFeature[];
  outcome: string;
  faqs: UseCaseFAQ[];
}

export const useCases: UseCase[] = [
  {
    slug: 'recruiters',
    role: 'Recruiters',
    eyebrow: 'For recruiters & talent teams',
    metaTitle: 'LinkedIn Outreach for Recruiters — AI Candidate Sourcing | Qampi',
    metaDescription:
      'Source and engage candidates on LinkedIn with AI messages personalized to each profile. Qampi keeps InMail-style outreach human, safe, and high-reply — without the spray-and-pray.',
    h1: 'LinkedIn outreach for recruiters that candidates actually reply to',
    subhead:
      'Qampi reads each candidate’s profile and recent activity, then writes outreach that sounds like a recruiter who did their homework — not a copy-paste blast. Book more first conversations from the same shortlist.',
    painPoints: [
      'Generic "I have an exciting opportunity" InMails get ignored — reply rates keep sliding.',
      'Personalizing every message by hand doesn’t scale past a handful of candidates a day.',
      'Aggressive automation tools risk the recruiting account you rely on.',
    ],
    features: [
      {
        title: 'Personalized to the candidate, not a template',
        body: 'Qampi reads their headline, experience, and recent posts to reference something real — the stack they work in, a project they shipped — so the opener earns a reply.',
      },
      {
        title: 'Role-aware messaging',
        body: 'Tell Qampi the role and seniority; it frames the opportunity around what that candidate would care about, not a generic pitch.',
      },
      {
        title: 'Safe for your sourcing account',
        body: 'Dedicated proxies, human-like pacing, working-hours sending, and automatic limit monitoring keep your LinkedIn account healthy while you scale outreach.',
      },
      {
        title: 'Multi-touch follow-up that isn’t annoying',
        body: 'Sequence-aware follow-ups add new value each step and never repeat the opener — across LinkedIn and email.',
      },
    ],
    outcome:
      'Turn a shortlist into booked screening calls — with messages that read like a human recruiter wrote each one.',
    faqs: [
      {
        question: 'Do I need LinkedIn Recruiter or Sales Navigator to use Qampi?',
        answer:
          'No. Qampi works with a standard LinkedIn account. If you do use Recruiter or Sales Navigator, Qampi can leverage your search lists and target accounts for more advanced sourcing.',
      },
      {
        question: 'Will automated candidate outreach get my account restricted?',
        answer:
          'Qampi is built safety-first for recruiters: dedicated proxies, randomized human-like delays, working-hours windows, and automatic weekly-limit monitoring that pauses campaigns before you hit LinkedIn’s thresholds.',
      },
      {
        question: 'Can Qampi personalize to a candidate’s tech stack or experience?',
        answer:
          'Yes. It reads the candidate’s profile and recent posts and references specifics — their role, tools, or a project — so outreach feels researched rather than mass-sent.',
      },
    ],
  },
  {
    slug: 'founders',
    role: 'Founders',
    eyebrow: 'For founders & startups',
    metaTitle: 'LinkedIn Outreach for Founders — AI Prospecting & Fundraising | Qampi',
    metaDescription:
      'Founders use Qampi to run AI-personalized LinkedIn + email outreach to customers and investors — without hiring an SDR. Human-like, account-safe, reply-worthy.',
    h1: 'LinkedIn outreach for founders — sell and raise without an SDR team',
    subhead:
      'You’re the founder, the closer, and the growth team. Qampi does the research and drafting so you can reach customers and investors at scale with messages that still sound like you.',
    painPoints: [
      'No time to research every prospect — but generic outreach converts terribly.',
      'Hiring an SDR is expensive and slow when you’re pre-scale.',
      'One flagged LinkedIn account can cut off your best channel overnight.',
    ],
    features: [
      {
        title: 'Reach customers and investors from one tool',
        body: 'Set your goal — sell or fundraise — and Qampi tailors the ICP, angle, and message to match, whether it’s a buyer or a VC.',
      },
      {
        title: 'Sounds like you, at scale',
        body: 'Upload a few of your own messages; Qampi learns your voice so outreach reads founder-authentic, not agency-generic.',
      },
      {
        title: 'Research done for you',
        body: 'Qampi reads each prospect’s profile and posts and finds a genuine reason to reach out — the homework you’d never have time to do 100 times over.',
      },
      {
        title: 'Safe, hands-off sending',
        body: 'Dedicated proxies and human-like pacing protect your account so you can focus on the conversations that land.',
      },
    ],
    outcome:
      'Book demos and investor intros on autopilot — while every message still reads like you personally wrote it.',
    faqs: [
      {
        question: 'Can Qampi help with both sales and fundraising outreach?',
        answer:
          'Yes. Qampi is goal-driven — pick "generate leads" or "raise funding" and it tailors your ideal-prospect profile, messaging angle, and follow-up to that goal.',
      },
      {
        question: 'I’m not a copywriter. Will my outreach sound good?',
        answer:
          'That’s the point. Qampi drafts researched, on-voice messages for you. Upload a few writing samples and it matches your tone so everything sounds founder-authentic.',
      },
      {
        question: 'Is it safe to automate outreach on my personal LinkedIn?',
        answer:
          'Qampi uses dedicated proxies, randomized human-like timing, working-hours sending, and automatic limit monitoring to keep your account safe while you scale.',
      },
    ],
  },
  {
    slug: 'sales-teams',
    role: 'Sales teams',
    eyebrow: 'For sales & SDR teams',
    metaTitle: 'LinkedIn Outreach for Sales Teams — AI SDR Automation | Qampi',
    metaDescription:
      'Give your SDRs AI that researches every prospect and drafts reply-worthy LinkedIn + email outreach. Qampi scales personalized sequences while keeping accounts safe.',
    h1: 'LinkedIn outreach for sales teams — personalized pipeline at scale',
    subhead:
      'Your reps spend hours researching and writing. Qampi does the homework on every prospect and drafts sequenced, on-brand outreach — so the team spends its time on live conversations, not blank message boxes.',
    painPoints: [
      'Reps burn selling time researching and hand-writing every touch.',
      'Template-heavy cadences tank reply rates and brand perception.',
      'Scaling automation across a team multiplies account-ban risk.',
    ],
    features: [
      {
        title: 'Personalized at every seat',
        body: 'Each rep’s outreach is researched per prospect and written in a consistent, on-brand voice — personalization without the manual grind.',
      },
      {
        title: 'LinkedIn + email in one sequence',
        body: 'Multi-touch, multi-channel cadences that stay sequence-aware: openers, nudges, and closes never repeat phrasing.',
      },
      {
        title: 'CRM in sync',
        body: 'Native HubSpot and Pipedrive sync keeps leads, statuses, and conversation history flowing without copy-paste.',
      },
      {
        title: 'Team-wide account safety',
        body: 'Per-account dedicated proxies, human-like pacing, and automatic limit monitoring protect every rep’s LinkedIn account.',
      },
    ],
    outcome:
      'More qualified conversations per rep — with outreach that sounds handcrafted across the whole team.',
    faqs: [
      {
        question: 'Does Qampi integrate with our CRM?',
        answer:
          'Yes — native integrations with HubSpot, Pipedrive, and Notion sync leads, statuses, and conversation history. Zapier and Make support for 2,000+ tools is coming.',
      },
      {
        question: 'How does Qampi keep a whole team’s accounts safe?',
        answer:
          'Every account gets a dedicated proxy and human-like sending pattern, with randomized delays, working-hours windows, and automatic limit monitoring that pauses before LinkedIn’s thresholds.',
      },
      {
        question: 'Can we keep messaging on-brand across reps?',
        answer:
          'Yes. Qampi generates outreach in a consistent voice you configure, so personalization scales without every rep sounding different or off-brand.',
      },
    ],
  },
  {
    slug: 'job-seekers',
    role: 'Job seekers',
    eyebrow: 'For job seekers',
    metaTitle: 'LinkedIn Outreach for Job Seekers — Reach Hiring Managers | Qampi',
    metaDescription:
      'Land more interviews by reaching hiring managers directly. Qampi turns your resume into personalized LinkedIn outreach that gets replies — no more applying into the void.',
    h1: 'LinkedIn outreach for job seekers — reach hiring managers directly',
    subhead:
      'Applications disappear into ATS black holes. Qampi helps you reach the people who actually decide — with messages personalized to each role and to you, drawn straight from your resume.',
    painPoints: [
      'Online applications vanish with no reply — the resume black hole.',
      'Cold-messaging hiring managers is intimidating and time-consuming.',
      'Generic "I’m interested in opportunities" notes get ignored.',
    ],
    features: [
      {
        title: 'Turns your resume into outreach',
        body: 'Upload your resume and Qampi drafts your positioning, target roles, and a message that leads with why you’re a fit — grounded in your real experience.',
      },
      {
        title: 'Personalized to each hiring manager',
        body: 'Qampi reads the person and company you’re reaching and tailors the note to the specific role — not a copy-paste to everyone.',
      },
      {
        title: 'Reach the decision-maker, not the ATS',
        body: 'Message hiring managers and team leads directly on LinkedIn, where a real human reads it.',
      },
      {
        title: 'Safe, natural sending',
        body: 'Human-like pacing and limit monitoring keep your LinkedIn account healthy while you run your search.',
      },
    ],
    outcome:
      'Get more interviews by starting real conversations with the people who hire — instead of applying into the void.',
    faqs: [
      {
        question: 'Can Qampi use my resume to write outreach?',
        answer:
          'Yes. Upload your resume (PDF) and Qampi extracts your background, target roles, and strengths, then drafts a personalized message you can review and send.',
      },
      {
        question: 'Who should I reach out to for a job?',
        answer:
          'Qampi helps you target hiring managers, team leads, and recruiters at companies you want to join — the people who actually make hiring decisions — rather than relying only on applications.',
      },
      {
        question: 'Is it safe to message lots of people during a job search?',
        answer:
          'Qampi paces outreach like a human — randomized delays, working-hours sending, and automatic limit monitoring — so your account stays in good standing throughout your search.',
      },
    ],
  },
];

export function getUseCase(slug: string): UseCase | undefined {
  return useCases.find((u) => u.slug === slug);
}
