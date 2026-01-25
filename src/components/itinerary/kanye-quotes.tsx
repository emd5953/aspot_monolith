'use client';

import { useState, useEffect } from 'react';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

const PROGRESS_STEPS = [
  { emoji: '🔍', text: 'Researching top attractions and hidden gems' },
  { emoji: '🍽️', text: 'Finding the best local restaurants' },
  { emoji: '🗺️', text: 'Mapping optimal routes and neighborhoods' },
  { emoji: '⏰', text: 'Checking opening hours and availability' },
  { emoji: '✨', text: 'Optimizing your daily schedule' },
  { emoji: '🎯', text: 'Personalizing based on your preferences' },
];

// Destination-specific facts database
const DESTINATION_FACTS: Record<string, string[]> = {
  // Default/fallback facts
  default: [
    '🌍 Every destination has its own unique story to tell',
    '✈️ The best adventures often come from unexpected discoveries',
    '🗺️ Local experiences create the most memorable moments',
    '🎭 Immersing yourself in local culture enriches any journey',
    '🍽️ Food is the universal language of travel',
  ],
  
  // Major cities and regions
  paris: [
    '🗼 The Eiffel Tower was only meant to stand for 20 years',
    '🎨 Paris has only one stop sign in the entire city',
    '🥐 The croissant was actually invented in Austria, not France',
    '🏛️ The Louvre is the world\'s largest art museum',
    '🚇 The Paris Metro has 302 stations covering 214km',
  ],
  london: [
    '🏰 London has been a major settlement for over 2,000 years',
    '🎭 Shakespeare\'s Globe Theatre was rebuilt 230m from the original site',
    '☕ London has over 3,000 pubs, many centuries old',
    '🚇 The London Underground is the world\'s oldest metro system',
    '👑 Buckingham Palace has 775 rooms',
  ],
  tokyo: [
    '🗾 Tokyo is the world\'s most populous metropolitan area',
    '🍣 Tokyo has more Michelin-starred restaurants than any other city',
    '🚄 The Shinkansen bullet train has never had a fatal accident',
    '🏯 Tokyo was originally called Edo until 1868',
    '🎌 Shibuya Crossing sees up to 3,000 people cross at once',
  ],
  'new york': [
    '🗽 The Statue of Liberty was a gift from France in 1886',
    '🌳 Central Park is larger than Monaco',
    '🚇 NYC subway runs 24/7, one of few in the world',
    '🍕 New Yorkers consume 200 million pounds of pizza annually',
    '🏙️ Manhattan was purchased for about $24 worth of goods in 1626',
  ],
  rome: [
    '🏛️ Rome has more fountains than any other city in the world',
    '🍝 Romans have been making pasta for over 2,000 years',
    '⚔️ The Colosseum could hold up to 80,000 spectators',
    '🎨 Vatican City, within Rome, is the world\'s smallest country',
    '🏺 Rome\'s history spans over 2,800 years',
  ],
  barcelona: [
    '🏗️ Sagrada Familia has been under construction since 1882',
    '🎨 Barcelona has 9 UNESCO World Heritage Sites',
    '🏖️ The city has 4.5km of beaches within city limits',
    '⚽ FC Barcelona\'s Camp Nou is Europe\'s largest stadium',
    '🍷 Catalonia produces some of Spain\'s finest wines and cavas',
  ],
  dubai: [
    '🏙️ Burj Khalifa is the world\'s tallest building at 828m',
    '🏝️ The Palm Islands are visible from space',
    '❄️ Dubai has an indoor ski resort in the desert',
    '🚇 Dubai Metro is the world\'s longest driverless metro',
    '🏨 Dubai has some of the world\'s most luxurious hotels',
  ],
  istanbul: [
    '🌍 Istanbul is the only city spanning two continents',
    '🕌 The Blue Mosque has 20,000 handmade ceramic tiles',
    '🏛️ Hagia Sophia has been a church, mosque, and museum',
    '🍵 Turkish tea is the most consumed beverage in Turkey',
    '🛍️ The Grand Bazaar has over 4,000 shops',
  ],
  bangkok: [
    '🏯 Bangkok\'s full ceremonial name has 169 characters',
    '🛕 The city has over 400 Buddhist temples',
    '🍜 Street food is a major part of Bangkok\'s culture',
    '🚣 Bangkok was once called the "Venice of the East"',
    '👑 The Grand Palace complex covers 218,400 square meters',
  ],
  amsterdam: [
    '🚲 Amsterdam has more bicycles than residents',
    '🌷 The Netherlands produces 4.3 billion tulips annually',
    '🏛️ Amsterdam has 165 canals and 1,281 bridges',
    '🎨 Van Gogh Museum houses the world\'s largest Van Gogh collection',
    '🏘️ Many buildings lean due to being built on wooden poles',
  ],
};

interface KanyeQuotesProps {
  destination?: string;
}

export function KanyeQuotes({ destination }: KanyeQuotesProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentFact, setCurrentFact] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);

  // Get facts for the destination
  const getDestinationFacts = (dest?: string): string[] => {
    if (!dest) return DESTINATION_FACTS.default;
    
    const normalized = dest.toLowerCase().trim();
    
    // Check for exact matches first
    if (DESTINATION_FACTS[normalized]) {
      return DESTINATION_FACTS[normalized];
    }
    
    // Check if destination contains any of our keys
    for (const key in DESTINATION_FACTS) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return DESTINATION_FACTS[key];
      }
    }
    
    // Return default if no match
    return DESTINATION_FACTS.default;
  };

  useEffect(() => {
    const facts = getDestinationFacts(destination);
    
    // Set initial random fact
    setCurrentFact(facts[Math.floor(Math.random() * facts.length)]);

    // Rotate through progress steps every 8 seconds
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % PROGRESS_STEPS.length);
    }, 8000);

    // Change travel fact every 12 seconds
    const factInterval = setInterval(() => {
      setCurrentFact(facts[Math.floor(Math.random() * facts.length)]);
    }, 12000);
    
    // Track elapsed time
    const timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => {
      clearInterval(stepInterval);
      clearInterval(factInterval);
      clearInterval(timeInterval);
    };
  }, [destination]);

  return (
    <HandDrawnCard variant="post-it" className="p-6 text-center">
      <div className="mb-4">
        <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto"></div>
      </div>
      
      <p className="text-foreground/70 font-body text-lg mb-2">
        Creating your perfect itinerary...
      </p>
      
      {/* Progress step indicator */}
      <div className="mt-4 mb-6">
        <div className="flex items-center justify-center gap-2 text-accent font-body text-base animate-pulse">
          <span className="text-2xl">{PROGRESS_STEPS[currentStep].emoji}</span>
          <span>{PROGRESS_STEPS[currentStep].text}</span>
        </div>
      </div>

      {/* Time-based encouragement messages */}
      {elapsedTime > 50 && elapsedTime <= 90 && (
        <p className="text-foreground/60 font-body text-sm mb-4 animate-pulse">
          ⏱️ Just a little bit more... crafting something special!
        </p>
      )}
      
      {elapsedTime > 90 && elapsedTime <= 150 && (
        <p className="text-foreground/60 font-body text-sm mb-4 animate-pulse">
          🎨 Still working on it... creating a masterpiece takes time!
        </p>
      )}
      
      {elapsedTime > 150 && (
        <p className="text-foreground/60 font-body text-sm mb-4 animate-pulse">
          ✨ Almost there! Putting the finishing touches on your adventure!
        </p>
      )}

      {/* Travel fact */}
      <div className="mt-6 pt-6 border-t-2 border-dashed border-foreground/20">
        <p className="text-xs text-foreground/50 font-body mb-3">
          💡 {destination ? `About ${destination}` : 'Travel Tip'}
        </p>
        <p className="text-foreground font-body text-base italic -rotate-1 transition-all duration-500">
          {currentFact}
        </p>
      </div>
    </HandDrawnCard>
  );
}
