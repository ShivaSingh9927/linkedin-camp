import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock, GitBranch, Zap, Layers } from 'lucide-react';

export const ActionNode = ({ data }: any) => {
    return (
        <div className="bg-white border-2 border-slate-200 rounded-xl shadow-sm overflow-hidden min-w-[200px]">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
            <div className="flex items-center space-x-3 p-3 bg-blue-50 border-b border-blue-100">
                <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                    <Layers className="w-4 h-4" />
                </div>
                <div>
                    <div className="text-xs font-bold text-slate-700">{data.label}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Action • {data.subType}</div>
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
    return (
        <div className="bg-white border-2 border-slate-200 rounded-xl shadow-sm overflow-hidden min-w-[200px]">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
            <div className="flex items-center space-x-3 p-3 bg-amber-50 border-b border-amber-100">
                <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
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

            {/* NO Branch */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="no"
                style={{ left: '20%', background: '#ef4444', width: '12px', height: '12px' }}
            />

            {/* YES Branch */}
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
    return (
        <div className="bg-white border-2 border-slate-200 rounded-xl shadow-sm overflow-hidden min-w-[200px]">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
            <div className="flex items-center space-x-3 p-3 bg-slate-50 border-b border-slate-100">
                <div className="p-1.5 bg-slate-200 rounded-lg text-slate-600">
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
