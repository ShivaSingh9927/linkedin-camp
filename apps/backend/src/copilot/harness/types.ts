import type { CopilotContext, CopilotIntent } from '../capabilities';

export type HarnessSeverity = 'error' | 'warning';

export interface HarnessFinding {
    code: string;
    severity: HarnessSeverity;
    message: string;
}
export interface CopilotHarnessExpectation {
    intents: CopilotIntent[];
    confirmation?: 'required' | 'forbidden';
    requiredPhrases?: string[];
    forbiddenPhrases?: string[];
    allowedNumbers?: number[];
    params?: {
        keywords?: string;
        templateId?: string;
    };
}

export interface CopilotHarnessObservation {
    intent: string;
    params?: {
        keywords?: string;
        templateId?: string;
    };
    reply: string;
    needsConfirm: boolean;
    latencyMs?: number;
}

export interface CopilotHarnessCase {
    id: string;
    category: 'routing' | 'grounding' | 'safety' | 'adversarial';
    message: string;
    history?: Array<{ sender: string; text: string }>;
    context?: Partial<CopilotContext>;
    expected: CopilotHarnessExpectation;
}

export interface HarnessCaseResult {
    caseId: string;
    passed: boolean;
    score: number;
    findings: HarnessFinding[];
    observation: CopilotHarnessObservation;
}
