'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Sparkles, Loader2, Plus, ChevronDown } from 'lucide-react';
import api from '@/lib/api';

interface Pillar {
  pillar: string;
  angle: string;
  enabled?: boolean;
}

// Simple word-level diff: returns array of {word, type} tokens
function diffWords(before: string, after: string): { word: string; type: 'same' | 'added' | 'removed' }[] {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const result: { word: string; type: 'same' | 'added' | 'removed' }[] = [];

  // Build LCS table
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  let i = m, j = n;
  const seq: { word: string; type: 'same' | 'added' | 'removed' }[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      seq.push({ word: a[i - 1], type: 'same' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      seq.push({ word: b[j - 1], type: 'added' });
      j--;
    } else {
      seq.push({ word: a[i - 1], type: 'removed' });
      i--;
    }
  }
  return seq.reverse();
}

export default function PillarEditor({
  pillars,
  onSave,
  saving,
}: {
  pillars: Pillar[];
  onSave: (updated: Pillar[]) => Promise<void>;
  saving: boolean;
}) {
  const [local, setLocal] = useState<Pillar[]>(pillars.map(p => ({ ...p, enabled: p.enabled ?? true })));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [instruction, setInstruction] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ name: string; angle: string } | null>(null);
  const [showNewPillar, setShowNewPillar] = useState(false);
  const [newInstruction, setNewInstruction] = useState('');

  const togglePillar = (index: number) => {
    setLocal(prev => prev.map((p, i) => i === index ? { ...p, enabled: !p.enabled } : p));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setInstruction('');
    setSuggestion(null);
  };

  const suggestRevision = async () => {
    if (!instruction.trim() || editingIndex === null) return;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const p = local[editingIndex];
      const { data } = await api.post('/strategy/edit-pillar', {
        instruction: instruction.trim(),
        pillar_name: p.pillar,
        pillar_angle: p.angle,
      });
      setSuggestion({ name: data.suggested_name, angle: data.suggested_angle });
    } catch (e: any) {
      console.error('Failed to suggest revision', e);
      alert('Failed to get suggestion. Please try again.');
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestion = () => {
    if (editingIndex === null || !suggestion) return;
    setLocal(prev => prev.map((p, i) =>
      i === editingIndex ? { ...p, pillar: suggestion.name, angle: suggestion.angle } : p
    ));
    setEditingIndex(null);
    setSuggestion(null);
    setInstruction('');
  };

  const rejectSuggestion = () => {
    setSuggestion(null);
    setInstruction('');
  };

  const addNewPillar = async () => {
    if (!newInstruction.trim()) return;
    setSuggesting(true);
    try {
      const { data } = await api.post('/strategy/edit-pillar', {
        instruction: newInstruction.trim(),
        pillar_name: '',
        pillar_angle: '',
      });
      setLocal(prev => [...prev, { pillar: data.suggested_name, angle: data.suggested_angle, enabled: true }]);
      setNewInstruction('');
      setShowNewPillar(false);
    } catch (e: any) {
      console.error('Failed to create pillar', e);
      alert('Failed to create pillar. Please try again.');
    } finally {
      setSuggesting(false);
    }
  };

  const activePillars = local.filter(p => p.enabled);
  const handleSave = () => onSave(local);

  const pillarCount = local.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500">
            {activePillars.length} of {pillarCount} active
            {saving && <span className="ml-2 text-primary text-xs">Saving...</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewPillar(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Pillar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {local.map((pillar, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            {/* Pillar header row */}
            <div className={`flex items-start gap-3 p-4 ${!pillar.enabled ? 'opacity-50' : ''}`}>
              <button
                onClick={() => togglePillar(index)}
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  pillar.enabled
                    ? 'bg-primary border-primary text-white'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                {pillar.enabled && <Check className="w-3 h-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 text-sm">{pillar.pillar}</div>
                <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{pillar.angle}</div>
              </div>
              <button
                onClick={() => startEdit(index)}
                className="flex-shrink-0 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                Edit
              </button>
            </div>

            {/* Edit panel (inline) */}
            <AnimatePresence>
              {editingIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="border-t border-slate-100 px-4 py-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                        Tell me what you want to change:
                      </label>
                      <textarea
                        value={instruction}
                        onChange={e => setInstruction(e.target.value)}
                        placeholder="e.g. add case studies about manufacturing defects, make it more technical for CTOs..."
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder:text-slate-400"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={suggestRevision}
                        disabled={suggesting || !instruction.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 disabled:opacity-50 transition-colors"
                      >
                        {suggesting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Suggest Revision
                      </button>
                      <button
                        onClick={rejectSuggestion}
                        className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Suggestion result */}
                    <AnimatePresence>
                      {suggestion && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3"
                        >
                          {/* Name change diff */}
                          {suggestion.name !== pillar.pillar && (
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-1">Pillar name:</div>
                              <div className="text-sm">
                                <span className="line-through text-red-500">{pillar.pillar}</span>
                                {' → '}
                                <span className="text-emerald-600 font-semibold">{suggestion.name}</span>
                              </div>
                            </div>
                          )}

                          {/* Angle diff */}
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Angle:</div>
                            <div className="text-sm leading-relaxed bg-slate-50 rounded-lg p-3">
                              {diffWords(pillar.angle, suggestion.angle).map((d, i) => (
                                <span
                                  key={i}
                                  className={
                                    d.type === 'added'
                                      ? 'bg-emerald-100 text-emerald-800 rounded px-0.5'
                                      : d.type === 'removed'
                                      ? 'bg-red-100 text-red-700 line-through rounded px-0.5'
                                      : 'text-slate-700'
                                  }
                                >
                                  {d.word}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={acceptSuggestion}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Accept & Save
                            </button>
                            <button
                              onClick={() => setSuggestion(null)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              Edit More
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {/* Add new pillar */}
        <AnimatePresence>
          {showNewPillar && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-white rounded-xl border border-dashed border-primary/30 p-4"
            >
              <div className="text-xs font-semibold text-primary mb-2">New Pillar</div>
              <textarea
                value={newInstruction}
                onChange={e => setNewInstruction(e.target.value)}
                placeholder="Describe what this pillar should convey..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder:text-slate-400 mb-3"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={addNewPillar}
                  disabled={suggesting || !newInstruction.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {suggesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Generate
                </button>
                <button
                  onClick={() => { setShowNewPillar(false); setNewInstruction(''); }}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
