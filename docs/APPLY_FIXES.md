# How to Apply CRUD Fixes

## Quick Fix Guide

The CRUD operations weren't working due to:
1. ❌ Wrong API endpoint paths in frontend
2. ❌ Missing DELETE policy in database

Both issues have been fixed in the code. You just need to apply the database migration.

## Step 1: Apply Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste this SQL:

```sql
-- Add DELETE policy for itineraries table
CREATE POLICY "Users can delete their own itineraries" ON public.itineraries
  FOR DELETE USING (auth.uid() = user_id);
```

5. Click **Run** or press `Ctrl+Enter`
6. You should see "Success. No rows returned"

### Option B: Using Supabase CLI (If installed)

```bash
supabase db push
```

## Step 2: Verify the Fix

1. Restart your development server (if running):
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

2. Test these operations in your browser:
   - ✅ Delete an itinerary from the list page
   - ✅ Delete an itinerary from the detail page
   - ✅ Delete an activity from an itinerary
   - ✅ Reorder activities by dragging

## What Was Fixed

### Frontend Changes (Already Applied)
- ✅ Fixed activity delete endpoint: `/api/itinerary/[id]/activities/[activityId]`
- ✅ Fixed activity reorder endpoint: `/api/itinerary/[id]/activities/reorder`
- ✅ Added delete button to itinerary detail page
- ✅ Added delete button to itinerary list page
- ✅ Added confirmation dialogs for all delete operations

### Backend Changes (Need Migration)
- ⚠️ Added DELETE policy for itineraries table (requires SQL migration above)

## Troubleshooting

### If delete still doesn't work:

1. **Check if migration was applied:**
   - Go to Supabase Dashboard > Authentication > Policies
   - Look for "Users can delete their own itineraries" policy
   - If not there, re-run the SQL from Step 1

2. **Check browser console:**
   - Open DevTools (F12)
   - Look for errors when clicking delete
   - Common errors:
     - `403 Forbidden` = Policy not applied
     - `404 Not Found` = Wrong endpoint (shouldn't happen now)
     - `401 Unauthorized` = Not logged in

3. **Check server logs:**
   - Look at your terminal running `npm run dev`
   - Check for any error messages

4. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### If activity operations don't work:

1. **Verify you're on the itinerary detail page**
   - URL should be: `/itinerary/[some-uuid]`

2. **Check that activities exist**
   - Generate a new itinerary if needed

3. **Test drag and drop:**
   - Click and hold an activity card
   - Drag it to a new position
   - Release to drop

## Testing Checklist

After applying the migration, test:

- [ ] View itinerary list
- [ ] Click into an itinerary
- [ ] Delete an activity (click 🗑️ on activity card)
- [ ] Reorder activities (drag and drop)
- [ ] Delete itinerary from detail page (click 🗑️ Delete button)
- [ ] Go back to list
- [ ] Delete itinerary from list (click 🗑️ on card)
- [ ] Regenerate an itinerary

All operations should:
- Show confirmation dialogs
- Update the UI immediately
- Not show errors in console

## Need More Help?

Check `CRUD_FIXES.md` for detailed technical information about what was changed.
