import { TemplateNode, TemplateEdge } from './types';

export const node = (
    id: string,
    y: number,
    type: TemplateNode['type'],
    subType: string,
    label: string,
    extra: Record<string, any> = {},
): TemplateNode => ({
    id,
    type,
    subType,
    position: { x: 250, y },
    data: { label, type, subType, ...extra },
});

export const edge = (source: string, target: string): TemplateEdge => ({
    id: `e_${source}_${target}`,
    source,
    target,
});
