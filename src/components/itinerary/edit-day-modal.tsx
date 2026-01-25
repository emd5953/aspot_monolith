'use client';

import { useState } from 'react';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';

interface EditDayModalProps {
  isOpen: boolean;
  dayNumber: number;
  currentActivities: string[];
  onClose: () => void;
  onSubmit: (prompt: string, mode: 'fast' | 'credible') => Promise<void>;
}

export function EditDayModal({
  isOpen,
  dayNumber,
  currentActivities,
  onClose,
  onSubmit,
}: EditDayModalProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'fast' | 'credible'>('fast');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(prompt.trim(), mode);
      setPrompt('');
      onClose();
    } catch (error) {
      console.error('Failed to edit day:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const examples = [
    "I want more food experiences and less museums",
    "Make it more relaxing with spa time",
    "Add adventure activities like hiking",
    "Focus on local culture and hidden gems",
    "I'm feeling tired, make it a lighter day",
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <HandDrawnCard decoration="tape" className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-heading text-foreground -rotate-1">
                ✏️ Edit Day {dayNumber}
              </h2>
              <p className="text-foreground/70 font-body mt-2">
                Tell the AI what you're feeling and it'll regenerate this day
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-foreground/60 hover:text-foreground text-2xl"
              disabled={isSubmitting}
            >
              ✕
            </button>
          </div>

          {/* Current Activities Preview */}
          <HandDrawnCard variant="post-it" className="p-4 mb-6">
            <h3 className="font-heading text-lg text-foreground mb-2">Current Activities:</h3>
            <ul className="text-sm text-foreground/80 font-body space-y-1">
              {currentActivities.slice(0, 5).map((activity, i) => (
                <li key={i}>• {activity}</li>
              ))}
              {currentActivities.length > 5 && (
                <li className="text-foreground/60">... and {currentActivities.length - 5} more</li>
              )}
            </ul>
          </HandDrawnCard>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Mode Selection */}
            <div>
              <label className="block text-foreground font-body text-lg mb-3">
                🎯 Generation Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('fast')}
                  disabled={isSubmitting}
                  className={`p-4 border-2 border-foreground transition-all ${
                    mode === 'fast'
                      ? 'bg-accent/20 border-accent shadow-hand-drawn'
                      : 'bg-card hover:bg-muted'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-heading text-lg mb-1">⚡ Fast Mode</div>
                    <div className="text-sm text-foreground/70 font-body">
                      AI-generated activities
                      <br />
                      <span className="text-xs">~8-10 seconds</span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('credible')}
                  disabled={isSubmitting}
                  className={`p-4 border-2 border-foreground transition-all ${
                    mode === 'credible'
                      ? 'bg-accent/20 border-accent shadow-hand-drawn'
                      : 'bg-card hover:bg-muted'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-heading text-lg mb-1">🔍 Credible Mode</div>
                    <div className="text-sm text-foreground/70 font-body">
                      Real web-scraped data
                      <br />
                      <span className="text-xs">~20-30 seconds</span>
                    </div>
                  </div>
                </button>
              </div>
              <p className="text-xs text-foreground/60 mt-2 font-body">
                {mode === 'fast' 
                  ? '💡 Fast mode uses AI knowledge - quick but may suggest outdated places'
                  : '💡 Credible mode scrapes live data from TripAdvisor, Google Maps, etc.'}
              </p>
            </div>

            <div>
              <label className="block text-foreground font-body text-lg mb-2">
                What are you feeling? 💭
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., I want more outdoor activities and less shopping..."
                className="w-full min-h-[120px] px-4 py-3 border-2 border-foreground border-wobbly-sm bg-card font-body text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-accent resize-none"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {/* Examples */}
            <div>
              <p className="text-sm text-foreground/60 font-body mb-2">💡 Try these examples:</p>
              <div className="space-y-2">
                {examples.map((example, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="block w-full text-left px-3 py-2 text-sm font-body text-foreground/70 hover:text-foreground bg-muted/50 hover:bg-muted border border-foreground/20 hover:border-foreground/40 transition-colors"
                    disabled={isSubmitting}
                  >
                    "{example}"
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <HandDrawnButton
                type="button"
                onClick={onClose}
                variant="secondary"
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </HandDrawnButton>
              <HandDrawnButton
                type="submit"
                variant="accent"
                disabled={isSubmitting || !prompt.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 inline mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Regenerating...
                  </>
                ) : (
                  <>🪄 Regenerate Day</>
                )}
              </HandDrawnButton>
            </div>
          </form>

          <p className="text-xs text-foreground/50 text-center mt-4 font-body">
            ⏱️ {mode === 'fast' ? 'Fast mode: ~8-10 seconds' : 'Credible mode: ~20-30 seconds'}
          </p>
        </div>
      </HandDrawnCard>
    </div>
  );
}
