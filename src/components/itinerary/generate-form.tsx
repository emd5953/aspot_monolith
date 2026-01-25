'use client';

import { useState } from 'react';

interface GenerateFormProps {
  onSubmit: (data: {
    destination: string;
    startDate: string;
    endDate: string;
    title?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function GenerateForm({ onSubmit, isLoading }: GenerateFormProps) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!destination.trim()) {
      setError('Please enter a destination');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('End date must be after start date');
      return;
    }

    try {
      await onSubmit({
        destination: destination.trim(),
        startDate,
        endDate,
        title: title.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate itinerary');
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 max-w-xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Generate Your Itinerary
      </h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1">
            Where are you going?
          </label>
          <input
            type="text"
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g., Paris, France"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Trip name (optional)
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Summer Vacation 2026"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Start date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={today}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              End date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating your perfect itinerary...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Itinerary
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">
        Our AI will create a personalized itinerary based on your preferences
      </p>
    </form>
  );
}
