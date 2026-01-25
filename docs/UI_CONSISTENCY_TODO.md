# UI Consistency Audit - Hand-Drawn Aesthetic

## ✅ Already Consistent:
- `src/components/itinerary/generate-form.tsx` - Uses HandDrawnCard, HandDrawnButton, HandDrawnInput
- `src/components/quiz/*` - Quiz components use hand-drawn style
- `src/app/globals.css` - Design system defined

## ❌ Needs Update:

### High Priority (User-facing pages):
1. **src/components/itinerary/itinerary-view.tsx**
   - Replace `bg-white rounded-xl shadow-sm` with `HandDrawnCard`
   - Replace standard buttons with `HandDrawnButton`
   - Update status badges to hand-drawn style

2. **src/components/itinerary/activity-card.tsx**
   - Replace `bg-white rounded-lg` with `HandDrawnCard`
   - Update hover states to hand-drawn style

3. **src/components/itinerary/day-schedule.tsx**
   - Replace `bg-gray-50 rounded-xl` with `HandDrawnCard`
   - Update buttons to `HandDrawnButton`

4. **src/app/(protected)/itinerary/page.tsx**
   - List view needs hand-drawn cards
   - Empty state needs styling

5. **src/app/(protected)/itinerary/[id]/page.tsx**
   - Loading overlay needs hand-drawn style

### Medium Priority (Secondary pages):
6. **src/app/(protected)/trips/page.tsx**
   - Trip cards need hand-drawn style
   - Join form needs HandDrawnInput

7. **src/app/(protected)/trips/[id]/page.tsx**
   - Trip detail page styling

8. **src/components/trips/create-trip-modal.tsx**
   - Modal needs hand-drawn card style

9. **src/components/trips/invite-link.tsx**
   - Code display needs styling

10. **src/components/trips/member-list.tsx**
    - Member cards need hand-drawn style

### Low Priority (Profile pages):
11. **src/app/(protected)/profile/page.tsx**
12. **src/app/(protected)/profile/edit/page.tsx**

## Changes Needed:
- Replace `bg-white` → `bg-card` or use `HandDrawnCard`
- Replace `rounded-xl` / `rounded-lg` → `border-wobbly-md` or use components
- Replace `shadow-sm` → `shadow-hand` or `shadow-hand-subtle`
- Replace standard buttons → `HandDrawnButton`
- Replace standard inputs → `HandDrawnInput`
- Add emojis and playful language
- Use `font-heading` for titles, `font-body` for text
- Replace blue colors → `accent` (red) or `secondary-accent` (blue)
