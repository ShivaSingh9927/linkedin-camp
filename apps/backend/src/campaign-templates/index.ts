import { TemplateDefinition } from './types';

import { founderDesignPartnerHuntTemplate } from './founder-design-partner-hunt';
import { founderInvestorSoftIntroTemplate } from './founder-investor-soft-intro';
import { founderEarlyCustomerOutreachTemplate } from './founder-early-customer-outreach';

import { salesColdIcpProspectingTemplate } from './sales-cold-icp-prospecting';
import { salesEnterpriseMultiThreadTemplate } from './sales-enterprise-multi-thread';
import { salesReengageLostDealsTemplate } from './sales-reengage-lost-deals';

import { agencyServicePitchColdTemplate } from './agency-service-pitch-cold';
import { agencyPastClientReactivationTemplate } from './agency-past-client-reactivation';

import { recruiterPassiveCandidateReachTemplate } from './recruiter-passive-candidate-reach';
import { recruiterHiringFunnelDripTemplate } from './recruiter-hiring-funnel-drip';

import { jobseekerHiringManagerBypassTemplate } from './jobseeker-hiring-manager-bypass';
import { jobseekerNetworkReactivationTemplate } from './jobseeker-network-reactivation';
import { jobseekerRecruiterReachTemplate } from './jobseeker-recruiter-reach';

import { creatorAudienceBuilderTemplate } from './creator-audience-builder';
import { creatorNewsletterGrowthTemplate } from './creator-newsletter-growth';

import { universalLeadMagnetShareTemplate } from './universal-lead-magnet-share';
import { universalContentEngagerTemplate } from './universal-content-engager';
import { universalTripleLikePresenceTemplate } from './universal-triple-like-presence';
import { universalSmartAudienceRouterTemplate } from './universal-smart-audience-router';
import { salesCommentLadderColdTemplate } from './sales-comment-ladder-cold';
import { salesStealthEnrichmentTemplate } from './sales-stealth-enrichment';
import { salesInviteAndFollowHedgeTemplate } from './sales-invite-and-follow-hedge';
import { agencyEmailOnlyDirectTemplate } from './agency-email-only-direct';
import { founderCuriosityLoopTemplate } from './founder-curiosity-loop';
import { salesChannelSplitterTemplate } from './sales-channel-splitter';
import { salesEmailFirstCrossroadTemplate } from './sales-email-first-crossroad';
import { salesHeavyHitterAbmTemplate } from './sales-heavy-hitter-abm';
import { universalDeepLinkedinNurtureTemplate } from './universal-deep-linkedin-nurture';
import { founderInvestorCadenceDripTemplate } from './founder-investor-cadence-drip';
import { founderConferenceConnectorTemplate } from './founder-conference-connector';
import { salesCustomerAdvocacyAskTemplate } from './sales-customer-advocacy-ask';
import { salesWebinarFollowupTemplate } from './sales-webinar-followup';
import { recruiterAlumniNetworkReachTemplate } from './recruiter-alumni-network-reach';
import { agencyReferralMiningTemplate } from './agency-referral-mining';
import { salesHighVelocitySdrTemplate } from './sales-high-velocity-sdr';
import { creatorLapsedSubscriberWinbackTemplate } from './creator-lapsed-subscriber-winback';
import { salesFastEnrichmentTemplate, inboxSyncVoyagerTemplate } from './fast-enrichment-voyager';
import { salesCompetitorConquestTemplate } from './sales-competitor-conquest';
import { salesFundingTriggerTemplate } from './sales-funding-trigger';
import { saasTrialActivationTemplate } from './saas-trial-activation';
import { followupRepliedTemplate } from './followup-replied-warm';
import { followupNoReplyTemplate } from './followup-no-reply-nudge';

export const TEMPLATES: TemplateDefinition[] = [
    founderDesignPartnerHuntTemplate,
    founderInvestorSoftIntroTemplate,
    founderEarlyCustomerOutreachTemplate,
    salesColdIcpProspectingTemplate,
    salesEnterpriseMultiThreadTemplate,
    salesReengageLostDealsTemplate,
    agencyServicePitchColdTemplate,
    agencyPastClientReactivationTemplate,
    recruiterPassiveCandidateReachTemplate,
    recruiterHiringFunnelDripTemplate,
    jobseekerHiringManagerBypassTemplate,
    jobseekerNetworkReactivationTemplate,
    jobseekerRecruiterReachTemplate,
    creatorAudienceBuilderTemplate,
    creatorNewsletterGrowthTemplate,
    universalLeadMagnetShareTemplate,
    universalContentEngagerTemplate,
    universalTripleLikePresenceTemplate,
    universalSmartAudienceRouterTemplate,
    salesCommentLadderColdTemplate,
    salesStealthEnrichmentTemplate,
    salesInviteAndFollowHedgeTemplate,
    agencyEmailOnlyDirectTemplate,
    founderCuriosityLoopTemplate,
    salesChannelSplitterTemplate,
    salesEmailFirstCrossroadTemplate,
    salesHeavyHitterAbmTemplate,
    universalDeepLinkedinNurtureTemplate,
    founderInvestorCadenceDripTemplate,
    founderConferenceConnectorTemplate,
    salesCustomerAdvocacyAskTemplate,
    salesWebinarFollowupTemplate,
    recruiterAlumniNetworkReachTemplate,
    agencyReferralMiningTemplate,
    salesHighVelocitySdrTemplate,
    creatorLapsedSubscriberWinbackTemplate,
    salesFastEnrichmentTemplate,
    inboxSyncVoyagerTemplate,
    salesCompetitorConquestTemplate,
    salesFundingTriggerTemplate,
    saasTrialActivationTemplate,
    followupRepliedTemplate,
    followupNoReplyTemplate,
];

export const getTemplates = (): TemplateDefinition[] => TEMPLATES;

export const getTemplateById = (id: string): TemplateDefinition | undefined =>
    TEMPLATES.find((t) => t.id === id);

export type { TemplateDefinition } from './types';
