import React from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Clock, GitBranch, Zap, Layers, Trash2 } from 'lucide-react';

// When a campaign is locked (template-derived or quick-launch), the canvas is
// content-only: no node deletion, no rewiring. Custom-builder campaigns are
// unlocked. Provided by CampaignBuilder; consumed by every node to hide its
// delete affordance.
export const BuilderLockContext = React.createContext<boolean>(false);

export const ActionNode = ({ id, data }: any) => {
    const { deleteElements } = useReactFlow();
    const locked = React.useContext(BuilderLockContext);

    return (
        <div className="bg-white border-2 border-slate-200 rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden min-w-[180px] group">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400 border-2 border-white !-top-1.5" />

            <div className="flex items-center justify-between p-2.5 bg-indigo-50 border-b border-indigo-100">
                <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
                        <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="text-[9px] uppercase font-black text-indigo-400 tracking-widest">Action</div>
                        <div className="text-xs font-bold text-slate-800">{data.label}</div>
                    </div>
                </div>
                {!locked && (
                    <button
                        onClick={() => deleteElements({ nodes: [{ id }] })}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Node"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="px-3 py-2.5 bg-white">
                <div className="flex flex-col space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Subtype</span>
                    <span className="text-[11px] font-medium text-slate-600">{data.subType}</span>
                </div>
                {data.message && (
                    <div className="mt-2 p-2 bg-slate-50 rounded-lg text-[10px] text-slate-500 italic border border-dashed border-slate-200 line-clamp-2">
                        "{data.message}"
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-400 border-2 border-white !-bottom-1.5" />
        </div>
    );
};

export const ConditionNode = ({ id, data }: any) => {
    const { deleteElements } = useReactFlow();
    const locked = React.useContext(BuilderLockContext);

    return (
        <div className="bg-white border-2 border-slate-200 rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden min-w-[180px] group">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400 border-2 border-white !-top-1.5" />

            <div className="flex items-center justify-between p-2.5 bg-purple-50 border-b border-purple-100">
                <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600">
                        <GitBranch className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="text-[9px] uppercase font-black text-purple-400 tracking-widest">Logic</div>
                        <div className="text-xs font-bold text-slate-800">{data.label}</div>
                    </div>
                </div>
                {!locked && (
                    <button
                        onClick={() => deleteElements({ nodes: [{ id }] })}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="bg-slate-50 border-t flex items-center justify-center py-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{data.subType}</span>
            </div>

            <div className="flex justify-between px-3 py-2 bg-white text-[10px] font-black uppercase tracking-wider text-slate-500 border-t items-center">
                <div className="flex items-center text-red-500 bg-red-50 px-2 py-0.5 rounded">No</div>
                <div className="flex items-center text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">Yes</div>
            </div>

            {/* Handle ids MUST match the edge `sourceHandle` values ('true'/'false')
                produced by the templates and quick-launch flows — otherwise the
                branch edges render detached. NO = false (left), YES = true (right). */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="false"
                title="Negative Path"
                style={{ left: '20%', background: '#ef4444', width: '11px', height: '11px', bottom: '-5px' }}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="true"
                title="Positive Path"
                style={{ left: '80%', background: '#10b981', width: '11px', height: '11px', bottom: '-5px' }}
            />
        </div>
    );
};

export const DelayNode = ({ id, data }: any) => {
    const { deleteElements } = useReactFlow();
    const locked = React.useContext(BuilderLockContext);

    return (
        <div className="bg-white border-2 border-slate-200 rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden min-w-[180px] group">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400 border-2 border-white !-top-1.5" />

            <div className="flex items-center justify-between p-2.5 bg-amber-50 border-b border-amber-100">
                <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
                        <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="text-[9px] uppercase font-black text-amber-500 tracking-widest">Delay</div>
                        <div className="text-xs font-bold text-slate-800">Wait Duration</div>
                    </div>
                </div>
                {!locked && (
                    <button
                        onClick={() => deleteElements({ nodes: [{ id }] })}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="px-4 py-3 bg-white flex flex-col items-center justify-center">
                <div className="text-xl font-black text-slate-700">{data.days || data.delayDays || 1}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">{(data.days || data.delayDays) === 1 ? 'Day' : 'Days'}</div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-400 border-2 border-white !-bottom-1.5" />
        </div>
    );
};

export const TriggerNode = ({ data }: any) => {
    return (
        <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
            <div className="flex items-center justify-center space-x-2.5 p-3.5 bg-indigo-600 text-white">
                <Zap className="w-5 h-5 fill-current text-indigo-200" />
                <div>
                    <div className="text-[9px] font-black opacity-70 tracking-widest uppercase">Start Event</div>
                    <div className="font-bold tracking-tight text-sm">{data.label || 'CAMPAIGN START'}</div>
                </div>
            </div>
            <div className="px-4 py-2.5 bg-indigo-50/50 flex flex-col items-center">
                <span className="text-[9px] font-bold text-indigo-400 uppercase">Input: Lead Import</span>
            </div>
            <Handle type="source" position={Position.Bottom} className="w-4 h-4 bg-indigo-500 border-4 border-white !-bottom-2 shadow-lg" />
        </div>
    );
};
