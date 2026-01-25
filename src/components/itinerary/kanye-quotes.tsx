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
    '📸 The best photos are the memories you make along the way',
    '🌟 Travel is the only thing you buy that makes you richer',
  ],
  
  // Europe
  paris: [
    '🗼 The Eiffel Tower was only meant to stand for 20 years',
    '🎨 Paris has only one stop sign in the entire city',
    '🥐 The croissant was actually invented in Austria, not France',
    '🏛️ The Louvre is the world\'s largest art museum with 380,000 objects',
    '🚇 The Paris Metro has 302 stations covering 214km',
    '💡 There are 20,000 light bulbs on the Eiffel Tower',
    '🍷 Paris has more than 9,000 restaurants',
  ],
  london: [
    '🏰 London has been a major settlement for over 2,000 years',
    '🎭 Shakespeare\'s Globe Theatre was rebuilt 230m from the original site',
    '☕ London has over 3,000 pubs, many centuries old',
    '🚇 The London Underground is the world\'s oldest metro system (1863)',
    '👑 Buckingham Palace has 775 rooms and 78 bathrooms',
    '🔔 Big Ben is actually the name of the bell, not the tower',
    '🌉 Tower Bridge opens about 800 times a year',
  ],
  rome: [
    '🏛️ Rome has more fountains than any other city in the world (2,000+)',
    '🍝 Romans have been making pasta for over 2,000 years',
    '⚔️ The Colosseum could hold up to 80,000 spectators',
    '🎨 Vatican City, within Rome, is the world\'s smallest country',
    '🏺 Rome\'s history spans over 2,800 years',
    '🍕 The first pizzeria opened in Rome in 1738',
    '💰 Tourists throw €3,000 into the Trevi Fountain daily',
  ],
  barcelona: [
    '🏗️ Sagrada Familia has been under construction since 1882',
    '🎨 Barcelona has 9 UNESCO World Heritage Sites',
    '🏖️ The city has 4.5km of beaches within city limits',
    '⚽ FC Barcelona\'s Camp Nou is Europe\'s largest stadium',
    '🍷 Catalonia produces some of Spain\'s finest wines and cavas',
    '🏛️ Gaudí\'s Park Güell was originally meant to be a housing development',
    '🎭 Las Ramblas is 1.2km long and always bustling',
  ],
  amsterdam: [
    '🚲 Amsterdam has more bicycles than residents (880,000 bikes)',
    '🌷 The Netherlands produces 4.3 billion tulips annually',
    '🏛️ Amsterdam has 165 canals and 1,281 bridges',
    '🎨 Van Gogh Museum houses the world\'s largest Van Gogh collection',
    '🏘️ Many buildings lean due to being built on wooden poles',
    '🚤 There are 2,500 houseboats in Amsterdam',
    '🧀 The Dutch consume 14.3kg of cheese per person annually',
  ],
  berlin: [
    '🧱 The Berlin Wall stood for 28 years (1961-1989)',
    '🎨 Berlin has more museums than rainy days (175+ museums)',
    '🌳 Berlin is 9 times larger than Paris',
    '🍺 Berlin has over 2,000 bars and clubs',
    '🏛️ Museum Island has 5 world-renowned museums',
    '🚇 The U-Bahn has 173 stations across 10 lines',
  ],
  prague: [
    '🏰 Prague Castle is the largest ancient castle complex in the world',
    '🌉 Charles Bridge has 30 baroque statues along its length',
    '🍺 Czech Republic has the highest beer consumption per capita',
    '⏰ The Astronomical Clock has been working since 1410',
    '🎭 Prague has more than 80 theaters',
    '🏛️ The city has over 1,000 years of architecture',
  ],
  vienna: [
    '🎵 Vienna is the birthplace of classical music legends',
    '☕ Viennese coffee house culture is UNESCO-listed',
    '🏰 Schönbrunn Palace has 1,441 rooms',
    '🎭 Vienna has more than 100 museums',
    '🍰 The Sachertorte was invented here in 1832',
    '🎼 Mozart, Beethoven, and Strauss all lived in Vienna',
  ],
  istanbul: [
    '🌍 Istanbul is the only city spanning two continents',
    '🕌 The Blue Mosque has 20,000 handmade ceramic tiles',
    '🏛️ Hagia Sophia has been a church, mosque, and museum',
    '🍵 Turkish tea is the most consumed beverage in Turkey',
    '🛍️ The Grand Bazaar has over 4,000 shops and 61 streets',
    '🌉 The Bosphorus Bridge connects Europe and Asia',
    '🍢 Istanbul has over 15,000 restaurants',
  ],
  
  // Asia
  tokyo: [
    '🗾 Tokyo is the world\'s most populous metropolitan area (37M+)',
    '🍣 Tokyo has more Michelin-starred restaurants than any other city',
    '🚄 The Shinkansen bullet train has never had a fatal accident',
    '🏯 Tokyo was originally called Edo until 1868',
    '🎌 Shibuya Crossing sees up to 3,000 people cross at once',
    '🗼 Tokyo Tower is 13m taller than the Eiffel Tower',
    '🍜 There are over 160,000 restaurants in Tokyo',
  ],
  bangkok: [
    '🏯 Bangkok\'s full ceremonial name has 169 characters',
    '🛕 The city has over 400 Buddhist temples',
    '🍜 Street food is a major part of Bangkok\'s culture',
    '🚣 Bangkok was once called the "Venice of the East"',
    '👑 The Grand Palace complex covers 218,400 square meters',
    '🌶️ Thai cuisine is one of the world\'s most popular',
    '🛍️ Chatuchak Market has over 15,000 stalls',
  ],
  singapore: [
    '🌳 Singapore is both a city and a country',
    '🏙️ Marina Bay Sands has the world\'s largest rooftop infinity pool',
    '🌺 The city has over 2 million trees',
    '🍜 Singapore has 4 official languages',
    '✈️ Changi Airport is consistently rated the world\'s best',
    '🏛️ Singapore has over 50 museums',
    '🌿 Gardens by the Bay has 1.5 million plants',
  ],
  seoul: [
    '🏰 Seoul has 5 UNESCO World Heritage Sites',
    '🚇 Seoul Metro is one of the world\'s busiest (8M+ daily riders)',
    '🍜 Korean BBQ originated in Seoul',
    '🎮 South Korea is the world\'s gaming capital',
    '🏙️ Seoul is home to 10 million people',
    '🌸 Cherry blossoms bloom in Seoul every April',
    '🛍️ Myeongdong is one of Asia\'s busiest shopping districts',
  ],
  dubai: [
    '🏙️ Burj Khalifa is the world\'s tallest building at 828m',
    '🏝️ The Palm Islands are visible from space',
    '❄️ Dubai has an indoor ski resort in the desert',
    '🚇 Dubai Metro is the world\'s longest driverless metro',
    '🏨 Dubai has some of the world\'s most luxurious hotels',
    '🛍️ Dubai Mall is the world\'s largest shopping mall',
    '⛱️ Dubai has year-round sunshine (350+ days)',
  ],
  
  // Americas
  'new york': [
    '🗽 The Statue of Liberty was a gift from France in 1886',
    '🌳 Central Park is larger than Monaco (341 hectares)',
    '🚇 NYC subway runs 24/7, one of few in the world',
    '🍕 New Yorkers consume 200 million pounds of pizza annually',
    '🏙️ Manhattan was purchased for about $24 worth of goods in 1626',
    '🎭 Broadway has 41 professional theaters',
    '🌉 Brooklyn Bridge was the world\'s longest suspension bridge in 1883',
  ],
  'los angeles': [
    '🎬 Hollywood sign originally said "Hollywoodland"',
    '🌴 LA has 75 miles of coastline',
    '☀️ LA has sunshine 284 days a year',
    '🎭 LA is the entertainment capital of the world',
    '🌮 LA has the most taco trucks in America',
    '🏖️ Venice Beach boardwalk is 2.5 miles long',
    '🎨 LA has over 100 museums',
  ],
  'san francisco': [
    '🌉 The Golden Gate Bridge is 2.7km long',
    '🚃 Cable cars are the only moving National Historic Landmark',
    '🏝️ Alcatraz Island housed famous criminals like Al Capone',
    '🌁 San Francisco has 43 hills',
    '🍫 Ghirardelli chocolate was founded here in 1852',
    '🌈 San Francisco is one of the most diverse cities in America',
    '🦭 Pier 39 is home to hundreds of sea lions',
  ],
  chicago: [
    '🏙️ Chicago invented the skyscraper',
    '🍕 Deep-dish pizza was invented in Chicago in 1943',
    '🎭 Chicago has the largest theater district outside NYC',
    '🌊 Lake Michigan is the 5th largest lake in the world',
    '🎨 The Art Institute of Chicago has 300,000 artworks',
    '🏛️ Chicago has 77 distinct neighborhoods',
    '🌭 Chicagoans eat 2 million hot dogs annually',
  ],
  miami: [
    '🏖️ Miami Beach has 7 miles of pristine beaches',
    '🎨 Wynwood Walls is the world\'s largest outdoor street art gallery',
    '🌴 Miami has the only tropical climate in the continental US',
    '🚢 Miami is the cruise capital of the world',
    '🍹 The mojito was popularized in Miami',
    '🏛️ Art Deco District has over 800 historic buildings',
    '🌊 Biscayne Bay is home to manatees and dolphins',
  ],
  'mexico city': [
    '🏛️ Mexico City is built on top of ancient Aztec capital Tenochtitlan',
    '🎨 Mexico City has more museums than any other city (over 150)',
    '🌮 Tacos al pastor were inspired by Lebanese immigrants',
    '🏙️ The city has 21 million people in the metro area',
    '🎭 Frida Kahlo and Diego Rivera lived and worked here',
    '🌺 Xochimilco\'s floating gardens are UNESCO-listed',
    '🍫 Chocolate originated in Mexico',
  ],
  
  // Oceania
  sydney: [
    '🏛️ Sydney Opera House has over 1 million roof tiles',
    '🌉 Sydney Harbour Bridge is nicknamed "The Coathanger"',
    '🏖️ Sydney has over 100 beaches',
    '🎆 Sydney\'s New Year\'s Eve fireworks are world-famous',
    '🦘 You can see kangaroos near the city',
    '☀️ Sydney has 340 days of sunshine per year',
    '🏄 Bondi Beach is one of the world\'s most famous beaches',
  ],
  melbourne: [
    '☕ Melbourne has the world\'s best coffee culture',
    '🎨 Melbourne has more live music venues per capita than anywhere',
    '🏏 Melbourne Cricket Ground is the world\'s largest stadium',
    '🚃 Melbourne has the largest tram network outside Europe',
    '🎭 Melbourne hosts over 3,000 events annually',
    '🌳 Melbourne has been voted world\'s most liveable city multiple times',
    '🍷 Victoria produces some of Australia\'s finest wines',
  ],
  
  // Africa & Middle East
  cairo: [
    '🏛️ The Pyramids of Giza are over 4,500 years old',
    '🐫 The Great Pyramid was the tallest structure for 3,800 years',
    '🏺 The Egyptian Museum has 120,000 artifacts',
    '🌊 The Nile is the world\'s longest river',
    '🕌 Cairo has over 1,000 mosques',
    '🏙️ Cairo is Africa\'s largest city',
    '📜 Ancient Egyptians invented paper, ink, and the calendar',
  ],
  marrakech: [
    '🕌 Marrakech is known as the "Red City"',
    '🛍️ Jemaa el-Fnaa square is a UNESCO Masterpiece',
    '🌴 The city has over 100,000 palm trees',
    '🏛️ Marrakech was founded in 1062',
    '🍵 Moroccan mint tea is served everywhere',
    '🎨 Marrakech has vibrant souks with traditional crafts',
    '🏰 The Medina is a UNESCO World Heritage Site',
  ],
  'cape town': [
    '🏔️ Table Mountain is over 260 million years old',
    '🐧 Boulders Beach is home to African penguins',
    '🌊 Cape Town has some of the world\'s best beaches',
    '🍷 Cape Winelands produce world-class wines',
    '🌈 Cape Town is one of the world\'s most diverse cities',
    '🏖️ The city has over 70 beaches',
    '🦁 You can see the Big Five within 2 hours of the city',
  ],
  
  // South America
  'rio de janeiro': [
    '🗿 Christ the Redeemer is 30m tall',
    '🏖️ Copacabana Beach is 4km long',
    '🎭 Rio Carnival is the world\'s largest carnival',
    '🌴 Tijuca Forest is the world\'s largest urban forest',
    '⚽ Maracanã Stadium held 200,000 people in 1950',
    '🏔️ Sugarloaf Mountain is 396m high',
    '🎶 Samba and bossa nova originated in Rio',
  ],
  'buenos aires': [
    '💃 Buenos Aires is the birthplace of tango',
    '📚 Buenos Aires has more bookstores per capita than anywhere',
    '🥩 Argentina is famous for its beef and asado',
    '🏛️ The city has 48 distinct neighborhoods',
    '🎭 Buenos Aires has over 300 theaters',
    '☕ Porteños drink more coffee than most Europeans',
    '🌳 Buenos Aires has over 250 parks',
  ],
};

interface KanyeQuotesProps {
  destination?: string;
  realProgress?: { status: string; message: string; progress?: number } | null;
}

export function KanyeQuotes({ destination, realProgress }: KanyeQuotesProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentFact, setCurrentFact] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);

  // Get facts for the destination
  const getDestinationFacts = (dest?: string): string[] => {
    if (!dest) return DESTINATION_FACTS.default;
    
    const normalized = dest.toLowerCase().trim();
    
    // Remove common suffixes and prefixes
    const cleaned = normalized
      .replace(/\b(city|state|province|region|area)\b/g, '')
      .replace(/[,.-]/g, ' ')
      .trim();
    
    // Check for exact matches first
    if (DESTINATION_FACTS[normalized]) {
      return DESTINATION_FACTS[normalized];
    }
    
    if (DESTINATION_FACTS[cleaned]) {
      return DESTINATION_FACTS[cleaned];
    }
    
    // Check if destination contains any of our keys (partial match)
    for (const key in DESTINATION_FACTS) {
      if (key === 'default') continue;
      
      // Check both ways: does destination contain key, or does key contain destination
      if (normalized.includes(key) || key.includes(cleaned)) {
        return DESTINATION_FACTS[key];
      }
      
      // Check for word boundaries (e.g., "new york city" matches "new york")
      const keyWords = key.split(' ');
      const destWords = cleaned.split(' ');
      
      if (keyWords.every(word => destWords.includes(word))) {
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

    // Only rotate through fake progress steps if we don't have real progress
    let stepInterval: NodeJS.Timeout | undefined;
    if (!realProgress) {
      stepInterval = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % PROGRESS_STEPS.length);
      }, 8000);
    }

    // Change travel fact every 12 seconds
    const factInterval = setInterval(() => {
      setCurrentFact(facts[Math.floor(Math.random() * facts.length)]);
    }, 12000);
    
    // Track elapsed time
    const timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => {
      if (stepInterval) clearInterval(stepInterval);
      clearInterval(factInterval);
      clearInterval(timeInterval);
    };
  }, [destination, realProgress]);

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
          {realProgress ? (
            <>
              <span className="text-2xl">
                {realProgress.status === 'researching' ? '🔍' :
                 realProgress.status === 'planning' ? '🗺️' :
                 realProgress.status === 'reviewing' ? '✨' :
                 realProgress.status === 'generating' ? '🎯' :
                 realProgress.status === 'saving' ? '💾' :
                 realProgress.status === 'finalizing' ? '✅' : '⚡'}
              </span>
              <span>{realProgress.message}</span>
            </>
          ) : (
            <>
              <span className="text-2xl">{PROGRESS_STEPS[currentStep].emoji}</span>
              <span>{PROGRESS_STEPS[currentStep].text}</span>
            </>
          )}
        </div>
        
        {/* Progress bar for real progress */}
        {realProgress?.progress !== undefined && (
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-500 ease-out"
              style={{ width: `${realProgress.progress}%` }}
            />
          </div>
        )}
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
