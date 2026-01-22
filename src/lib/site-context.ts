/**
 * Site context management utilities
 * 
 * Handles fetching and updating site context from WordPress
 */

import { createAdminClient } from '@/lib/supabase/server';
import { WPAPIClient, type SiteContext } from '@/lib/wordpress/client';
import { createLogger, generateRequestId } from '@/lib/utils/logger';

const supabaseAdmin = createAdminClient();

/**
 * Fetch and update site context from WordPress
 */
export async function updateSiteContext(
  siteId: string,
  siteUrl: string,
  siteSecret: string
): Promise<SiteContext | null> {
  const requestId = generateRequestId();
  const logger = createLogger({
    request_id: requestId,
    site_id: siteId,
  });

  try {
    // Fetch rest_base_url from database
    const { data: siteData } = await supabaseAdmin
      .from('sites')
      .select('rest_base_url')
      .eq('id', siteId)
      .single();

    const wpClient = new WPAPIClient({
      siteUrl,
      siteId,
      secret: siteSecret,
      restBaseUrl: siteData?.rest_base_url || undefined,
    });

    const siteContext = await wpClient.getSiteContext();

    // Update site context in database
    const { error: updateError } = await supabaseAdmin
      .from('sites')
      .update({
        site_context: siteContext as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    if (updateError) {
      logger.error('Failed to update site context in database', updateError);
      throw new Error(`Failed to update site context: ${updateError.message}`);
    }

    logger.info('Site context updated successfully', {
      site_id: siteId,
      has_contact: !!siteContext.contact,
      has_policies: !!siteContext.policies,
      has_shop_info: !!siteContext.shop_info,
    });

    return siteContext;
  } catch (error) {
    logger.error('Failed to fetch site context', error instanceof Error ? error : new Error('Unknown error'));
    return null;
  }
}

/**
 * Get site context from database
 */
export async function getSiteContext(siteId: string): Promise<SiteContext | null> {
  const { data: site, error } = await supabaseAdmin
    .from('sites')
    .select('site_context')
    .eq('id', siteId)
    .single();

  if (error || !site || !site.site_context) {
    return null;
  }

  return site.site_context as SiteContext;
}

/**
 * Build system prompt with site context
 */
export function buildSystemPromptWithContext(
  basePrompt: string,
  siteContext: SiteContext | null
): string {
  if (!siteContext) {
    return basePrompt;
  }

  const contextParts: string[] = [];

  // Add site name
  if (siteContext.site_name) {
    contextParts.push(`Store Name: ${siteContext.site_name}`);
  }

  // Add contact information
  if (siteContext.contact) {
    const contactInfo: string[] = [];
    if (siteContext.contact.email) {
      contactInfo.push(`Email: ${siteContext.contact.email}`);
    }
    if (siteContext.contact.phone) {
      contactInfo.push(`Phone: ${siteContext.contact.phone}`);
    }
    if (contactInfo.length > 0) {
      contextParts.push(`Contact: ${contactInfo.join(', ')}`);
    }
  }

  // Add support emails
  if (siteContext.support_emails && siteContext.support_emails.length > 0) {
    contextParts.push(`Support Emails: ${siteContext.support_emails.join(', ')}`);
  }

  // Add working hours
  if (siteContext.working_hours) {
    contextParts.push(`Working Hours: ${siteContext.working_hours}`);
  }

  // Add shop info
  if (siteContext.shop_info) {
    const shopInfo: string[] = [];
    if (siteContext.shop_info.currency) {
      shopInfo.push(`Currency: ${siteContext.shop_info.currency}`);
    }
    if (siteContext.shop_info.currency_symbol) {
      shopInfo.push(`Currency Symbol: ${siteContext.shop_info.currency_symbol}`);
    }
    if (siteContext.shop_info.timezone) {
      shopInfo.push(`Timezone: ${siteContext.shop_info.timezone}`);
    }
    if (shopInfo.length > 0) {
      contextParts.push(`Shop Info: ${shopInfo.join(', ')}`);
    }
  }

  // Add policy URLs
  if (siteContext.policies) {
    const policyInfo: string[] = [];
    if (siteContext.policies.shipping) {
      policyInfo.push(`Shipping Policy: ${siteContext.policies.shipping}`);
    }
    if (siteContext.policies.returns) {
      policyInfo.push(`Returns Policy: ${siteContext.policies.returns}`);
    }
    if (siteContext.policies.terms) {
      policyInfo.push(`Terms of Service: ${siteContext.policies.terms}`);
    }
    if (siteContext.policies.privacy) {
      policyInfo.push(`Privacy Policy: ${siteContext.policies.privacy}`);
    }
    if (policyInfo.length > 0) {
      contextParts.push(`Policies: ${policyInfo.join(' | ')}`);
    }
  }

  if (contextParts.length === 0) {
    return basePrompt;
  }

  const contextText = contextParts.join('\n');
  return `${basePrompt}\n\nStore Information:\n${contextText}`;
}
