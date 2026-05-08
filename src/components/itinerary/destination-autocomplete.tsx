'use client';

import { useState, useEffect, useRef } from 'react';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';

interface DestinationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export function DestinationAutocomplete({
  value,
  onChange,
  placeholder = 'Where to?',
}: DestinationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/maps/autocomplete?input=${encodeURIComponent(value)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [value]);

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.mainText);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <HandDrawnInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-white shadow-[0_24px_60px_-20px_rgba(20,50,100,0.3)]">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              onClick={() => handleSelect(suggestion)}
              type="button"
              className="w-full border-b border-[color:var(--border)] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[color:var(--surface-soft)]"
            >
              <div className="text-sm font-medium text-[color:var(--ink)]">
                {suggestion.mainText}
              </div>
              <div className="mt-0.5 text-xs text-[color:var(--ink-muted)]">
                {suggestion.secondaryText}
              </div>
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="absolute top-1/2 right-4 -translate-y-1/2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
        </div>
      )}
    </div>
  );
}
