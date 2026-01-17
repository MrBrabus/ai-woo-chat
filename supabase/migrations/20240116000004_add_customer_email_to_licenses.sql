/**
 * Migration: Add customer_email to licenses table
 * 
 * This migration adds a customer_email field to the licenses table to store
 * the email address of the customer who purchased the license. This email
 * is used for:
 * 1. Creating user accounts on the platform
 * 2. Sending activation/welcome emails
 * 3. Linking licenses to tenant user accounts
 */

-- Add customer_email column to licenses table
ALTER TABLE licenses
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Create index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_licenses_customer_email ON licenses(customer_email) WHERE customer_email IS NOT NULL;

-- Add constraint to ensure email format (optional, but recommended)
-- This will allow NULL (for backward compatibility) but validate format if provided
ALTER TABLE licenses
ADD CONSTRAINT check_customer_email_format 
CHECK (
    customer_email IS NULL 
    OR customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
);

-- Add comment
COMMENT ON COLUMN licenses.customer_email IS 'Email address of the customer who purchased this license. Used for user account creation and activation emails.';
