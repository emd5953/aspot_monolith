import { QuizQuestion } from '@/types/quiz';

export const quizQuestions: QuizQuestion[] = [
  // 1. Travel Motivations & Personality
  {
    id: 'travel_motivations',
    category: 'personality_traits',
    question: 'What drives you to travel? (Pick top 3)',
    subtext: 'This shapes the core of your itinerary',
    type: 'multiple',
    minSelections: 1,
    maxSelections: 3,
    options: [
      { id: 'escape', label: 'Escape & recharge', value: 'escape' },
      { id: 'discovery', label: 'Discover new cultures', value: 'discovery' },
      { id: 'adventure', label: 'Seek thrills & adventure', value: 'adventure' },
      { id: 'learning', label: 'Learn history & art', value: 'learning' },
      { id: 'relaxation', label: 'Pure relaxation', value: 'relaxation' },
      { id: 'food', label: 'Culinary exploration', value: 'food' },
      { id: 'connection', label: 'Connect with people', value: 'connection' },
      { id: 'photography', label: 'Capture & create', value: 'photography' },
    ],
  },

  // 2. Planning Style & Flexibility
  {
    id: 'planning_style',
    category: 'personality_traits',
    question: 'How do you approach planning?',
    subtext: 'Helps us balance structure vs. spontaneity',
    type: 'single',
    options: [
      { id: 'hyper_planner', label: 'Every detail planned - I love spreadsheets', value: 'hyper_planner' },
      { id: 'structured_flexible', label: 'Key things booked, rest flexible', value: 'structured_flexible' },
      { id: 'loose_framework', label: 'General direction, figure it out', value: 'loose_framework' },
      { id: 'pure_spontaneous', label: 'No plan - pure spontaneity', value: 'pure_spontaneous' },
    ],
  },

  // 3. Authenticity vs. Tourist Experience
  {
    id: 'authenticity',
    category: 'values',
    question: 'Tourist attractions vs. local experiences?',
    subtext: 'Defines the type of places we recommend',
    type: 'single',
    options: [
      { id: 'pure_authentic', label: 'Avoid tourist traps - local only', value: 'pure_authentic' },
      { id: 'mostly_authentic', label: 'Mostly local, some popular spots', value: 'mostly_authentic' },
      { id: 'balanced', label: 'Mix of both worlds', value: 'balanced' },
      { id: 'tourist_friendly', label: 'Popular spots are fine', value: 'tourist_friendly' },
    ],
  },

  // 4. Activity Types & Interests
  {
    id: 'activities',
    category: 'activity_types',
    question: 'What activities excite you? (Pick up to 5)',
    subtext: 'We\'ll prioritize these in your itinerary',
    type: 'multiple',
    minSelections: 1,
    maxSelections: 5,
    options: [
      { id: 'beaches', label: 'Beaches & water', value: 'beaches' },
      { id: 'hiking', label: 'Hiking & nature', value: 'hiking' },
      { id: 'museums', label: 'Museums & art', value: 'museums' },
      { id: 'nightlife', label: 'Nightlife', value: 'nightlife' },
      { id: 'foodtours', label: 'Food tours', value: 'foodtours' },
      { id: 'adventure', label: 'Adventure sports', value: 'adventure' },
      { id: 'wellness', label: 'Spa & wellness', value: 'wellness' },
      { id: 'photography', label: 'Photography spots', value: 'photography' },
      { id: 'local', label: 'Local workshops', value: 'local' },
      { id: 'shopping', label: 'Markets & shopping', value: 'shopping' },
      { id: 'wildlife', label: 'Wildlife watching', value: 'wildlife' },
      { id: 'urban', label: 'Urban exploration', value: 'urban' },
    ],
  },

  // 5. Travel Pace & Energy
  {
    id: 'pace',
    category: 'travel_pace',
    question: 'What\'s your ideal travel pace?',
    subtext: 'Determines activities per day',
    type: 'single',
    options: [
      { id: 'very_relaxed', label: 'Very relaxed - 1-2 activities, lots of downtime', value: 'very_relaxed' },
      { id: 'relaxed', label: 'Relaxed - 2-3 activities, plenty of rest', value: 'relaxed' },
      { id: 'moderate', label: 'Balanced - 3-4 activities, some rest', value: 'moderate' },
      { id: 'packed', label: 'Packed - 5+ activities, maximize the day', value: 'packed' },
      { id: 'intense', label: 'Intense - dawn to dusk, non-stop', value: 'intense' },
    ],
  },

  // 6. Time Rhythm & Daily Schedule
  {
    id: 'time_rhythm',
    category: 'personality_traits',
    question: 'When are you at your best?',
    subtext: 'We\'ll schedule activities for your peak energy',
    type: 'single',
    options: [
      { id: 'early_bird', label: 'Early riser - sunrise & morning activities', value: 'early_bird' },
      { id: 'steady_daytime', label: 'Daytime - active 9am-6pm', value: 'steady_daytime' },
      { id: 'afternoon_evening', label: 'Afternoon/evening - peak after lunch', value: 'afternoon_evening' },
      { id: 'night_owl', label: 'Night owl - nightlife & late adventures', value: 'night_owl' },
    ],
  },

  // 7. Food Preferences & Adventure
  {
    id: 'cuisine',
    category: 'cuisine_preferences',
    question: 'Food preferences? (Pick up to 4)',
    subtext: 'Helps us recommend restaurants & food experiences',
    type: 'multiple',
    minSelections: 1,
    maxSelections: 4,
    options: [
      { id: 'local_cuisine', label: 'Local/regional cuisine', value: 'local_cuisine' },
      { id: 'streetfood', label: 'Street food', value: 'streetfood' },
      { id: 'fine_dining', label: 'Fine dining', value: 'fine_dining' },
      { id: 'vegetarian', label: 'Vegetarian/vegan', value: 'vegetarian' },
      { id: 'seafood', label: 'Seafood', value: 'seafood' },
      { id: 'adventurous', label: 'Adventurous - try anything', value: 'adventurous' },
      { id: 'familiar', label: 'Familiar flavors', value: 'familiar' },
      { id: 'markets', label: 'Food markets', value: 'markets' },
    ],
  },

  // 8. Budget & Spending Style
  {
    id: 'budget',
    category: 'budget_range',
    question: "What's your budget style?",
    subtext: 'Affects accommodation, dining, and activity choices',
    type: 'single',
    options: [
      { id: 'shoestring', label: 'Shoestring - under $50/day', value: 'shoestring' },
      { id: 'budget', label: 'Budget - $50-100/day', value: 'budget' },
      { id: 'moderate', label: 'Mid-range - $100-250/day', value: 'moderate' },
      { id: 'upscale', label: 'Upscale - $250-500/day', value: 'upscale' },
      { id: 'luxury', label: 'Luxury - $500+/day', value: 'luxury' },
    ],
  },

  // 9. Social Style & Group Dynamics
  {
    id: 'social',
    category: 'social_preferences',
    question: 'How do you travel socially?',
    subtext: 'Influences group activities and social experiences',
    type: 'single',
    options: [
      { id: 'solo_independent', label: 'Solo - independent & flexible', value: 'solo_independent' },
      { id: 'solo_social', label: 'Solo - but love meeting people', value: 'solo_social' },
      { id: 'couple', label: 'Couple/partner', value: 'couple' },
      { id: 'small_group', label: 'Small group (3-5)', value: 'small_group' },
      { id: 'large_group', label: 'Large group (6+)', value: 'large_group' },
      { id: 'family', label: 'Family with kids', value: 'family' },
    ],
  },

  // 10. Comfort Zone & Adventure Level
  {
    id: 'comfort_zone',
    category: 'personality_traits',
    question: 'How far outside your comfort zone?',
    subtext: 'Balances familiar vs. challenging experiences',
    type: 'scale',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: {
      min: 'Familiar & comfortable',
      max: 'Completely foreign & challenging',
    },
  },
];

export const QUIZ_CATEGORIES = [
  'personality_traits',
  'values',
  'activity_types',
  'travel_pace',
  'cuisine_preferences',
  'budget_range',
  'social_preferences',
] as const;

export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];
