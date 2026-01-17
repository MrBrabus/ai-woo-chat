# Email Service Implementation

## Overview

✅ **To-Do #12: Email Service - COMPLETED**

Resend email service has been fully implemented with logging and dashboard settings integration.

## Components

### 1. Resend Client (`src/lib/email/resend-client.ts`)

**Purpose**: Resend API integration for sending emails

**Functions**:
- `sendEmail()` - Generic email sending
- `sendConversationSummaryEmail()` - Pre-formatted conversation summary emails

**Features**:
- HTML and plain text support
- Multiple recipients (to, cc, bcc)
- Reply-to support
- Tags for tracking
- Error handling

**Configuration**:
- Uses `RESEND_API_KEY` environment variable
- Default from email: `RESEND_FROM_EMAIL` or `noreply@aiwoochat.com`

### 2. Email Logger (`src/lib/email/logger.ts`)

**Purpose**: Logs all email sends to database

**Functions**:
- `logEmail()` - Log email send attempt
- `getEmailLogs()` - Retrieve email logs for a site

**Database Table**: `emails`
- `site_id` - Site that sent the email
- `conversation_id` - Associated conversation (optional)
- `to` - Recipient(s) (comma-separated if multiple)
- `subject` - Email subject
- `resend_message_id` - Resend API message ID
- `status` - `sent`, `failed`, or `pending`
- `error_message` - Error details if failed
- `metadata` - JSONB for additional context
- `created_at` - Timestamp

### 3. Email Service (`src/lib/email/service.ts`)

**Purpose**: Main service combining Resend client with logging

**Functions**:
- `sendEmailWithLogging()` - Send email and log automatically
- `sendConversationSummaryWithLogging()` - Send conversation summary with logging
- `getEmailSettings()` - Get email settings for a site
- `updateEmailSettings()` - Update email settings for a site

**Settings Storage**: Uses `settings` table with `key='email'`
- `enabled` - Enable/disable email service
- `from_email` - Default sender email
- `reply_to` - Reply-to email address
- `send_conversation_summaries` - Enable conversation summaries
- `summary_recipients` - Array of email addresses for summaries

### 4. Conversation Integration (`src/lib/email/conversation-integration.ts`)

**Purpose**: Integrate email service with conversation flow

**Functions**:
- `sendConversationSummaryIfEnabled()` - Send summary if enabled in settings

**Features**:
- Checks email settings before sending
- Retrieves conversation messages
- Formats HTML and plain text emails
- Sends to configured recipients
- Non-blocking (errors don't break conversation flow)

### 5. API Endpoints

#### POST /api/email/send (`src/api/email/send/route.ts`)
- **Authentication**: Required (dashboard users)
- **Purpose**: Send custom emails
- **Request**: `{ site_id, conversation_id?, to, subject, html?, text?, from?, reply_to?, metadata? }`
- **Response**: `{ success: true, message_id: string }`

#### GET /api/email/logs (`src/api/email/logs/route.ts`)
- **Authentication**: Required (dashboard users)
- **Purpose**: Get email logs for a site
- **Query Params**: `site_id`, `limit?`, `offset?`
- **Response**: `{ logs: [...], pagination: {...} }`

#### GET /api/email/settings (`src/api/email/settings/route.ts`)
- **Authentication**: Required (dashboard users)
- **Purpose**: Get email settings for a site
- **Query Params**: `site_id`
- **Response**: `{ enabled, fromEmail?, replyTo?, sendConversationSummaries, summaryRecipients? }`

#### PUT /api/email/settings (`src/api/email/settings/route.ts`)
- **Authentication**: Required (dashboard users)
- **Purpose**: Update email settings for a site
- **Request**: `{ site_id, enabled?, from_email?, reply_to?, send_conversation_summaries?, summary_recipients? }`
- **Response**: `{ success: true }`

### 6. Dashboard Settings Page (`src/app/dashboard/settings/email/page.tsx`)

**Purpose**: UI for configuring email settings

**Features**:
- Enable/disable email service
- Configure from email and reply-to
- Enable/disable conversation summaries
- Manage summary recipients (add/remove)
- Save settings

**UI Components**:
- Checkbox for enabling email service
- Input fields for email addresses
- Recipient list with add/remove functionality
- Save button

### 7. Email Logging (DB LOCK Compliance)

**Purpose**: Log email sends for tracking and audit

**Current Implementation** (DB LOCKED):
- Uses existing `audit_logs` table
- Action types: `email_sent`, `email_failed`, `email_pending`
- Email metadata stored in `audit_logs.metadata` JSONB column
- Includes: `to`, `subject`, `resend_message_id`, `status`, `error_message`, `conversation_id`

**Future Schema** (After DB Unlock):
- See `docs/email-schema-draft.sql` for planned `emails` table schema
- Will be migrated from `audit_logs` to dedicated `emails` table
- Schema includes proper indexes, RLS policies, and foreign keys

## Integration Points

### Settings Storage
- Uses existing `settings` table with `key='email'`
- Versioned settings (automatic versioning via trigger)
- Settings history tracked in `settings_history` table

### Conversation Flow
- Email summaries can be triggered when conversations end
- Integration function: `sendConversationSummaryIfEnabled()`
- Can be called from:
  - Conversation completion webhook (future)
  - Manual trigger from dashboard (future)
  - Scheduled job (future)

## Email Templates

### Conversation Summary Email
- **HTML**: Formatted with conversation messages
- **Plain Text**: Fallback for email clients
- **Content**: All messages in conversation
- **Link**: Optional conversation URL
- **Branding**: Site name included

## Error Handling

- **Resend API Errors**: Logged but don't break flow
- **Database Logging Errors**: Silent failures (logging shouldn't break email sending)
- **Settings Errors**: Returned to user via API response
- **Missing Configuration**: Graceful defaults (email service disabled)

## Security

- **Authentication**: All endpoints require dashboard user authentication
- **Authorization**: Users can only access emails for their tenant's sites
- **API Key**: `RESEND_API_KEY` stored in environment variables (server-side only)
- **No Secrets in Client**: Email settings don't expose API keys

## Usage Examples

### Send Custom Email
```typescript
import { sendEmailWithLogging } from '@/lib/email/service';

await sendEmailWithLogging({
  siteId: 'site_123',
  to: 'customer@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to our store!</h1>',
  text: 'Welcome to our store!',
});
```

### Send Conversation Summary
```typescript
import { sendConversationSummaryIfEnabled } from '@/lib/email/conversation-integration';

await sendConversationSummaryIfEnabled(
  'site_123',
  'conv_456',
  'customer@example.com'
);
```

### Get Email Settings
```typescript
import { getEmailSettings } from '@/lib/email/service';

const settings = await getEmailSettings('site_123');
if (settings.enabled && settings.sendConversationSummaries) {
  // Send summaries
}
```

## Future Enhancements

1. **Email Templates**: Pre-built templates for common emails
2. **Scheduled Emails**: Send summaries on schedule (daily/weekly)
3. **Email Analytics**: Track open rates, click rates (via Resend webhooks)
4. **Custom Templates**: Allow users to customize email templates
5. **Bulk Sending**: Support for bulk email campaigns
6. **Webhook Integration**: Resend webhooks for delivery status updates

## Testing Recommendations

1. Test email sending with valid Resend API key
2. Test email logging (success and failure cases)
3. Test settings retrieval and update
4. Test conversation summary generation
5. Test dashboard UI (enable/disable, add recipients)
6. Test error handling (invalid API key, network failures)
7. Test authorization (users can only access their tenant's emails)
