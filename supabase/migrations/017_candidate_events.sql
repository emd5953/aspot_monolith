-- Candidate events pool: the "what's happening in NYC" store.
-- Populated by scheduled source connectors (posh, luma, partiful, tiktok, places).
-- Generation reads from this pool; it never fetches sources live.

CREATE TABLE public.candidate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('posh', 'luma', 'partiful', 'tiktok', 'places', 'manual')),
  source_id TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  venue_name TEXT,
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  is_free BOOLEAN DEFAULT FALSE,
  hype JSONB DEFAULT '{}',          -- guest_count, ticket_count, etc. per source
  tags TEXT[] DEFAULT '{}',          -- vibe tags from normalization
  raw JSONB NOT NULL,                -- full source payload (provenance)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,            -- usually ends_at; pool GC uses this
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_id)
);

CREATE INDEX idx_candidate_events_starts_at ON public.candidate_events (starts_at);
CREATE INDEX idx_candidate_events_expires_at ON public.candidate_events (expires_at);
CREATE INDEX idx_candidate_events_geo ON public.candidate_events (lat, lng);

-- Service-role writes only (ingestion runs server-side); authenticated users read.
ALTER TABLE public.candidate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_events_read" ON public.candidate_events
  FOR SELECT TO authenticated USING (true);
