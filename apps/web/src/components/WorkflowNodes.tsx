import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock, GitBranch, Zap, Layers, Loader2 } from 'lucide-react';

export const ActionNode = ({ data }: any) => {
    const isActive = data.isActive;
    return (
        <div className={`bg-white border-2 rounded-xl shadow-sm overflow-hidden min-w-[200px] transition-all duration-500 ${isActive ? 'border-emerald-500 shadow-lg shadow-emerald-100 scale-105 ring-4 ring-emerald-50' : 'border-slate-200'}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
            <div className={`flex items-center justify-between p-3 border-b ${isActive ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center space-x-3">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-700">{data.label}</div>
                        <div className={`text-[10px] uppercase font-bold tracking-wider ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {isActive ? 'Currently Processing' : `Action • ${data.subType}`}
                        </div>
                    </div>
                </div>
            </div>
            {data.message && (
                <div className="p-3 bg-white text-xs text-slate-500 line-clamp-2 italic">
                    {data.message}
                </div>
            )}
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
        </div>
    );
};

export const ConditionNode = ({ data }: any) => {
    const isActive = data.isActive;
    return (
        <div className={`bg-white border-2 rounded-xl shadow-sm overflow-hidden min-w-[200px] transition-all duration-500 ${isActive ? 'border-amber-500 shadow-lg shadow-amber-100 scale-105 ring-4 ring-amber-50' : 'border-slate-200'}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
            <div className={`flex items-center space-x-3 p-3 border-b ${isActive ? 'bg-amber-100 border-amber-200' : 'bg-amber-50 border-amber-100'}`}>
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-amber-200 text-amber-700' : 'bg-amber-100 text-amber-600'}`}>
                    <GitBranch className="w-4 h-4" />
                </div>
                <div>
                    <div className="text-xs font-bold text-slate-700">{data.label}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Condition • {data.subType}</div>
                </div>
            </div>
            <div className="flex justify-between p-2 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-t">
                <div className="text-red-500">No</div>
                <div className="text-emerald-500">Yes</div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                id="no"
                style={{ left: '20%', background: '#ef4444', width: '12px', height: '12px' }}
            />

            <Handle
                type="source"
                position={Position.Bottom}
                id="yes"
                style={{ left: '80%', background: '#10b981', width: '12px', height: '12px' }}
            />
        </div>
    );
};

export const DelayNode = ({ data }: any) => {
    const isActive = data.isActive;
    return (
        <div className={`bg-white border-2 rounded-xl shadow-sm overflow-hidden min-w-[200px] transition-all duration-500 ${isActive ? 'border-sky-500 shadow-lg shadow-sky-100 scale-105 ring-4 ring-sky-50' : 'border-slate-200'}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
            <div className={`flex items-center space-x-3 p-3 border-b ${isActive ? 'bg-sky-50 border-sky-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-sky-100 text-sky-600' : 'bg-slate-200 text-slate-600'}`}>
                    <Clock className="w-4 h-4" />
                </div>
                <div>
                    <div className="text-xs font-bold text-slate-700">{data.label}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Delay</div>
                </div>
            </div>
            <div className="p-3 bg-white text-xs font-medium text-slate-600 flex space-x-2">
                <div>Wait duration: {data.days || 1} day(s)</div>
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
        </div>
    );
};

export const TriggerNode = ({ data }: any) => {
    return (
        <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-md overflow-hidden min-w-[200px]">
            <div className="flex items-center justify-center space-x-2 p-4 bg-indigo-600 text-white">
                <Zap className="w-5 h-5 fill-current" />
                <div className="font-black tracking-wide">{data.label || 'CAMPAIGN START'}</div>
            </div>
            <Handle type="source" position={Position.Bottom} className="w-4 h-4 bg-indigo-500 border-2 border-white" />
        </div>
    );
};
