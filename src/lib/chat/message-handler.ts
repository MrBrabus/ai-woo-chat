/**
 * Chat message handler
 * 
 * Handles message processing with RAG pipeline, OpenAI streaming,
 * and live product verification
 * 
 * Hardened with timeout enforcement, abort propagation, and error handling
 */

import { createAdminClient } from '@/lib/supabase/server';
import { runRAGPipeline } from '@/lib/rag';
import { WPAPIClient } from '@/lib/wordpress/client';
import OpenAI from 'openai';
import type { RetrievedChunk, ContextBlock, Evidence } from '@/lib/rag';
import { createLogger, generateRequestId, logOpenAIFailure, logWPAPIFailure } from '@/lib/utils/logger';

const supabaseAdmin = createAdminClient();

// Validate OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  timeout: 60000, // 60 second timeout for chat completions
});

export interface ChatMessageRequest {
  siteId: string;
  visitorId: string;
  conversationId: string;
  message: string;
  site: any;
  license: any;
}

export interface ChatMessageResult {
  success: boolean;
  evidence?: Evidence[];
  error?: string;
}

/**
 * Get conversation history for context
 */
async function getConversationHistory(
  siteId: string,
  conversationId: string,
  limit: number = 10
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  // Get conversation DB ID
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('site_id', siteId)
    .eq('conversation_id', conversationId)
    .single();

  if (!conversation) {
    return [];
  }

  // Get recent messages
  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('role, content_text')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!messages) {
    return [];
  }

  // Reverse to get chronological order
  return messages
    .reverse()
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content_text || '',
    }))
    .filter((msg) => msg.content.length > 0);
}

/**
 * Verify products with live data from WordPress
 * Hardened with timeout enforcement and error handling
 */
async function verifyProducts(
  evidence: Evidence[],
  siteUrl: string,
  siteId: string,
  siteSecret: string,
  requestId?: string
): Promise<Array<{
  id: number;
  title: string;
  url: string;
  price: number;
  stock_status: string;
}>> {
  const logger = createLogger({
    request_id: requestId,
    site_id: siteId,
  });

  const wpClient = new WPAPIClient({
    siteUrl,
    siteId,
    secret: siteSecret,
  });

  const verifiedProducts: Array<{
    id: number;
    title: string;
    url: string;
    price: number;
    stock_status: string;
  }> = [];

  // Get product IDs from evidence
  const productIds = evidence
    .filter((ev) => ev.sourceType === 'product')
    .map((ev) => parseInt(ev.sourceId, 10))
    .filter((id) => !isNaN(id))
    .slice(0, 5); // Limit to top 5 products

  if (productIds.length === 0) {
    return verifiedProducts;
  }

  // Fetch live product data with timeout enforcement
  try {
    for (const productId of productIds) {
      try {
        // Create timeout promise (5 seconds per product)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Product verification timeout')), 5000);
        });

        // Try to get live data first
        let price = 0;
        let stockStatus = 'unknown';
        let title = '';
        let url = '';

        try {
          const liveDataPromise = wpClient.getProductLive(productId, requestId);
          const liveData = await Promise.race([liveDataPromise, timeoutPromise]);
          price = liveData.price;
          stockStatus = liveData.stock_status;
          
          // Get product card for title and URL (with timeout)
          const productCardPromise = wpClient.getProduct(productId, requestId);
          const productCard = await Promise.race([productCardPromise, timeoutPromise]);
          title = productCard.title;
          url = productCard.url;
        } catch (liveError) {
          // Fallback to product card data if live endpoint fails
          logger.warn('Live data unavailable, using product card', {
            product_id: productId,
            error: liveError instanceof Error ? liveError.message : 'Unknown error',
          });
          try {
            const productCardPromise = wpClient.getProduct(productId, requestId);
            const productCard = await Promise.race([productCardPromise, timeoutPromise]);
            price = productCard.price_range?.min || 0;
            stockStatus = productCard.stock_status || 'unknown';
            title = productCard.title;
            url = productCard.url;
          } catch (cardError) {
            logWPAPIFailure(
              logger,
              cardError instanceof Error ? cardError : new Error('Unknown error'),
              { product_id: productId, operation: 'getProduct' }
            );
            // Skip this product
            continue;
          }
        }

        verifiedProducts.push({
          id: productId,
          title,
          url,
          price,
          stock_status: stockStatus,
        });
      } catch (error) {
        logger.warn('Error verifying product', {
          product_id: productId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other products
      }
    }
  } catch (error) {
    logger.error('Error verifying products', error instanceof Error ? error : new Error('Unknown error'));
  }

  return verifiedProducts;
}

/**
 * Process chat message with RAG and OpenAI
 * Hardened with timeout enforcement, abort propagation, and error handling
 */
export async function processChatMessage(
  request: ChatMessageRequest,
  abortSignal?: AbortSignal
): Promise<{
  stream: ReadableStream;
  evidence: Evidence[];
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  fullResponsePromise: Promise<string>;
}> {
  const { siteId, visitorId, conversationId, message, site, license } = request;
  const requestId = generateRequestId();
  const logger = createLogger({
    request_id: requestId,
    site_id: siteId,
    conversation_id: conversationId,
    visitor_id: visitorId,
  });

  // Check OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY is not set in environment variables');
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
  }

  // Check abort signal before starting
  if (abortSignal?.aborted) {
    throw new Error('Request aborted');
  }

  // DETAILED LOGGING: Before RAG pipeline (as suggested by internet)
  logger.info('Starting RAG pipeline - DIAGNOSTIC LOG', {
    tenant_id: site.tenant_id,
    site_id: siteId,
    query_text_length: message?.length || 0,
    tenant_id_type: typeof site.tenant_id,
    tenant_id_valid_uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(site.tenant_id || ''),
  });

  // Run RAG pipeline (gracefully handle errors - allow chat to work without RAG)
  let ragResult: Awaited<ReturnType<typeof runRAGPipeline>>;
  try {
    ragResult = await runRAGPipeline({
      tenantId: site.tenant_id,
      siteId,
      queryText: message,
      topK: 10,
      similarityThreshold: 0.7,
      allowedSourceTypes: ['product', 'page', 'policy'],
      maxContextTokens: 4000,
      maxChunksPerSource: 3,
      maxSources: 5,
    });
    
    // DETAILED LOGGING: RAG pipeline succeeded
    logger.info('RAG pipeline succeeded - DIAGNOSTIC LOG', {
      chunks_count: ragResult.chunks?.length || 0,
      context_blocks_count: ragResult.contextBlocks?.length || 0,
      evidence_count: ragResult.evidence?.length || 0,
    });
  } catch (ragError: any) {
    // DETAILED LOGGING: RAG pipeline failed (as suggested by internet)
    logger.error('RAG pipeline failed - DIAGNOSTIC LOG', {
      error_message: ragError.message,
      error_code: ragError.code,
      error_stack: ragError.stack,
      tenant_id: site.tenant_id,
      site_id: siteId,
      error_type: typeof ragError,
      error_keys: Object.keys(ragError || {}),
    });
    
    // If RAG pipeline fails (e.g., embeddings query blocked by RLS), continue without RAG
    // This allows chat to work even if embeddings database has issues
    logger.warn('RAG pipeline failed, continuing without RAG context', {
      error: ragError.message,
      error_code: ragError.code,
    });
    
    // Create empty RAG result so chat can still work
    ragResult = {
      chunks: [],
      contextBlocks: [],
      evidence: [],
      prompts: {
        systemPrompt: 'You are a helpful AI assistant for an e-commerce website. Answer customer questions about products, shipping, returns, and other inquiries.',
        userPrompt: message,
        fullPrompt: message,
      },
    };
  }

  // Get conversation history
  const history = await getConversationHistory(siteId, conversationId, 10);

  // Build messages for OpenAI
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: ragResult.prompts.systemPrompt,
    },
    ...history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: 'user',
      content: message,
    },
  ];

  // Create OpenAI streaming response with timeout and abort support
  let openaiStream: any;
  try {
    // Create timeout promise (60 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timeout')), 60000);
    });

    // Create OpenAI request with abort signal
    const openaiPromise = openai.chat.completions.create(
      {
        model: 'gpt-4o',
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        signal: abortSignal,
      }
    );

    openaiStream = await Promise.race([openaiPromise, timeoutPromise]);
  } catch (error) {
    if (abortSignal?.aborted) {
      logger.info('OpenAI request aborted by client');
      throw new Error('Request aborted');
    }
    logOpenAIFailure(logger, error instanceof Error ? error : new Error('Unknown error'));
    throw error;
  }

  // Track token usage and content
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let fullResponse = '';
  let responseResolve: (value: string) => void;
  let responseReject: (error: Error) => void;
  const responsePromise = new Promise<string>((resolve, reject) => {
    responseResolve = resolve;
    responseReject = reject;
  });

  // Create SSE stream
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      const verifiedProducts: Array<{
        id: number;
        title: string;
        url: string;
        price: number;
        stock_status: string;
      }> = [];

      // Heartbeat interval to keep connection alive (every 30 seconds)
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Connection closed, clear interval
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      try {
        // Verify products after initial response (async, non-blocking)
        let productsVerified = false;
        const productVerificationPromise = Promise.resolve().then(async () => {
          // Wait a bit for initial response
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          // Check abort signal
          if (abortSignal?.aborted) {
            return;
          }
          
          if (!productsVerified) {
            productsVerified = true;
            try {
              const products = await verifyProducts(
                ragResult.evidence,
                site.site_url,
                siteId,
                site.secret,
                requestId
              );
              verifiedProducts.push(...products);
              
              // Send products as they're verified (if not aborted)
              if (!abortSignal?.aborted) {
                for (const product of products) {
                  const data = JSON.stringify({
                    type: 'product',
                    id: product.id,
                    title: product.title,
                    url: product.url,
                    price: product.price,
                    stock_status: product.stock_status,
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
            } catch (error) {
              logger.warn('Product verification failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              // Don't throw - product verification failures shouldn't break chat
            }
          }
        });

        // Stream OpenAI response with abort checking
        for await (const chunk of openaiStream) {
          // Check abort signal
          if (abortSignal?.aborted) {
            logger.info('Stream aborted by client');
            // Resolve with partial response for persistence
            if (fullResponse.length > 0) {
              responseResolve(fullResponse);
            }
            controller.close();
            return;
          }

          const choice = chunk.choices[0];
          if (!choice) continue;

          // Track token usage (OpenAI sends usage in final chunk when finish_reason is set)
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens || 0;
            completionTokens = chunk.usage.completion_tokens || 0;
            totalTokens = chunk.usage.total_tokens || 0;
          }

          // Stream content chunks
          const delta = choice.delta;
          if (delta?.content) {
            fullResponse += delta.content;
            const data = JSON.stringify({
              type: 'chunk',
              content: delta.content,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        // Wait for product verification to complete
        await productVerificationPromise;

        // Clear heartbeat interval
        clearInterval(heartbeatInterval);

        // Send done signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();

        // Resolve with full response (for message persistence)
        responseResolve(fullResponse);
      } catch (error) {
        // Clear heartbeat interval on error
        clearInterval(heartbeatInterval);

        // Check if aborted
        if (abortSignal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          logger.info('Stream aborted');
          // Resolve with partial response for persistence
          if (fullResponse.length > 0) {
            responseResolve(fullResponse);
          } else {
            responseReject(new Error('Request aborted'));
          }
          controller.close();
          return;
        }

        logger.error('Streaming error', error instanceof Error ? error : new Error('Unknown error'));
        
        // Send generic error to client (detailed error logged server-side)
        const errorData = JSON.stringify({
          type: 'error',
          message: 'An error occurred while processing your message. Please try again.',
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
        
        // Resolve with partial response if we have any content (for persistence)
        if (fullResponse.length > 0) {
          responseResolve(fullResponse);
        } else {
          responseReject(error instanceof Error ? error : new Error('Streaming failed'));
        }
      }
    },
  });

  return {
    stream: readableStream,
    evidence: ragResult.evidence,
    tokenUsage: {
      promptTokens: promptTokens || 0,
      completionTokens: completionTokens || 0,
      totalTokens: totalTokens || 0,
    },
    fullResponsePromise: responsePromise,
  };
}

/**
 * Save message to database
 */
export async function saveMessage(
  siteId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  contentText: string,
  contentJson?: any,
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number },
  model?: string,
  evidence?: Evidence[]
): Promise<void> {
  // Get conversation DB ID
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('site_id', siteId)
    .eq('conversation_id', conversationId)
    .single();

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Prepare content_json with evidence if assistant message
  const finalContentJson = role === 'assistant' && evidence
    ? {
        ...contentJson,
        evidence,
      }
    : contentJson;

  // Insert message
  const { error } = await supabaseAdmin.from('messages').insert({
    conversation_id: conversation.id,
    site_id: siteId,
    role,
    content_text: contentText,
    content_json: finalContentJson || null,
    token_usage: tokenUsage
      ? {
          prompt_tokens: tokenUsage.promptTokens,
          completion_tokens: tokenUsage.completionTokens,
          total_tokens: tokenUsage.totalTokens,
        }
      : null,
    model: model || null,
  });

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }

  // Update conversation last_message_at and message_count
  await supabaseAdmin
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      message_count: (conversation.message_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id);
}
