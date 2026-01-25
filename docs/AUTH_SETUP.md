# Authentication Setup Guide

## Issues Fixed

1. **Email/Password Login** - Changed from client-side navigation (`router.push`) to full page reload (`window.location.href`) to properly refresh server-side session
2. **OAuth Redirect URLs** - Added explicit `redirectTo` parameter pointing to `/auth/callback`
3. **Message Display** - Added support for displaying confirmation messages on login page

## Required Supabase Configuration

To complete the authentication setup, you need to configure the following in your Supabase project:

### 1. Site URL Configuration
Go to: **Authentication > URL Configuration** in Supabase Dashboard

- **Site URL**: `http://localhost:3000` (for development)
- For production, set this to your actual domain

### 2. Redirect URLs
Add these URLs to **Redirect URLs** (whitelist):

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/**` (wildcard for all routes)
- For production, add your production domain URLs

### 3. Email Confirmation (Optional)
Go to: **Authentication > Email Templates**

If you want to disable email confirmation for testing:
- Go to **Authentication > Providers > Email**
- Toggle off "Confirm email"

### 4. Google OAuth (If using)
Go to: **Authentication > Providers > Google**

1. Enable Google provider
2. Add your Google OAuth credentials:
   - Client ID
   - Client Secret
3. Ensure redirect URL is set to: `https://[your-project-ref].supabase.co/auth/v1/callback`

## Testing

1. **Email/Password Signup**:
   - Go to `/signup`
   - Fill in the form
   - If email confirmation is enabled, check your email
   - Login at `/login`

2. **Email/Password Login**:
   - Go to `/login`
   - Enter credentials
   - Should redirect to `/dashboard`

3. **Google OAuth**:
   - Click "Sign in with Google" on either page
   - Complete Google authentication
   - Should redirect back to `/dashboard`

## Troubleshooting

- **Still redirecting to landing page**: Check browser console for errors
- **OAuth not working**: Verify redirect URLs in Supabase dashboard
- **Email confirmation issues**: Check Supabase email templates and SMTP settings
