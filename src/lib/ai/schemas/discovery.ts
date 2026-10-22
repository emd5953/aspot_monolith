import { z } from 'zod';

export const DiscoveryRequestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().trim().min(1).max(1000),
        })
      )
      .min(1)
      .max(12),
  })
  .refine((request) => request.messages.at(-1)?.role === 'user', {
    message: 'Last message must be from the user',
  });

export const DiscoveryIntentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  genres: z.array(z.string()),
  area: z.string().optional(),
  maxPrice: z.number().nonnegative().optional(),
  freeOnly: z.boolean(),
  category: z.enum(['nightlife', 'live_music', 'social']).optional(),
});

export const EventRecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  when: z.string(),
  location: z.string(),
  price: z.string(),
  availability: z.string(),
  reasons: z.array(z.string()),
  caveats: z.array(z.string()),
  sources: z.array(z.object({ source: z.string(), url: z.string().url(), fetchedAt: z.string() })),
});
export const DiscoveryResponseSchema = z.object({
  intent: DiscoveryIntentSchema,
  status: z.enum(['recommendations', 'clarification', 'no_matches']),
  reply: z.string(),
  recommendations: z.array(EventRecommendationSchema),
});
export type DiscoveryRequest = z.infer<typeof DiscoveryRequestSchema>;
export type DiscoveryIntent = z.infer<typeof DiscoveryIntentSchema>;
export type EventRecommendation = z.infer<typeof EventRecommendationSchema>;
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;
