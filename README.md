# AI Itinerary Planner

An AI-powered travel itinerary planning platform that creates personalized trip recommendations through a quiz-based preference system and enables real-time collaborative trip planning with friends.

## Features

- **Personalized Quiz System**: Complete a comprehensive quiz about your travel preferences, interests, and style to build your unique traveler profile
- **AI-Powered Itinerary Generation**: Get customized day-by-day itineraries using SIM AI and Firecrawl for destination research
- **Collaborative Trip Planning**: Create trips, invite friends via shareable links, and plan together in real-time
- **Suggestion & Voting System**: Members can propose activities and vote democratically on trip decisions
- **RSVP Management**: Track attendance for activities with flexible RSVP options
- **Version History**: Revert to previous itinerary versions if needed
- **Real-time Synchronization**: See changes from other trip members instantly using Supabase Realtime

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL, Auth, Realtime)
- **AI Services**: SIM AI for recommendations, Firecrawl for destination data
- **Testing**: Vitest, Testing Library, fast-check for property-based testing

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- A Supabase account and project
- SIM AI API access (optional for full functionality)
- Firecrawl API access (optional for full functionality)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-itinerary-planner
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Set up the database:

Run the migrations in your Supabase project (found in `supabase/migrations/`):
- `001_initial_schema.sql` - Core database schema
- `002_row_level_security.sql` - Security policies
- `003_realtime.sql` - Real-time subscriptions
- `004_profile_trigger.sql` - Auto-create user profiles
- `005_itinerary_versions.sql` - Version history support
- `006_fix_trip_members_policy.sql` - Trip member access fixes
- `007_fix_trips_recursion.sql` - Recursion fixes
- `008_fix_recursion_with_functions.sql` - Function-based fixes
- `009_add_itinerary_delete_policy.sql` - Enable itinerary deletion

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (auth)/            # Authentication pages (login, signup)
│   ├── (protected)/       # Protected pages (dashboard, trips, quiz, etc.)
│   ├── api/               # API route handlers
│   └── auth/              # Auth callback handlers
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── itinerary/        # Itinerary display and editing
│   ├── quiz/             # Quiz flow components
│   ├── trips/            # Trip collaboration components
│   └── ui/               # Reusable UI components
├── lib/                   # Business logic and services
│   ├── ai/               # AI integration (SIM, Firecrawl)
│   ├── itinerary/        # Itinerary management
│   ├── preferences/      # User preferences
│   ├── quiz/             # Quiz logic
│   ├── supabase/         # Supabase client setup
│   └── trips/            # Trip collaboration logic
├── types/                 # TypeScript type definitions
└── data/                  # Static data (quiz questions)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Key Workflows

### 1. User Onboarding
- New users complete a personalized quiz covering travel preferences
- Quiz responses generate a user profile stored in Supabase
- Profile is used to personalize all future itinerary recommendations

### 2. Itinerary Generation
- User provides destination, dates, and trip duration
- System fetches destination data via Firecrawl
- SIM AI generates personalized recommendations based on user profile
- Day-by-day itinerary is created with activities, times, and locations

### 3. Collaborative Planning
- User creates a trip and gets a shareable invite link
- Friends join via the link and become trip members
- Members can suggest activities, vote on proposals, and RSVP to events
- All changes sync in real-time across all connected members

## Documentation

- [Authentication Setup](docs/AUTH_SETUP.md) - Supabase auth configuration
- [Performance Optimization](docs/PERFORMANCE_OPTIMIZATION.md) - Performance best practices
- [Requirements](/.kiro/specs/ai-itinerary-planner/requirements.md) - Detailed requirements
- [Design Document](/.kiro/specs/ai-itinerary-planner/design.md) - Technical design and architecture

## Testing

The project uses a comprehensive testing strategy:

- **Unit Tests**: Core business logic and utilities
- **Property-Based Tests**: Using fast-check for invariant validation
- **Integration Tests**: API routes and database operations
- **E2E Tests**: Complete user workflows (planned)

Run tests with:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Support

For questions or issues, please open an issue in the repository.
