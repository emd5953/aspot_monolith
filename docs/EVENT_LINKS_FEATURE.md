# Event Links Feature

## Overview
Added support for event/booking links and accurate addresses in activities. When scraping events and venues, the system now extracts URLs and addresses, which are displayed in the activity cards.

## Changes Made

### 1. Database Schema
- The `booking_url` field already exists in the `activities` table (from migration 001)
- No database changes needed

### 2. Backend Changes

#### `src/lib/itinerary/day-regeneration-service.ts`
- Added `eventLink` and `address` fields to `ScrapedPlace` interface
- Updated `extractPlacesFromContent()` to extract both URLs and addresses from scraped content
  - Looks for URLs in the current line and next 3 lines after finding a place
  - Extracts addresses using multiple patterns (e.g., "123 Main St", "456 Broadway")
  - Removes trailing punctuation from URLs
  - Validates address length (10-100 chars)
- Updated AI prompts to include both event links and addresses in the data passed to the model
- Added **CRITICAL** instruction to AI: Use EXACT addresses from scraped data, don't make up addresses
- Modified activity generation to include `bookingUrl` in the output
- Updated all activity type definitions to include `bookingUrl?: string`

#### `src/lib/itinerary/itinerary-service.ts`
- Added `bookingUrl` to `Activity` interface
- Added `bookingUrl` to `ActivityInput` interface
- Updated `addActivity()` to save `booking_url` to database
- Updated `updateActivity()` to handle `booking_url` updates
- Updated `mapActivityFromDb()` to map `booking_url` from database

### 3. Frontend Changes

#### `src/components/itinerary/activity-card.tsx`
- Added `bookingUrl` to `Activity` interface
- Added event link display with 🎟️ emoji
- Link opens in new tab with proper security attributes
- Styled with accent color and solid underline to differentiate from location link

## How It Works

1. **Scraping**: When scraping events/venues, the system looks for:
   - URLs near place names
   - Street addresses using regex patterns
2. **AI Generation**: URLs and addresses are passed to the AI model in the prompt:
   - `[Link: URL]` format for event links
   - `[Address: 123 Main St]` format for addresses
3. **AI Instructions**: The AI is explicitly told to use EXACT addresses from scraped data and NOT make up addresses
4. **Storage**: The AI includes the URL in the `bookingUrl` field and real address in `locationName`
5. **Display**: Activity cards show:
   - 📍 Location link (Google Maps) with real address
   - 🎟️ Event Link button when a URL is available

## Address Extraction Patterns

The system looks for addresses matching:
- `\d+\s+[NSEW]?\.?\s*\w+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Place|Pl|Court|Ct)`
- Examples: "337 Lafayette St", "902 Broadway", "10 E 21st Street"

## Example Output

When a user requests "add tech event, add streetwear shop", the system:
1. Scrapes Google/Reddit for tech events and streetwear shops
2. Extracts event names, addresses, and URLs
3. Passes them to AI: 
   - `- Kith: Streetwear shop [Address: 337 Lafayette St, New York, NY] [Link: https://kith.com]`
   - `- General Assembly: Tech meetup [Address: 902 Broadway, New York, NY]`
4. AI generates activities with:
   - `locationName: "337 Lafayette St, New York, NY"` (exact address)
   - `bookingUrl: "https://kith.com"` (if available)
5. Activity card displays accurate location and event link

## Benefits

- **Accurate addresses**: No more made-up locations, uses real scraped addresses
- **Direct booking**: Users can access event pages for tickets/details
- **Verification**: Real addresses and URLs prove events/venues are legitimate
- **Better maps**: Accurate addresses show correct pins on Google Maps
- **Works for**: concerts, sports games, conferences, shows, shops, restaurants, etc.
