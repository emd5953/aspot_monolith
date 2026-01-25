'use client';

import { useState } from 'react';

interface CreateTripModalProps {
  itineraryId: string;
  itineraryTitle: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

export function CreateTripModal({ 
  itineraryId, 
  itineraryTitle, 
  onClose, 
  onCreated 
}: CreateTripModalProps) {
  const [name, setName] = useState(`${itineraryTitle} - Group Trip`);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, itineraryId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create trip');
      }

      const { trip } = await res.json();
      onCreated(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Create Collaborative Trip</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-4">
          Turn your itinerary into a collaborative trip that you can share with friends.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="tripName" className="block text-sm font-medium text-gray-700 mb-1">
              Trip Name
            </label>
            <input
              type="text"
              id="tripName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter trip name"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
