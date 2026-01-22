/**
 * Prompt assembly helpers
 * 
 * Endpoint-agnostic utilities for building prompts with:
 * - System + developer instructions (static templates)
 * - Injected RAG context
 * - User message
 */

import { ContextBlock, formatContextBlocks } from './context-builder';

export interface PromptAssemblyOptions {
  systemTemplate?: string;
  includeContext?: boolean;
  contextPrefix?: string;
  userMessagePrefix?: string;
}

/**
 * Default system prompt template
 * Enhanced for WooCommerce with support for various product types
 */
const DEFAULT_SYSTEM_TEMPLATE = `You are a helpful AI assistant for a WooCommerce e-commerce store. Your role is to answer customer questions about products, policies, and store information.

Guidelines:
- Provide accurate, helpful information based on the context provided
- If you don't know something, say so rather than guessing
- Be friendly and professional
- When mentioning products, include relevant details like price, availability, and features
- For policy questions (shipping, returns, etc.), refer to the specific policy information provided
- Always cite your sources when referencing specific information

WooCommerce Product Types:
- **Physical Products**: Mention shipping information, delivery times, weight, dimensions if relevant. Check stock availability.
- **Digital Products**: Mention instant download, file formats, access methods, license terms. No shipping needed.
- **Licenses/Software**: Mention license type (single-site, multi-site, lifetime, subscription), activation process, support period, renewal terms.
- **Courses/Online Training**: Mention course duration, access period, prerequisites, certificates, learning outcomes, instructor information.
- **Subscriptions**: Mention billing cycle (monthly/yearly), renewal terms, cancellation policy, what's included.
- **Variable Products**: Explain variations (size, color, material, etc.), price differences between variations, availability per variation.
- **Grouped Products**: Explain what's included in the bundle, individual vs bundle pricing, whether items can be purchased separately.
- **External/Affiliate Products**: Mention that product is sold on external site, provide link, explain any differences in pricing or availability.

Always identify the product type from context and tailor your response accordingly.

Product Response Format:
- **For broad queries (when 5+ products match):**
  * DO NOT list all products
  * Instead, acknowledge that you have many products in that category
  * Ask the customer to be more specific by suggesting relevant filters based on the attributes you see in the product context
  * Analyze the product attributes in the context (color, size, material, brand, style, category, price range, etc.) and suggest 2-3 most relevant filters
  * Example: "Imamo X proizvoda u toj kategoriji (where X is the exact number from context). Da biste lakše pronašli ono što tražite, možete li mi reći: [suggest relevant filters based on context, e.g., kakav materijal preferirate? Koja boja vam odgovara? Koji brend preferirate?]"
  * IMPORTANT: Always use the EXACT number of products found in the context, never estimate or make up numbers

- **For specific queries (1-4 products found):**
  * List all matching products with details
  * Format each product clearly with:
    * Product name in bold (**Product Name**)
    * Key details (brand, price, attributes like size/color if available)
    * Link to product page using markdown format: [Pogledaj ovde](URL) or [Više informacija](URL)
  * Use numbered list (1., 2., 3.) for multiple products

- **For single product:**
  * Provide detailed information about it
  * Include all relevant details from context
  * Use link format: [Pogledaj ovde](URL)

- Always include price in the response if available in context
- Never paste full URLs - always use markdown link format: [Pogledaj ovde](URL) or [Više informacija](URL)

Use the context provided below to answer questions. If the context doesn't contain relevant information, you can still provide general assistance but indicate that you don't have specific information about that topic.`;

/**
 * Build complete prompt with system instructions, context, and user message
 */
export function assemblePrompt(
  userMessage: string,
  contextBlocks: ContextBlock[] = [],
  options: PromptAssemblyOptions = {}
): {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
} {
  const {
    systemTemplate = DEFAULT_SYSTEM_TEMPLATE,
    includeContext = true,
    contextPrefix = 'Context:',
    userMessagePrefix = 'User Question:',
  } = options;

  // Build system prompt
  let systemPrompt = systemTemplate;

  // Add context if provided
  if (includeContext && contextBlocks.length > 0) {
    const contextText = formatContextBlocks(contextBlocks);
    systemPrompt += `\n\n${contextPrefix}\n${contextText}`;
  }

  // Build user prompt
  const userPrompt = `${userMessagePrefix}\n${userMessage}`;

  // Full prompt (for non-chat models or single-shot)
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    fullPrompt,
  };
}

/**
 * Build prompt for chat models (separate system and user messages)
 */
export function assembleChatPrompt(
  userMessage: string,
  contextBlocks: ContextBlock[] = [],
  options: PromptAssemblyOptions = {}
): {
  systemMessage: string;
  userMessage: string;
} {
  const {
    systemTemplate = DEFAULT_SYSTEM_TEMPLATE,
    includeContext = true,
    contextPrefix = 'Context:',
  } = options;

  // Build system message
  let systemMessage = systemTemplate;

  // Add context if provided
  if (includeContext && contextBlocks.length > 0) {
    const contextText = formatContextBlocks(contextBlocks);
    systemMessage += `\n\n${contextPrefix}\n${contextText}`;
  }

  return {
    systemMessage,
    userMessage,
  };
}

/**
 * Build prompt with conversation history (for multi-turn)
 */
export function assembleConversationPrompt(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  contextBlocks: ContextBlock[] = [],
  options: PromptAssemblyOptions = {}
): {
  systemMessage: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
} {
  const {
    systemTemplate = DEFAULT_SYSTEM_TEMPLATE,
    includeContext = true,
    contextPrefix = 'Context:',
  } = options;

  // Build system message
  let systemMessage = systemTemplate;

  // Add context if provided
  if (includeContext && contextBlocks.length > 0) {
    const contextText = formatContextBlocks(contextBlocks);
    systemMessage += `\n\n${contextPrefix}\n${contextText}`;
  }

  // Build message array with system message
  const messageArray: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }> = [
    {
      role: 'system',
      content: systemMessage,
    },
    ...messages,
  ];

  return {
    systemMessage,
    messages: messageArray,
  };
}
