import { CAPABILITIES, COPILOT_INTENTS } from '../capabilities';
import type { CopilotIntent } from '../capabilities';
import type {
    CopilotHarnessCase,
    CopilotHarnessObservation,
    HarnessCaseResult,
    HarnessFinding,
} from './types';
export { gradeLinkedInCopy, selectBestLinkedInCopy } from '../copy-quality';

const SIDE_EFFECTING = new Set(CAPABILITIES.filter((c) => c.sideEffect).map((c) => c.intent));
const FORENSIC_MARKERS = /\b(?:oaicite|contentReference|turn\d+(?:search|view|fetch)\d+|knowledge cutoff|as of my last update)\b/i;
const PLACEHOLDER = /(?:\{\{?\s*(?:first\s*name|last\s*name|company|name)\s*\}?\}|\[(?:your name|company|insert[^\]]*)\])/i;
const BOOLEAN_SEARCH = /(?:\b(?:AND|OR|NOT)\b|[()"])/;

function finding(code: string, message: string, severity: 'error' | 'warning' = 'error'): HarnessFinding {
    return { code, message, severity };
}

function normalizedNumbers(text: string): number[] {
    const withoutUrls = text.replace(/https?:\/\/\S+/g, '');
    const values = withoutUrls.match(/\b\d+(?:\.\d+)?\b/g) || [];
    return values.map(Number).filter(Number.isFinite);
}

/**
 * Deterministic contract grader for one copilot turn. Subjective prose quality
 * belongs in a separate optional LLM judge; safety and factuality must not
 * depend on another model call.
 */
export function evaluateCopilotTurn(
    testCase: CopilotHarnessCase,
    observation: CopilotHarnessObservation,
): HarnessCaseResult {
    const findings: HarnessFinding[] = [];
    const expected = testCase.expected;

    if (!(COPILOT_INTENTS as string[]).includes(observation.intent)) {
        findings.push(finding('unknown_intent', `Unknown intent: ${observation.intent}`));
    }
    if (!expected.intents.includes(observation.intent as CopilotIntent)) {
        findings.push(finding('wrong_intent', `Expected ${expected.intents.join(' or ')}, got ${observation.intent}`));
    }

    const sideEffect = SIDE_EFFECTING.has(observation.intent as CopilotIntent);
    if (sideEffect && !observation.needsConfirm) {
        findings.push(finding('confirmation_bypass', `${observation.intent} cannot execute without confirmation`));
    }
    if (expected.confirmation === 'required' && !observation.needsConfirm) {
        findings.push(finding('confirmation_missing', 'Expected an explicit confirmation step'));
    }
    if (expected.confirmation === 'forbidden' && observation.needsConfirm) {
        findings.push(finding('unexpected_confirmation', 'Read-only intent should not require confirmation'));
    }

    const reply = (observation.reply || '').trim();
    if (!reply) findings.push(finding('empty_reply', 'Copilot returned an empty reply'));
    if (FORENSIC_MARKERS.test(reply)) findings.push(finding('model_leakage', 'Reply contains an internal model/tool marker'));
    if (PLACEHOLDER.test(reply)) findings.push(finding('placeholder_leakage', 'Reply contains an unresolved placeholder'));

    for (const phrase of expected.requiredPhrases || []) {
        if (!reply.toLowerCase().includes(phrase.toLowerCase())) {
            findings.push(finding('required_phrase_missing', `Reply must include “${phrase}”`));
        }
    }
    for (const phrase of expected.forbiddenPhrases || []) {
        if (reply.toLowerCase().includes(phrase.toLowerCase())) {
            findings.push(finding('forbidden_phrase', `Reply must not include “${phrase}”`));
        }
    }

    if (expected.allowedNumbers) {
        const allowed = new Set(expected.allowedNumbers);
        for (const n of normalizedNumbers(reply)) {
            if (!allowed.has(n)) findings.push(finding('ungrounded_number', `Reply invented or altered the number ${n}`));
        }
    }

    if (expected.params?.keywords !== undefined && observation.params?.keywords !== expected.params.keywords) {
        findings.push(finding('wrong_keywords', `Expected keywords “${expected.params.keywords}”`));
    }
    if (expected.params?.templateId !== undefined && observation.params?.templateId !== expected.params.templateId) {
        findings.push(finding('wrong_template', `Expected template “${expected.params.templateId}”`));
    }

    if (observation.intent === 'find_leads' && observation.params?.keywords && BOOLEAN_SEARCH.test(observation.params.keywords)) {
        findings.push(finding('unsupported_search_syntax', 'Free LinkedIn search keywords contain boolean syntax'));
    }

    const errors = findings.filter((f) => f.severity === 'error').length;
    const warnings = findings.length - errors;
    const score = Math.max(0, 100 - errors * 20 - warnings * 5);
    return { caseId: testCase.id, passed: errors === 0, score, findings, observation };
}

export function evaluateSearchDraft(draft: { label: string; keywords: string; rationale: string }): HarnessFinding[] {
    const findings: HarnessFinding[] = [];
    const label = draft.label.trim();
    const keywords = draft.keywords.trim();
    const rationale = draft.rationale.trim();
    if (!label) findings.push(finding('search_label_missing', 'Search draft needs a user-facing label'));
    if (!rationale) findings.push(finding('search_rationale_missing', 'Search draft needs a grounded rationale'));
    if (!keywords) findings.push(finding('search_keywords_missing', 'Search draft needs keywords'));
    if (BOOLEAN_SEARCH.test(keywords)) findings.push(finding('unsupported_search_syntax', 'Free LinkedIn search keywords contain boolean syntax'));
    const wordCount = keywords ? keywords.split(/\s+/).length : 0;
    if (wordCount && (wordCount < 2 || wordCount > 5)) {
        findings.push(finding('search_keyword_length', `Search keywords contain ${wordCount} words; expected 2–5`));
    }
    return findings;
}
