export interface LinkedInCopyFinding {
    code: string;
    severity: 'error' | 'warning';
    message: string;
    excerpt?: string;
}

const FORENSIC_MARKERS = /\b(?:oaicite|contentReference|turn\d+(?:search|view|fetch)\d+|knowledge cutoff|as of my last update)\b/i;
const PLACEHOLDER = /(?:\{\{?\s*(?:first\s*name|last\s*name|company|name)\s*\}?\}|\[(?:your name|company|insert[^\]]*)\])/i;
const GENERIC_COMMENT = /^(?:great post|thanks for sharing|well said|this[.!]|100%|couldn't agree more)\b/i;
const AI_VOCAB = /\b(?:significant|crucial|notably|particularly|comprehensive|insights?|robust|leverage|foster|landscape|nuanced|multifaceted|holistic|streamline|elevate|empower)\b/gi;
const REVEAL_BRIDGE = /\b(?:the result\?|here(?:'s| is) (?:what|how)|it(?:'s| is) not .{1,50}, it(?:'s| is)|stop .{1,40}, start)\b/i;

/**
 * Fast, deterministic LinkedIn copy audit. Adapted from selected
 * sergebulaev/linkedin-skills heuristics (MIT). These are writing-review
 * signals, not claims about LinkedIn's algorithm or AI-detection certainty.
 */
export function gradeLinkedInCopy(
    text: string,
    kind: 'comment' | 'message' | 'reply',
): LinkedInCopyFinding[] {
    const findings: LinkedInCopyFinding[] = [];
    const clean = (text || '').trim();
    if (!clean) return [{ code: 'empty_copy', severity: 'error', message: 'Generated copy is empty' }];

    if (FORENSIC_MARKERS.test(clean)) {
        findings.push({ code: 'model_leakage', severity: 'error', message: 'Internal model/tool marker leaked into copy' });
    }
    if (PLACEHOLDER.test(clean)) {
        findings.push({ code: 'placeholder_leakage', severity: 'error', message: 'Unresolved personalization placeholder' });
    }
    if (kind === 'comment' && GENERIC_COMMENT.test(clean)) {
        findings.push({ code: 'generic_comment_opener', severity: 'error', message: 'Comment begins with generic praise' });
    }
    if (kind === 'comment' && (clean.length < 80 || clean.length > 500)) {
        findings.push({ code: 'comment_length', severity: 'warning', message: `Comment length is ${clean.length}; review for LinkedIn readability` });
    }
    if (REVEAL_BRIDGE.test(clean)) {
        findings.push({ code: 'ai_reveal_bridge', severity: 'warning', message: 'Copy contains a common machine-written reveal pattern' });
    }

    for (const paragraph of clean.split(/\n\s*\n/)) {
        const matches = paragraph.match(AI_VOCAB) || [];
        if (matches.length >= 3) {
            findings.push({
                code: 'ai_vocabulary_density',
                severity: 'warning',
                message: `Paragraph contains ${matches.length} high-frequency AI-writing markers`,
                excerpt: paragraph.slice(0, 160),
            });
        }
    }

    const fragments = clean.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const shortRun = fragments.reduce((run, sentence) => sentence.split(/\s+/).length <= 2 ? run + 1 : 0, 0);
    if (shortRun >= 3) {
        findings.push({ code: 'staccato_stack', severity: 'warning', message: 'Copy ends with three or more very short fragments' });
    }
    return findings;
}

export function linkedinCopyPenalty(text: string, kind: 'comment' | 'message' | 'reply'): number {
    return gradeLinkedInCopy(text, kind).reduce(
        (score, item) => score + (item.severity === 'error' ? 100 : 10),
        0,
    );
}

export function selectBestLinkedInCopy<T extends { text: string }>(
    candidates: T[],
    kind: 'comment' | 'message' | 'reply',
): T | undefined {
    return candidates.reduce<T | undefined>((best, candidate) => {
        if (!best) return candidate;
        return linkedinCopyPenalty(candidate.text, kind) < linkedinCopyPenalty(best.text, kind)
            ? candidate
            : best;
    }, undefined);
}
