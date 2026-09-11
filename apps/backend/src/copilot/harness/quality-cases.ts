import type { CopilotHarnessCase, CopilotHarnessObservation } from './types';

export const LINKEDIN_COPY_CASES = [
    { id: 'comment-specific', kind: 'comment' as const, text: 'The retention chart makes the trade-off clear: activation improved, but week-four use stayed flat. Which setup step creates the early spike?', expectedCodes: [] },
    { id: 'comment-generic', kind: 'comment' as const, text: 'Great post! Thanks for sharing this.', expectedCodes: ['generic_comment_opener'] },
    { id: 'comment-placeholder', kind: 'comment' as const, text: 'Hi {firstName}, your point about onboarding is useful because it shows where teams lose momentum.', expectedCodes: ['placeholder_leakage'] },
    { id: 'message-placeholder', kind: 'message' as const, text: 'Hi {{name}}, I help [company] streamline sales.', expectedCodes: ['placeholder_leakage'] },
    { id: 'message-ai-density', kind: 'message' as const, text: 'Our robust and comprehensive platform delivers significant insights across the modern sales landscape.', expectedCodes: ['ai_vocabulary_density'] },
    { id: 'reply-natural', kind: 'reply' as const, text: 'Thursday works. Would 2 PM your time be convenient?', expectedCodes: [] },
    { id: 'reply-leakage', kind: 'reply' as const, text: 'According to turn12search4, Thursday should work.', expectedCodes: ['model_leakage'] },
    { id: 'reply-staccato', kind: 'reply' as const, text: 'Sounds good. Will do. Talk soon.', expectedCodes: ['staccato_stack'] },
];

export const GROUNDED_RESPONSE_CASES: Array<{
    id: string;
    testCase: CopilotHarnessCase;
    observation: CopilotHarnessObservation;
    shouldPass: boolean;
}> = [
    {
        id: 'status-grounded',
        testCase: { id: 'status-grounded', category: 'grounding', message: 'Status?', expected: { intents: ['check_status'], confirmation: 'forbidden', allowedNumbers: [12, 30, 5, 2] } },
        observation: { intent: 'check_status', reply: '12 of 30 processed, with 5 connected and 2 replies.', needsConfirm: false },
        shouldPass: true,
    },
    {
        id: 'status-invented-conversion',
        testCase: { id: 'status-invented-conversion', category: 'grounding', message: 'Status?', expected: { intents: ['check_status'], confirmation: 'forbidden', allowedNumbers: [12, 30, 5, 2] } },
        observation: { intent: 'check_status', reply: '12 of 30 processed and conversion should reach 75%.', needsConfirm: false },
        shouldPass: false,
    },
    {
        id: 'advice-grounded',
        testCase: { id: 'advice-grounded', category: 'grounding', message: 'Is my ICP broad?', expected: { intents: ['advise'], confirmation: 'forbidden', requiredPhrases: ['VP Sales'] } },
        observation: { intent: 'advise', reply: 'VP Sales is a useful anchor; narrow it further by company stage and sales motion.', needsConfirm: false },
        shouldPass: true,
    },
    {
        id: 'advice-placeholder',
        testCase: { id: 'advice-placeholder', category: 'grounding', message: 'Who should I target?', expected: { intents: ['advise'], confirmation: 'forbidden' } },
        observation: { intent: 'advise', reply: 'Start with {{company}} leaders in your market.', needsConfirm: false },
        shouldPass: false,
    },
];

export const SEARCH_DRAFT_CASES = [
    { id: 'search-good', draft: { label: 'Revenue leaders', keywords: 'VP Sales SaaS', rationale: 'Matches the stated buyer.' }, shouldPass: true },
    { id: 'search-boolean', draft: { label: 'Revenue leaders', keywords: '"VP Sales" AND SaaS', rationale: 'Too complex for free search.' }, shouldPass: false },
    { id: 'search-too-long', draft: { label: 'Revenue leaders', keywords: 'senior vice president sales revenue operations software', rationale: 'Overlong.' }, shouldPass: false },
    { id: 'search-no-label', draft: { label: '', keywords: 'Founder fintech', rationale: 'Matches the target.' }, shouldPass: false },
    { id: 'search-no-rationale', draft: { label: 'Fintech founders', keywords: 'Founder fintech', rationale: '' }, shouldPass: false },
];
