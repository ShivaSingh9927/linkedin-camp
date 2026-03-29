import { NodeHandler, NodeResult } from '../types';

export const delay: NodeHandler = async (_ctx, config): Promise<NodeResult> => {
    const hours = config.hours ?? 24;

    const waitedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    console.log(`[DELAY] Delay node: next action scheduled after ${hours}h (${waitedUntil})`);

    return {
        success: true,
        output: { waitedUntil, hours }
    };
};
