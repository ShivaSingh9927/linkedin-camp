import { TemplateDefinition } from './types';
import { warmConnectTemplate } from './warm-connect';
import { contextualReactivationTemplate } from './contextual-reactivation';
import { directContentEngagerTemplate } from './direct-content-engager';
import { silentDataHarvesterTemplate } from './silent-data-harvester';
import { quickEmailPivotTemplate } from './quick-email-pivot';
import { observerToAuthorityTemplate } from './observer-to-authority';
import { omniChannelSyncTemplate } from './omni-channel-sync';
import { twoStepNurtureTemplate } from './two-step-nurture';
import { warmEngagerLoopTemplate } from './warm-engager-loop';
import { deepContextMultiTouchTemplate } from './deep-context-multi-touch';
import { blankSlateConnectorTemplate } from './blank-slate-connector';
import { fluffFreeIntroTemplate } from './fluff-free-intro';
import { directEmailRouteTemplate } from './direct-email-route';
import { warmUpConnectionTemplate } from './warm-up-connection';
import { pasSyncTemplate } from './pas-sync';
import { omniChannelAidaTemplate } from './omni-channel-aida';
import { softFollowAudienceTemplate } from './soft-follow-audience';
import { abmScoutTemplate } from './abm-scout';
import { technicalTruthDripTemplate } from './technical-truth-drip';
import { hiringManagerBypassTemplate } from './hiring-manager-bypass';
import { passiveTalentPoacherTemplate } from './passive-talent-poacher';
import { vcAttentionGrabberTemplate } from './vc-attention-grabber';
import { multiThreadEnterpriseTemplate } from './multi-thread-enterprise';

export const TEMPLATES: TemplateDefinition[] = [
    warmConnectTemplate,
    contextualReactivationTemplate,
    directContentEngagerTemplate,
    silentDataHarvesterTemplate,
    quickEmailPivotTemplate,
    observerToAuthorityTemplate,
    omniChannelSyncTemplate,
    twoStepNurtureTemplate,
    warmEngagerLoopTemplate,
    deepContextMultiTouchTemplate,
    blankSlateConnectorTemplate,
    fluffFreeIntroTemplate,
    directEmailRouteTemplate,
    warmUpConnectionTemplate,
    pasSyncTemplate,
    omniChannelAidaTemplate,
    softFollowAudienceTemplate,
    abmScoutTemplate,
    technicalTruthDripTemplate,
    hiringManagerBypassTemplate,
    passiveTalentPoacherTemplate,
    vcAttentionGrabberTemplate,
    multiThreadEnterpriseTemplate,
];

export const getTemplates = (): TemplateDefinition[] => TEMPLATES;

export const getTemplateById = (id: string): TemplateDefinition | undefined =>
    TEMPLATES.find((t) => t.id === id);

export type { TemplateDefinition } from './types';
