import { QuizQuestion } from '@/types/quiz';

export const quizQuestions: QuizQuestion[] = [
  // 1. Cuisine Preferences
  {
    id: 'cuisine',
    category: 'cuisine_preferences',
    question: 'What cuisines do you love?',
    subtext: 'Select all that appeal to you',
    type: 'multiple',
    minSelections: 1,
    maxSelections: 5,
    options: [
      { id: 'italian', label: 'Italian', value: 'italian' },
      { id: 'japanese', label: 'Japanese', value: 'japanese' },
      { id: 'mexican', label: 'Mexican', value: 'mexican' },
      { id: 'indian', label: 'Indian', value: 'indian' },
      { id: 'thai', label: 'Thai', value: 'thai' },
      { id: 'mediterranean', label: 'Mediterranean', value: 'mediterranean' },
      { id: 'american', label: 'American', value: 'american' },
      { id: 'korean', label: 'Korean', value: 'korean' },
      { id: 'vegan', label: 'Plant-based', value: 'vegan' },
      { id: 'streetfood', label: 'Street food', value: 'streetfood' },
    ],
  },

  // 2. Activity Types
  {
    id: 'activities',
    category: 'activity_types',
    question: 'How do you like to spend your travel days?',
    subtext: 'Pick up to 4 activities',
    type: 'multiple',
    minSelections: 1,
    maxSelections: 4,
    options: [
      { id: 'beaches', label: 'Beaches & relaxation', value: 'beaches' },
      { id: 'hiking', label: 'Hiking & nature', value: 'hiking' },
      { id: 'museums', label: 'Museums & galleries', value: 'museums' },
      { id: 'nightlife', label: 'Nightlife & entertainment', value: 'nightlife' },
      { id: 'shopping', label: 'Shopping', value: 'shopping' },
      { id: 'foodtours', label: 'Food tours & dining', value: 'foodtours' },
      { id: 'adventure', label: 'Adventure sports', value: 'adventure' },
      { id: 'wellness', label: 'Spa & wellness', value: 'wellness' },
      { id: 'photography', label: 'Photography spots', value: 'photography' },
      { id: 'local', label: 'Local experiences', value: 'local' },
    ],
  },

  // 3. Budget Range
  {
    id: 'budget',
    category: 'budget_range',
    question: "What's your travel budget style?",
    subtext: 'This helps us find the right recommendations',
    type: 'single',
    options: [
      { id: 'budget', label: 'Budget-friendly', value: 'budget' },
      { id: 'moderate', label: 'Mid-range', value: 'moderate' },
      { id: 'luxury', label: 'Luxury', value: 'luxury' },
    ],
  },

  // 4. Travel Pace
  {
    id: 'pace',
    category: 'travel_pace',
    question: 'How do you like to pace your trips?',
    subtext: 'How many activities per day feels right?',
    type: 'single',
    options: [
      { id: 'relaxed', label: 'Relaxed - plenty of downtime', value: 'relaxed' },
      { id: 'moderate', label: 'Balanced - mix of activities and rest', value: 'moderate' },
      { id: 'packed', label: 'Action-packed - see everything', value: 'packed' },
    ],
  },

  // 5. Accommodation Style
  {
    id: 'accommodation',
    category: 'accommodation_style',
    question: 'Where do you prefer to stay?',
    subtext: 'Pick your ideal accommodation',
    type: 'single',
    options: [
      { id: 'hostel', label: 'Hostels - social & affordable', value: 'hostel' },
      { id: 'airbnb', label: 'Vacation rentals', value: 'airbnb' },
      { id: 'hotel', label: 'Standard hotels', value: 'hotel' },
      { id: 'boutique', label: 'Boutique hotels', value: 'boutique' },
      { id: 'luxury', label: 'Luxury resorts', value: 'luxury' },
    ],
  },

  // 6. Social Preferences
  {
    id: 'social',
    category: 'social_preferences',
    question: 'Who are you traveling with?',
    subtext: 'This helps us tailor group-friendly activities',
    type: 'single',
    options: [
      { id: 'solo', label: 'Solo traveler', value: 'solo' },
      { id: 'small_group', label: 'Small group (2-4 people)', value: 'small_group' },
      { id: 'large_group', label: 'Large group (5+ people)', value: 'large_group' },
    ],
  },

  // 7. Accessibility Needs
  {
    id: 'accessibility',
    category: 'accessibility_needs',
    question: 'Any accessibility considerations?',
    subtext: 'Select all that apply',
    type: 'multiple',
    minSelections: 1,
    options: [
      { id: 'none', label: 'None', value: 'none' },
      { id: 'wheelchair', label: 'Wheelchair accessible', value: 'wheelchair' },
      { id: 'limited_walking', label: 'Limited walking distance', value: 'limited_walking' },
      { id: 'dietary', label: 'Dietary restrictions', value: 'dietary' },
      { id: 'sensory', label: 'Sensory considerations', value: 'sensory' },
    ],
  },

  // 8. Climate Preferences
  {
    id: 'climate',
    category: 'climate_preferences',
    question: 'What weather do you prefer?',
    subtext: 'Pick up to 2',
    type: 'multiple',
    minSelections: 1,
    maxSelections: 2,
    options: [
      { id: 'tropical', label: 'Warm & tropical', value: 'tropical' },
      { id: 'mild', label: 'Mild & temperate', value: 'mild' },
      { id: 'cold', label: 'Cool & crisp', value: 'cold' },
      { id: 'desert', label: 'Dry & sunny', value: 'desert' },
      { id: 'any', label: 'No preference', value: 'any' },
    ],
  },

  // 9. Cultural Interests
  {
    id: 'culture',
    category: 'cultural_interests',
    question: 'What cultural experiences interest you?',
    subtext: 'Pick up to 4',
    type: 'multiple',
    minSelections: 1,
    maxSelections: 4,
    options: [
      { id: 'history', label: 'History & heritage', value: 'history' },
      { id: 'art', label: 'Art & design', value: 'art' },
      { id: 'music', label: 'Live music & concerts', value: 'music' },
      { id: 'architecture', label: 'Architecture', value: 'architecture' },
      { id: 'religion', label: 'Religious & spiritual sites', value: 'religion' },
      { id: 'local_traditions', label: 'Local traditions & festivals', value: 'local_traditions' },
      { id: 'film', label: 'Film & TV locations', value: 'film' },
      { id: 'literature', label: 'Literary landmarks', value: 'literature' },
    ],
  },

  // 10. Adventure Tolerance
  {
    id: 'adventure',
    category: 'adventure_tolerance',
    question: 'How adventurous are you?',
    subtext: 'Rate your comfort with trying new things',
    type: 'scale',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: {
      min: 'Play it safe',
      max: 'Thrill seeker',
    },
  },
];

export const QUIZ_CATEGORIES = [
  'cuisine_preferences',
  'activity_types',
  'budget_range',
  'travel_pace',
  'accommodation_style',
  'social_preferences',
  'accessibility_needs',
  'climate_preferences',
  'cultural_interests',
  'adventure_tolerance',
] as const;

export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];
