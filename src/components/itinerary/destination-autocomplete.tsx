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
          `/api/maps/autocomplete?input=${encodeURIComponent(value)}&types=locality,administrative_area_level_1,country`
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
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-foreground rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-accent/10 transition-colors border-b border-foreground/10 last:border-0"
            >
              <div className="font-medium text-foreground">{suggestion.mainText}</div>
              <div className="text-sm text-foreground/60">{suggestion.secondaryText}</div>
            </button>
          ))}
        </div>
      )}
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  );
}
