# Logging System

## Overview

The application uses a dual logging system:
1. **Console logging** - for immediate debugging (stdout/stderr)
2. **File logging** - for persistent logs stored in `logs/` directory

## Log Files

Logs are written to `logs/app-YYYY-MM-DD.log` files with:
- **Daily rotation** - new file each day
- **Size limit** - files larger than 10MB are rotated
- **Retention** - keeps last 7 days of logs automatically
- **Format** - JSON lines (one log entry per line)

## Log Structure

Each log entry follows this structure:

```json
{
  "timestamp": "2024-01-18T10:30:00.000Z",
  "level": "info|warn|error|debug",
  "message": "Log message",
  "context": {
    "request_id": "req_...",
    "site_id": "...",
    "conversation_id": "...",
    "visitor_id": "..."
  },
  "error": {
    "name": "ErrorName",
    "message": "Error message",
    "stack": "Error stack trace"
  }
}
```

## Usage

### Server-side (Next.js)

```typescript
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ 
  request_id: 'req_123',
  site_id: 'site_456' 
});

logger.info('Processing request');
logger.warn('Rate limit approaching', { remaining: 5 });
logger.error('API call failed', error, { endpoint: '/api/chat/message' });
logger.debug('Debug information', { data: {...} });
```

### Viewing Logs

#### Option 1: API Endpoint

```bash
# Get last 100 logs
curl https://app.aiwoochat.com/api/logs

# Get last 50 error logs
curl https://app.aiwoochat.com/api/logs?limit=50&level=error

# Get last 20 warnings
curl https://app.aiwoochat.com/api/logs?limit=20&level=warn
```

#### Option 2: Direct File Access (SSH)

```bash
# View today's logs
tail -f logs/app-$(date +%Y-%m-%d).log

# Search for errors
grep '"level":"error"' logs/app-*.log

# View last 100 lines
tail -n 100 logs/app-$(date +%Y-%m-%d).log

# Pretty print JSON logs
cat logs/app-$(date +%Y-%m-%d).log | jq '.'
```

#### Option 3: cPanel File Manager

1. Navigate to `logs/` directory
2. Open `app-YYYY-MM-DD.log` file
3. Use browser's search (Ctrl+F) to find specific entries

## Log Levels

- **debug** - Detailed debugging information
- **info** - General informational messages
- **warn** - Warning messages (non-critical issues)
- **error** - Error messages (failures that need attention)

## Best Practices

1. **Always include context** - Add relevant IDs (request_id, site_id, etc.)
2. **Use appropriate levels** - Don't log everything as error
3. **Include error objects** - Pass Error objects to logger.error()
4. **Don't log sensitive data** - Avoid logging passwords, API keys, etc.

## Troubleshooting

### Logs not being written

1. Check file permissions on `logs/` directory
2. Ensure disk space is available
3. Check server logs for file system errors

### Logs directory missing

The system will automatically create `logs/` directory on first write.

### Too many log files

Old log files (older than 7 days) are automatically deleted. You can also manually clean:

```bash
# Keep only today's log
rm logs/app-*.log
# (today's file will be recreated automatically)
```

## WordPress Plugin Logging

For WordPress plugin logs, check:
- WordPress debug log: `wp-content/debug.log`
- PHP error log: (check cPanel error logs)

To enable WordPress debug logging, add to `wp-config.php`:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```
