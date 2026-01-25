'use client';

import { useState } from 'react';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

interface RegenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (options: {
    useAgenticMode: boolean;
    useTrulyAgentic?: boolean;
    focusAreas?: string[];
  }) => Promise<void>;
}

const FOCUS_OPTIONS = [
  { value: 'food', label: '🍽️ Food & Dining' },
  { value: 'culture', label: '🎭 Culture & Arts' },
  { value: 'adventure', label: '🏔️ Adventure' },
  { value: 'relaxation', label: '🧘 Relaxation' },
  { value: 'nightlife', label: '🌃 Nightlife' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'nature', label: '🌲 Nature' },
  { value: 'history', label: '🏛️ History' },
];

export function RegenerateModal({ isOpen, onClose, onRegenerate }: RegenerateModalProps) {
  const [mode, setMode] = useState<'fast' | 'agentic' | 'truly-agentic'>('truly-agentic');
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate({
        useAgenticMode: mode !== 'fast',
        useTrulyAgentic: mode === 'truly-agentic',
        focusAreas: selectedFocus.length > 0 ? selectedFocus : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const toggleFocus = (value: string) => {
    setSelectedFocus(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <HandDrawnCard className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-heading text-foreground mb-4">
            🔄 Regenerate Itinerary
          </h2>

          <p className="text-foreground/70 mb-6 font-body">
            Create a new version of your itinerary with fresh recommendations.
          </p>

          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-heading text-foreground mb-3">
              Generation Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border-2 border-foreground/20 rounded-lg cursor-pointer hover:border-foreground/40 transition-colors">
                <input
                  type="radio"
                  checked={mode === 'truly-agentic'}
                  onChange={() => setMode('truly-agentic')}
                  className="mt-1"
                />
                <div>
                  <div className="font-heading text-foreground">
                    🤖 Truly Agentic (Best Quality)
                  </div>
                  <div className="text-sm text-foreground/60 font-body">
                    Full reasoning chains, adaptive stopping, dynamic tool selection (~90s)
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border-2 border-foreground/20 rounded-lg cursor-pointer hover:border-foreground/40 transition-colors">
                <input
                  type="radio"
                  checked={mode === 'agentic'}
                  onChange={() => setMode('agentic')}
                  className="mt-1"
                />
                <div>
                  <div className="font-heading text-foreground">
                    🔄 Standard Agentic
                  </div>
                  <div className="text-sm text-foreground/60 font-body">
                    Multi-agent with web research and review loops (~70s)
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border-2 border-foreground/20 rounded-lg cursor-pointer hover:border-foreground/40 transition-colors">
                <input
                  type="radio"
                  checked={mode === 'fast'}
                  onChange={() => setMode('fast')}
                  className="mt-1"
                />
                <div>
                  <div className="font-heading text-foreground">
                    ⚡ Fast Mode
                  </div>
                  <div className="text-sm text-foreground/60 font-body">
                    Quick generation using AI knowledge (~5s)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Focus Areas */}
          <div className="mb-6">
            <label className="block text-sm font-heading text-foreground mb-3">
              Focus Areas (Optional)
            </label>
            <p className="text-xs text-foreground/60 mb-3 font-body">
              Select areas to emphasize in the new itinerary
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FOCUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleFocus(option.value)}
                  className={`p-2 text-sm border-2 rounded-lg transition-all font-body ${
                    selectedFocus.includes(option.value)
                      ? 'border-accent bg-accent/10 text-foreground'
                      : 'border-foreground/20 text-foreground/70 hover:border-foreground/40'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <HandDrawnButton
              onClick={onClose}
              variant="secondary"
              disabled={isRegenerating}
              className="flex-1"
            >
              Cancel
            </HandDrawnButton>
            <HandDrawnButton
              onClick={handleSubmit}
              variant="accent"
              disabled={isRegenerating}
              className="flex-1"
            >
              {isRegenerating ? 'Regenerating...' : 'Regenerate'}
            </HandDrawnButton>
          </div>
        </div>
      </HandDrawnCard>
    </div>
  );
}
