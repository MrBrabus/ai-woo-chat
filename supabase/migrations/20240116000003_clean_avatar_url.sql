/**
 * Migration: Clean avatar_url from user_metadata
 * 
 * This migration removes avatar_url from all user_metadata in auth.users table
 * to fix the 431 error (Request Header Fields Too Large) caused by base64 avatar images
 * being serialized into JWT tokens and cookies.
 * 
 * The avatar_url field contains base64-encoded images that are too large for cookies,
 * causing Supabase to fragment the JWT token into many small cookies (sb-*-auth-token.0, .1, .2, etc.)
 * which still exceed header size limits.
 */

-- Direct UPDATE to remove avatar_url from all users' metadata
-- Using jsonb - operator to remove the avatar_url key
UPDATE auth.users
SET 
  raw_user_meta_data = raw_user_meta_data - 'avatar_url',
  updated_at = NOW()
WHERE 
  raw_user_meta_data ? 'avatar_url';
