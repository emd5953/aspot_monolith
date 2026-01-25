# ✈️ AI Itinerary Planner

An AI-powered travel itinerary planning platform with a hand-drawn aesthetic that creates personalized trip recommendations through a quiz-based preference system and enables collaborative trip planning.

## ✨ Key Features

### 🤖 AI-Powered Generation (3 Modes)
- **⚡ Fast Mode** (~5-12s): Quick AI generation for rapid drafts
- **🔄 Standard Agentic** (~45-70s): Multi-agent system with web research, planning, and quality review
- **🧠 Truly Agentic** (~60-90s): Advanced mode with reasoning chains, dynamic tool selection, and adaptive stopping

### 📝 Personalized Quiz System
- 10-question onboarding quiz covering travel style, preferences, and interests
- Captures activity types, cuisine preferences, budget, pace, and more
- AI-powered profile generation for personalized recommendations

### ✏️ Edit Day Feature (NEW)
- Regenerate a single day using natural language
- Example: "I want more food experiences and less museums"
- Fast regeneration (5-15 seconds) without affecting other days
- Context-aware AI that understands your preferences

### 💾 Auto-Save & Status Management
- Itineraries automatically saved when generated
- 4 status types: 📝 Draft, ✈️ Active, ✅ Completed, 📦 Archived
- Clickable status badges for instant updates
- No manual save needed

### 🎯 Complete CRUD Operations
- Create, read, update, and delete itineraries
- Add, edit, reorder, and delete activities
- Drag-and-drop activity reordering
- Move activities between days
- Full version history with revert capability

### 👥 Collaborative Trip Planning
- Create trips with shareable 6-character codes
- Invite members via invite links
- View and manage trip members
- Link itineraries to trips
- Real-time updates (via Supabase Realtime)

### 🗺️ Interactive Maps
- Google Maps integration
- Location markers for all activities
- Route visualization
- Destination autocomplete

### 🎨 Hand-Drawn UI
- Custom hand-drawn components (cards, buttons, inputs)
- Playful emojis and warm colors
- Wobbly borders and rotation effects
- Post-it notes, tape, and tack decorations

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL, Auth, Realtime)
- **AI**: OpenAI GPT-4o & GPT-4o-mini, Firecrawl for web scraping
- **Maps**: Google Maps API
- **Testing**: Vitest, Testing Library, fast-check for property-based testing
- **Styling**: Custom hand-drawn components, Caveat & Inter fonts

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project
- OpenAI API key (required for AI generation)
- Google Maps API key (required for maps)
- Firecrawl API key (optional, for web scraping in agentic modes)

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
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (Required)
OPENAI_API_KEY=your-openai-api-key

# Google Maps (Required)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Firecrawl (Optional - for agentic modes)
FIRECRAWL_API_KEY=your-firecrawl-api-key

# Optional Settings
FAST_MODE=true  # Enable fast mode by default
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
- `010_add_username_to_profiles.sql` - Add username support

You can apply all migrations at once using the Supabase CLI:
```bash
supabase db push
```

Or apply them manually in the Supabase Dashboard SQL Editor.

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (auth)/            # Authentication pages (login, signup)
│   ├── (protected)/       # Protected pages (dashboard, trips, quiz, etc.)
│   │   ├── dashboard/    # Main dashboard
│   │   ├── itinerary/    # Itinerary list and detail pages
│   │   ├── profile/      # User profile and preferences
│   │   ├── quiz/         # Onboarding quiz
│   │   └── trips/        # Collaborative trip planning
│   ├── api/               # API route handlers
│   │   ├── auth/         # Authentication endpoints
│   │   ├── itinerary/    # Itinerary CRUD + generation
│   │   ├── quiz/         # Quiz progress and completion
│   │   ├── trips/        # Trip collaboration
│   │   └── maps/         # Google Maps integration
│   └── auth/              # Auth callback handlers
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── itinerary/        # Itinerary display, editing, maps
│   ├── quiz/             # Quiz flow components
│   ├── trips/            # Trip collaboration components
│   └── ui/               # Hand-drawn UI components
├── lib/                   # Business logic and services
│   ├── ai/               # AI integration
│   │   ├── agents/       # Multi-agent system (orchestrator, planner, researcher, reviewer)
│   │   ├── itinerary-generator.ts  # Main generation logic
│   │   ├── firecrawl-service.ts    # Web scraping
│   │   └── sim-service.ts          # AI recommendations
│   ├── itinerary/        # Itinerary management
│   │   ├── itinerary-service.ts    # CRUD operations
│   │   ├── version-service.ts      # Version history
│   │   └── day-regeneration-service.ts  # Edit day feature
│   ├── maps/             # Google Maps service
│   ├── preferences/      # User preferences
│   ├── quiz/             # Quiz logic and profile generation
│   ├── supabase/         # Supabase client setup
│   └── trips/            # Trip collaboration logic
├── types/                 # TypeScript type definitions
├── data/                  # Static data (quiz questions)
└── test/                  # Test setup and fixtures
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

## 🔄 Key Workflows

### 1. User Onboarding
1. New user signs up (email/password or Google OAuth)
2. Completes 10-question travel preferences quiz
3. AI generates personalized traveler profile
4. Profile stored in Supabase for future recommendations

### 2. Itinerary Generation
1. User provides destination, dates, and optional title
2. Selects generation mode (Fast/Standard Agentic/Truly Agentic)
3. System generates itinerary:
   - **Fast Mode**: Single AI call (~5-12s)
   - **Standard Agentic**: Multi-agent with web research (~45-70s)
   - **Truly Agentic**: Advanced reasoning and adaptive stopping (~60-90s)
4. Itinerary auto-saved with `draft` status
5. User can view, edit, and manage itinerary

### 3. Editing & Refinement
1. View itinerary with day-by-day breakdown
2. Click "Edit Day" to regenerate a single day with natural language
3. Drag-and-drop to reorder activities
4. Add, edit, or delete individual activities
5. Change status (draft → active → completed → archived)
6. Regenerate entire itinerary with different focus areas

### 4. Collaborative Planning
1. User creates a trip and gets a 6-character invite code
2. Shares code with friends via invite link
3. Friends join and become trip members
4. Members can view and manage shared itineraries
5. Real-time updates sync across all members

## 📚 Documentation

### Start Here
- **[Current Features](docs/CURRENT_FEATURES.md)** ⭐ - Complete feature overview and API reference
- **[Documentation Index](docs/README.md)** - Guide to all documentation

### Feature Documentation
- [Edit Day Feature](docs/EDIT_DAY_FEATURE.md) - Single day regeneration with natural language
- [Itinerary Save Feature](docs/ITINERARY_SAVE_FEATURE.md) - Auto-save and status management
- [Agentic Workflow](docs/AGENTIC_WORKFLOW.md) - Multi-agent system architecture
- [Truly Agentic Mode](docs/TRULY_AGENTIC.md) - Advanced agentic AI with reasoning chains

### Setup & Configuration
- [Authentication Setup](docs/AUTH_SETUP.md) - Supabase auth configuration
- [Apply Fixes](docs/APPLY_FIXES.md) - Database migration guide
- [Itinerary API](docs/ITINERARY_API.md) - Complete API endpoint reference

### Technical Details
- [CRUD Fixes](docs/CRUD_FIXES.md) - CRUD operations implementation
- [Profile Update](docs/PROFILE_UPDATE.md) - Profile page features
- [Performance Optimization](docs/PERFORMANCE_OPTIMIZATION.md) - Performance best practices

## 🧪 Testing

The project uses a comprehensive testing strategy:

- **Unit Tests**: Core business logic and utilities
- **Property-Based Tests**: Using fast-check for invariant validation
- **Integration Tests**: API routes and database operations
- **E2E Tests**: Complete user workflows (planned)

Run tests with:
```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production
Make sure to set all required environment variables in your hosting platform:
- Supabase credentials
- OpenAI API key
- Google Maps API key
- Firecrawl API key (optional)

## 🎯 Performance

### Generation Times
- **Fast Mode**: 5-12 seconds
- **Standard Agentic**: 45-70 seconds  
- **Truly Agentic**: 60-90 seconds
- **Edit Single Day**: 5-15 seconds

### Optimization Features
- Parallel web scraping (4 sources simultaneously)
- Efficient AI model selection (GPT-4o-mini for speed)
- Adaptive stopping in Truly Agentic mode
- Caching of user preferences

## 🎨 Design System

The app uses a custom hand-drawn aesthetic:
- **Colors**: Red accent (#EF4444), Blue secondary (#3B82F6), Warm neutrals
- **Fonts**: Caveat (headings), Inter (body)
- **Components**: Hand-drawn cards, buttons, inputs with wobbly borders
- **Decorations**: Tape, tacks, post-it notes, rotation effects
- **Emojis**: Playful emojis throughout for visual interest

## 🔮 Roadmap

### Planned Features
- [ ] Weather integration for activity suggestions
- [ ] Budget tracking per day and activity
- [ ] Export to PDF and calendar formats
- [ ] Activity duration management
- [ ] Time-of-day preferences (morning person vs night owl)
- [ ] Undo/redo functionality
- [ ] Social sharing of itineraries
- [ ] Public itinerary templates
- [ ] Multi-language support
- [ ] Mobile app

### In Progress
- [x] Edit single day feature ✅
- [x] Auto-save functionality ✅
- [x] Status management ✅
- [x] Truly agentic mode ✅

## 🐛 Known Issues

- Drag and drop can be finicky on mobile devices
- Map markers sometimes overlap for nearby locations
- Long itinerary titles may overflow on mobile

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- Code follows TypeScript best practices
- Tests are added for new features
- Documentation is updated
- Commits are descriptive

## 📄 License

This project is private and proprietary.

## 💬 Support

For questions or issues:
1. Check the [documentation](docs/README.md)
2. Review [Current Features](docs/CURRENT_FEATURES.md)
3. Open an issue in the repository

---

**Built with ❤️ using Next.js, OpenAI, and Supabase**
