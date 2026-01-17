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
 */
const DEFAULT_SYSTEM_TEMPLATE = `You are a helpful AI assistant for an e-commerce store. Your role is to answer customer questions about products, policies, and store information.

Guidelines:
- Provide accurate, helpful information based on the context provided
- If you don't know something, say so rather than guessing
- Be friendly and professional
- When mentioning products, include relevant details like price, availability, and features
- For policy questions (shipping, returns, etc.), refer to the specific policy information provided
- Always cite your sources when referencing specific information

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
