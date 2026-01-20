/**
 * Usage tracking and cost calculation utilities
 * Handles logging usage events and updating daily aggregates
 */

import { createAdminClient } from './supabase/server';

const supabaseAdmin = createAdminClient();

// OpenAI model pricing (per 1K tokens) - update as needed
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'text-embedding-3-small': { prompt: 0.00002, completion: 0 },
  'text-embedding-3-large': { prompt: 0.00013, completion: 0 },
  'text-embedding-ada-002': { prompt: 0.0001, completion: 0 },
};

export interface UsageEventData {
  tenant_id: string;
  site_id: string;
  conversation_id?: string | null;
  type: 'chat' | 'embedding';
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms?: number;
  success: boolean;
  error_code?: string | null;
}

export interface UsageLimitCheck {
  allowed: boolean;
  reason?: string;
  current_usage?: {
    chat_requests: number;
    embedding_requests: number;
    total_tokens: number;
  };
  limits?: {
    max_tokens_per_day: number;
    max_chat_requests_per_day: number;
    max_embedding_tokens_per_day: number;
  };
}

/**
 * Calculate estimated cost for a usage event
 */
export function calculateCost(
  model: string,
  prompt_tokens: number,
  completion_tokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    // Default fallback pricing
    return (prompt_tokens * 0.001 + completion_tokens * 0.002) / 1000;
  }

  return (
    (prompt_tokens * pricing.prompt + completion_tokens * pricing.completion) /
    1000
  );
}

/**
 * Log a usage event to the database
 */
export async function logUsageEvent(
  supabase: ReturnType<typeof createClient>,
  event: UsageEventData
): Promise<void> {
  const { error } = await supabase.from('usage_events').insert({
    tenant_id: event.tenant_id,
    site_id: event.site_id,
    conversation_id: event.conversation_id,
    type: event.type,
    model: event.model,
    prompt_tokens: event.prompt_tokens,
    completion_tokens: event.completion_tokens,
    total_tokens: event.total_tokens,
    latency_ms: event.latency_ms,
    success: event.success,
    error_code: event.error_code,
  });

  if (error) {
    console.error('Failed to log usage event:', error);
    // Don't throw - usage logging should not break the main flow
  }
}

/**
 * Update daily usage aggregate
 */
export async function updateDailyUsage(
  supabase: ReturnType<typeof createClient>,
  site_id: string,
  tenant_id: string,
  type: 'chat' | 'embedding',
  tokens: number,
  cost: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Get current daily usage (don't use .single() - might not exist yet)
  const { data: currentData, error: currentError } = await supabase
    .from('usage_daily')
    .select('*')
    .eq('date', today)
    .eq('site_id', site_id)
    .maybeSingle(); // Use maybeSingle() instead of single() - returns null if no row found

  const current = currentError ? null : currentData;

  if (current) {
    // Update existing record
    const updateData: any = {
      total_tokens: current.total_tokens + tokens,
      estimated_cost: Number(current.estimated_cost) + cost,
      updated_at: new Date().toISOString(),
    };

    if (type === 'chat') {
      updateData.chat_requests = current.chat_requests + 1;
    } else {
      updateData.embedding_requests = current.embedding_requests + 1;
    }

    const { error } = await supabase
      .from('usage_daily')
      .update(updateData)
      .eq('date', today)
      .eq('site_id', site_id);

    if (error) {
      console.error('Failed to update daily usage:', error);
    }
  } else {
    // Insert new record
    const insertData: any = {
      date: today,
      site_id,
      tenant_id,
      chat_requests: type === 'chat' ? 1 : 0,
      embedding_requests: type === 'embedding' ? 1 : 0,
      total_tokens: tokens,
      estimated_cost: cost,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('usage_daily').insert(insertData);

    if (error) {
      console.error('Failed to insert daily usage:', error);
    }
  }
}

/**
 * Check if usage limits are exceeded for a site
 */
export async function checkUsageLimits(
  supabase: ReturnType<typeof createClient>,
  site_id: string,
  type: 'chat' | 'embedding',
  requested_tokens: number
): Promise<UsageLimitCheck> {
  // Get site and license info
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('tenant_id, license_id')
    .eq('id', site_id)
    .single();

  if (siteError || !site) {
    return {
      allowed: false,
      reason: 'Site not found',
    };
  }

  // Get license and plan limits
  const { data: license, error: licenseError } = await supabase
    .from('licenses')
    .select('status, plan_limits')
    .eq('id', site.license_id)
    .single();

  if (licenseError || !license) {
    return {
      allowed: false,
      reason: 'License not found',
    };
  }

  // Check license status
  if (license.status !== 'active') {
    return {
      allowed: false,
      reason: `License is ${license.status}`,
    };
  }

  // Get plan limits
  const plan_limits = license.plan_limits as {
    max_tokens_per_day?: number;
    max_chat_requests_per_day?: number;
    max_embedding_tokens_per_day?: number;
  };

  const max_tokens_per_day =
    plan_limits?.max_tokens_per_day ?? 1000000;
  const max_chat_requests_per_day =
    plan_limits?.max_chat_requests_per_day ?? 1000;
  const max_embedding_tokens_per_day =
    plan_limits?.max_embedding_tokens_per_day ?? 100000;

  // Get today's usage (don't use .single() - might not exist yet)
  const today = new Date().toISOString().split('T')[0];
  const { data: dailyUsage, error: dailyUsageError } = await supabase
    .from('usage_daily')
    .select('chat_requests, embedding_requests, total_tokens')
    .eq('date', today)
    .eq('site_id', site_id)
    .maybeSingle(); // Use maybeSingle() instead of single() - returns null if no row found

  const current_usage = {
    chat_requests: dailyUsage?.chat_requests ?? 0,
    embedding_requests: dailyUsage?.embedding_requests ?? 0,
    total_tokens: dailyUsage?.total_tokens ?? 0,
  };

  // Check limits
  if (type === 'chat') {
    // Check chat request limit
    if (current_usage.chat_requests >= max_chat_requests_per_day) {
      return {
        allowed: false,
        reason: 'Daily chat request limit reached',
        current_usage,
        limits: {
          max_tokens_per_day,
          max_chat_requests_per_day,
          max_embedding_tokens_per_day,
        },
      };
    }

    // Check token limit (for chat, we check total tokens)
    if (
      current_usage.total_tokens + requested_tokens >
      max_tokens_per_day
    ) {
      return {
        allowed: false,
        reason: 'Daily token limit would be exceeded',
        current_usage,
        limits: {
          max_tokens_per_day,
          max_chat_requests_per_day,
          max_embedding_tokens_per_day,
        },
      };
    }
  } else {
    // For embeddings, check embedding token limit
    const embedding_tokens_used =
      current_usage.total_tokens - current_usage.chat_requests * 1000; // Rough estimate
    if (
      embedding_tokens_used + requested_tokens >
      max_embedding_tokens_per_day
    ) {
      return {
        allowed: false,
        reason: 'Daily embedding token limit would be exceeded',
        current_usage,
        limits: {
          max_tokens_per_day,
          max_chat_requests_per_day,
          max_embedding_tokens_per_day,
        },
      };
    }

    // Also check total token limit
    if (
      current_usage.total_tokens + requested_tokens >
      max_tokens_per_day
    ) {
      return {
        allowed: false,
        reason: 'Daily token limit would be exceeded',
        current_usage,
        limits: {
          max_tokens_per_day,
          max_chat_requests_per_day,
          max_embedding_tokens_per_day,
        },
      };
    }
  }

  return {
    allowed: true,
    current_usage,
    limits: {
      max_tokens_per_day,
      max_chat_requests_per_day,
      max_embedding_tokens_per_day,
    },
  };
}
