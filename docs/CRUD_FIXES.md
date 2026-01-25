# CRUD Operations Fixes

## Issues Found and Fixed

### 1. ✅ Fixed API Endpoint Paths
**Problem:** Frontend was calling incorrect API endpoints
- Was calling: `/api/activity/${activityId}` 
- Should be: `/api/itinerary/${id}/activities/${activityId}`
- Was calling: `/api/day/${dayId}/reorder`
- Should be: `/api/itinerary/${id}/activities/reorder`

**Fixed in:** `src/app/(protected)/itinerary/[id]/page.tsx`

### 2. ✅ Added Missing DELETE Policy
**Problem:** No RLS policy for deleting itineraries
**Solution:** Created migration `009_add_itinerary_delete_policy.sql`

### 3. ✅ Added Delete UI Components
- Added delete button to itinerary detail view
- Added delete button to itinerary list view
- Both include confirmation dialogs

## To Apply These Fixes

### Step 1: Apply Database Migration
Run the new migration to add the DELETE policy:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually in Supabase Dashboard SQL Editor:
CREATE POLICY "Users can delete their own itineraries" ON public.itineraries
  FOR DELETE USING (auth.uid() = user_id);
```

### Step 2: Restart Development Server
The code changes are already applied. Just restart your dev server:

```bash
npm run dev
```

## Testing Checklist

After applying fixes, test these operations:

### Itinerary Operations
- [ ] View itinerary list
- [ ] View itinerary details
- [ ] Delete itinerary from detail page
- [ ] Delete itinerary from list page
- [ ] Regenerate itinerary

### Activity Operations
- [ ] View activities in a day
- [ ] Delete an activity
- [ ] Reorder activities (drag & drop)
- [ ] Edit activity (if implemented)

### Expected Behavior
- All operations should show confirmation dialogs
- Successful operations should refresh the UI
- Failed operations should show error messages
- Deleted items should disappear from the list

## API Endpoints Reference

### Itinerary Endpoints
- `GET /api/itinerary/list` - List all itineraries
- `GET /api/itinerary/[id]` - Get single itinerary
- `POST /api/itinerary/generate` - Generate new itinerary
- `PATCH /api/itinerary/[id]` - Update itinerary
- `DELETE /api/itinerary/[id]` - Delete itinerary ✅
- `POST /api/itinerary/[id]/regenerate` - Regenerate itinerary

### Activity Endpoints
- `GET /api/itinerary/[id]/activities/[activityId]` - Get activity
- `PATCH /api/itinerary/[id]/activities/[activityId]` - Update activity
- `DELETE /api/itinerary/[id]/activities/[activityId]` - Delete activity ✅
- `POST /api/itinerary/[id]/activities/reorder` - Reorder activities ✅

## Common Issues

### If operations still fail:

1. **Check Authentication**
   - Ensure user is logged in
   - Check browser console for auth errors

2. **Check Database Connection**
   - Verify `.env.local` has correct Supabase credentials
   - Test connection in Supabase dashboard

3. **Check RLS Policies**
   - Verify migration was applied
   - Check Supabase dashboard > Authentication > Policies

4. **Check Browser Console**
   - Look for network errors (404, 403, 500)
   - Check for JavaScript errors

5. **Check Server Logs**
   - Look at terminal running `npm run dev`
   - Check for API route errors
