'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GenerateForm } from '@/components/itinerary/generate-form';

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

export default function ItineraryPage() {
  const router = useRouter();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchItineraries();
  }, []);

  const fetchItineraries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/itinerary/list');
      if (res.ok) {
        const data = await res.json();
        setItineraries(data.itineraries || []);
      }
    } catch (error) {
      console.error('Failed to fetch itineraries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (data: {
    destination: string;
    startDate: string;
    endDate: string;
    title?: string;
  }) => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate');
      }

      const { itinerary } = await res.json();
      router.push(`/itinerary/${itinerary.id}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-800',
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-xl mx-auto">
          <button
            onClick={() => setShowForm(false)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to itineraries
          </button>
          <GenerateForm onSubmit={handleGenerate} isLoading={isGenerating} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Itineraries</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Itinerary
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading your itineraries...</p>
          </div>
        ) : itineraries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No itineraries yet</h2>
            <p className="text-gray-500 mb-6">Create your first AI-powered travel itinerary</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Generate Your First Itinerary
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {itineraries.map((itinerary) => (
              <div
                key={itinerary.id}
                onClick={() => router.push(`/itinerary/${itinerary.id}`)}
                className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{itinerary.title}</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      {itinerary.destination} • {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${statusColors[itinerary.status]}`}>
                    {itinerary.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
