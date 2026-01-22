/**
 * Voice settings utilities
 * 
 * Handles loading and applying voice settings to chat prompts
 */

import { createAdminClient } from '@/lib/supabase/server';

export interface VoiceSettings {
  tone: 'friendly' | 'professional' | 'casual' | 'formal';
  style: 'professional' | 'conversational' | 'helpful' | 'enthusiastic';
  language: string;
  personality: string;
  response_length?: 'short' | 'medium' | 'detailed';
  product_type_awareness?: boolean;
}

export interface SalesSettings {
  enable_product_recommendations: boolean;
  max_recommendations: number;
  upsell_enabled: boolean;
  cross_sell_enabled: boolean;
  urgency_messages: boolean;
  urgency_stock_threshold?: number;
  discount_prompts: boolean;
  bundle_suggestions?: boolean;
  social_proof_enabled?: boolean;
  price_mentions?: 'always' | 'when_relevant' | 'on_request';
  call_to_action_style?: 'friendly' | 'direct' | 'subtle' | 'enthusiastic';
  free_shipping_threshold?: number | null;
  return_policy_mentions?: boolean;
  payment_options_mentions?: boolean;
}

const supabaseAdmin = createAdminClient();

/**
 * Load voice settings for a site
 */
export async function loadVoiceSettings(siteId: string): Promise<VoiceSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('site_id', siteId)
      .eq('key', 'voice')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults
      return {
        tone: 'friendly',
        style: 'professional',
        language: 'en',
        personality: '',
        response_length: 'medium',
        product_type_awareness: true,
      };
    }

    const voiceSettings = data.value as any;
    return {
      tone: voiceSettings.tone || 'friendly',
      style: voiceSettings.style || 'professional',
      language: voiceSettings.language || 'en',
      personality: voiceSettings.personality || '',
      response_length: voiceSettings.response_length || 'medium',
      product_type_awareness: voiceSettings.product_type_awareness !== false,
    };
  } catch (error) {
    console.error('Error loading voice settings:', error);
    // Return defaults on error
    return {
      tone: 'friendly',
      style: 'professional',
      language: 'en',
      personality: '',
      response_length: 'medium',
      product_type_awareness: true,
    };
  }
}

/**
 * Load sales settings for a site
 */
export async function loadSalesSettings(siteId: string): Promise<SalesSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('site_id', siteId)
      .eq('key', 'sales')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults
      return {
        enable_product_recommendations: true,
        max_recommendations: 3,
        upsell_enabled: false,
        cross_sell_enabled: true,
        urgency_messages: false,
        urgency_stock_threshold: 5,
        discount_prompts: false,
        bundle_suggestions: false,
        social_proof_enabled: true,
        price_mentions: 'when_relevant',
        call_to_action_style: 'friendly',
        free_shipping_threshold: null,
        return_policy_mentions: false,
        payment_options_mentions: false,
      };
    }

    const salesSettings = data.value as any;
    return {
      enable_product_recommendations: salesSettings.enable_product_recommendations !== false,
      max_recommendations: salesSettings.max_recommendations || 3,
      upsell_enabled: salesSettings.upsell_enabled === true,
      cross_sell_enabled: salesSettings.cross_sell_enabled !== false,
      urgency_messages: salesSettings.urgency_messages === true,
      urgency_stock_threshold: salesSettings.urgency_stock_threshold ?? 5,
      discount_prompts: salesSettings.discount_prompts === true,
      bundle_suggestions: salesSettings.bundle_suggestions === true,
      social_proof_enabled: salesSettings.social_proof_enabled !== false,
      price_mentions: salesSettings.price_mentions || 'when_relevant',
      call_to_action_style: salesSettings.call_to_action_style || 'friendly',
      free_shipping_threshold: salesSettings.free_shipping_threshold ?? null,
      return_policy_mentions: salesSettings.return_policy_mentions === true,
      payment_options_mentions: salesSettings.payment_options_mentions === true,
    };
  } catch (error) {
    console.error('Error loading sales settings:', error);
    // Return defaults on error
    return {
      enable_product_recommendations: true,
      max_recommendations: 3,
      upsell_enabled: false,
      cross_sell_enabled: true,
      urgency_messages: false,
      urgency_stock_threshold: 5,
      discount_prompts: false,
      bundle_suggestions: false,
      social_proof_enabled: true,
      price_mentions: 'when_relevant',
      call_to_action_style: 'friendly',
      free_shipping_threshold: null,
      return_policy_mentions: false,
      payment_options_mentions: false,
    };
  }
}

/**
 * Build voice instructions from voice settings
 * Transforms voice settings into prompt instructions
 */
export function buildVoiceInstructions(voiceSettings: VoiceSettings): string {
  const instructions: string[] = [];

  // Tone instructions
  const toneInstructions: Record<string, string> = {
    friendly: 'Be warm, approachable, and welcoming. Use a friendly, conversational tone.',
    professional: 'Maintain a professional, business-like tone. Be courteous and respectful.',
    casual: 'Use a relaxed, informal tone. Be conversational and easy-going.',
    formal: 'Use a formal, respectful tone. Maintain proper etiquette and formality.',
  };
  if (toneInstructions[voiceSettings.tone]) {
    instructions.push(toneInstructions[voiceSettings.tone]);
  }

  // Style instructions
  const styleInstructions: Record<string, string> = {
    professional: 'Maintain professionalism in all interactions. Be clear and concise.',
    conversational: 'Engage in natural, flowing conversation. Be personable and relatable.',
    helpful: 'Prioritize being helpful and supportive. Focus on solving customer problems.',
    enthusiastic: 'Show enthusiasm and excitement about products. Be energetic and positive.',
  };
  if (styleInstructions[voiceSettings.style]) {
    instructions.push(styleInstructions[voiceSettings.style]);
  }

  // Response length
  const lengthInstructions: Record<string, string> = {
    short: 'Keep responses brief and to the point. Provide essential information only.',
    medium: 'Provide balanced responses with sufficient detail without being verbose.',
    detailed: 'Provide comprehensive, detailed responses with thorough explanations.',
  };
  if (voiceSettings.response_length && lengthInstructions[voiceSettings.response_length]) {
    instructions.push(lengthInstructions[voiceSettings.response_length]);
  }

  // Custom personality
  if (voiceSettings.personality && voiceSettings.personality.trim()) {
    instructions.push(`Additional personality traits: ${voiceSettings.personality.trim()}`);
  }

  // Language
  if (voiceSettings.language && voiceSettings.language !== 'en') {
    instructions.push(`Respond in ${voiceSettings.language} language.`);
  }

  return instructions.length > 0 ? instructions.join(' ') : '';
}

/**
 * Build WooCommerce product type awareness instructions
 * Helps AI understand different product types (digital, physical, licenses, courses, etc.)
 */
export function buildWooCommerceProductInstructions(): string {
  return `Product Type Awareness:
- **Physical Products**: Mention shipping information, delivery times, weight, dimensions if relevant. Check stock availability.
- **Digital Products**: Mention instant download, file formats, access methods, license terms. No shipping needed.
- **Licenses/Software**: Mention license type (single-site, multi-site, lifetime, subscription), activation process, support period, renewal terms.
- **Courses/Online Training**: Mention course duration, access period, prerequisites, certificates, learning outcomes, instructor information.
- **Subscriptions**: Mention billing cycle (monthly/yearly), renewal terms, cancellation policy, what's included.
- **Variable Products**: Explain variations (size, color, material, etc.), price differences between variations, availability per variation.
- **Grouped Products**: Explain what's included in the bundle, individual vs bundle pricing, whether items can be purchased separately.
- **External/Affiliate Products**: Mention that product is sold on external site, provide link, explain any differences in pricing or availability.

Always identify the product type from context and tailor your response accordingly.`;
}

/**
 * Build sales instructions from sales settings
 */
export function buildSalesInstructions(salesSettings: SalesSettings): string {
  const instructions: string[] = [];

  // Product recommendations
  if (salesSettings.enable_product_recommendations) {
    instructions.push(`- Recommend up to ${salesSettings.max_recommendations} relevant products when appropriate.`);
  } else {
    instructions.push('- Do not proactively recommend products unless specifically asked.');
  }

  // Upsell & Cross-sell
  if (salesSettings.upsell_enabled) {
    instructions.push('- Suggest higher-value alternatives or upgrades when relevant (upsell).');
  }

  if (salesSettings.cross_sell_enabled) {
    instructions.push('- Suggest complementary products that work well together (cross-sell).');
  }

  if (salesSettings.bundle_suggestions) {
    instructions.push('- Suggest product bundles or grouped products when available and relevant.');
  }

  // Urgency & Scarcity
  if (salesSettings.urgency_messages) {
    const threshold = salesSettings.urgency_stock_threshold || 5;
    instructions.push(`- Mention stock availability when stock is ${threshold} or below (e.g., "Only ${threshold} left in stock") to create urgency when appropriate.`);
  }

  if (salesSettings.discount_prompts) {
    instructions.push('- Mention discounts, promotions, or special offers when available and relevant.');
  }

  // Social Proof
  if (salesSettings.social_proof_enabled) {
    instructions.push('- Mention customer reviews, ratings, or popularity when available (e.g., "Rated 4.8/5 by 200+ customers").');
  }

  // Pricing
  if (salesSettings.price_mentions === 'always') {
    instructions.push('- Always include price information when mentioning products.');
  } else if (salesSettings.price_mentions === 'when_relevant') {
    instructions.push('- Mention price when it adds value to the conversation or helps the customer make a decision.');
  } else if (salesSettings.price_mentions === 'on_request') {
    instructions.push('- Only mention price when the customer specifically asks about it.');
  }

  // Free shipping
  if (salesSettings.free_shipping_threshold && salesSettings.free_shipping_threshold > 0) {
    instructions.push(`- Mention free shipping when cart value reaches ${salesSettings.free_shipping_threshold} (if applicable).`);
  }

  // Call-to-action style
  const ctaStyles: Record<string, string> = {
    friendly: 'Use friendly CTAs like "Check it out", "Take a look", "See more details".',
    direct: 'Use direct CTAs like "Buy now", "Add to cart", "Purchase here".',
    subtle: 'Use subtle CTAs like "Learn more", "View details", "Explore this product".',
    enthusiastic: 'Use enthusiastic CTAs like "Don\'t miss out!", "Get yours today!", "Limited time offer!".',
  };
  if (salesSettings.call_to_action_style && ctaStyles[salesSettings.call_to_action_style]) {
    instructions.push(`- ${ctaStyles[salesSettings.call_to_action_style]}`);
  }

  // Policy & Trust
  if (salesSettings.return_policy_mentions) {
    instructions.push('- Proactively mention return/refund policy to build trust (e.g., "30-day money-back guarantee", "Free returns").');
  }

  if (salesSettings.payment_options_mentions) {
    instructions.push('- Mention available payment methods or installment options when relevant (e.g., "Pay in 3 installments", "Accepts all major credit cards").');
  }

  return instructions.length > 0 ? `Sales Guidelines:\n${instructions.join('\n')}` : '';
}

/**
 * Enhance system prompt with voice and sales settings
 */
export function enhanceSystemPromptWithSettings(
  basePrompt: string,
  voiceSettings: VoiceSettings,
  salesSettings: SalesSettings
): string {
  let enhancedPrompt = basePrompt;

  // Add voice instructions
  const voiceInstructions = buildVoiceInstructions(voiceSettings);
  if (voiceInstructions) {
    enhancedPrompt += `\n\nVoice & Style Guidelines:\n${voiceInstructions}`;
  }

  // Add WooCommerce product type awareness
  if (voiceSettings.product_type_awareness !== false) {
    enhancedPrompt += `\n\n${buildWooCommerceProductInstructions()}`;
  }

  // Add sales instructions
  const salesInstructions = buildSalesInstructions(salesSettings);
  if (salesInstructions) {
    enhancedPrompt += `\n\n${salesInstructions}`;
  }

  return enhancedPrompt;
}
