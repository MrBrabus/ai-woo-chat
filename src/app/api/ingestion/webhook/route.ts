/**
 * POST /api/ingestion/webhook
 * Webhook endpoint for content ingestion
 * 
 * Handles webhook events from WordPress with:
 * - HMAC signature validation
 * - Event ID idempotency
 * - Content ingestion (products, pages, policies)
 * - Embedding generation and storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { validateHMAC } from '@/lib/hmac/validator';
import { checkLicenseKillSwitch } from '@/middleware/license-kill-switch';
import {
  ingestProduct,
  ingestPage,
  deleteEntityEmbeddings,
  type IngestionContext,
} from '@/lib/ingestion/service';
import { createLogger, generateRequestId } from '@/lib/utils/logger';

const supabaseAdmin = createAdminClient();

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const logger = createLogger({ request_id: requestId });

  try {
    // Get request body and path for HMAC validation
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    const { event_id, event, entity_type, entity_id, occurred_at } = body;

    logger.info('Ingestion webhook received', {
      event_id,
      event,
      entity_type,
      entity_id,
    });

    // Validate required fields
    if (!event_id || !event || !entity_type || !entity_id || !occurred_at) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Missing required fields: event_id, event, entity_type, entity_id, occurred_at',
          },
        },
        { status: 400 }
      );
    }

    // Validate event type
    const validEvents = [
      'product.updated',
      'product.deleted',
      'page.updated',
      'page.deleted',
      'policy.updated',
    ];
    if (!validEvents.includes(event)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_FORMAT',
            message: `Invalid event type: ${event}. Must be one of: ${validEvents.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Validate entity type
    const validEntityTypes = ['product', 'page', 'policy'];
    if (!validEntityTypes.includes(entity_type)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_FORMAT',
            message: `Invalid entity_type: ${entity_type}. Must be one of: ${validEntityTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Validate HMAC signature
    const url = new URL(req.url);
    const path = url.pathname + (url.search || '');
    const hmacValidation = await validateHMAC(
      req.method,
      path,
      req.headers,
      bodyText
    );

    if (!hmacValidation.valid) {
      return NextResponse.json(
        { error: hmacValidation.error },
        { status: 403 }
      );
    }

    const siteId = hmacValidation.site_id!;
    const siteSecret = hmacValidation.site_secret!;

    // Check license kill-switch
    const licenseCheck = await checkLicenseKillSwitch(siteId);
    if (!licenseCheck.allowed) {
      return NextResponse.json(
        { error: licenseCheck.error },
        { status: 403 }
      );
    }

    // Get site info
    const { data: site, error: siteError } = await supabaseAdmin
      .from('sites')
      .select('id, tenant_id, site_url, secret')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json(
        { error: { code: 'SITE_NOT_FOUND', message: 'Site not found' } },
        { status: 404 }
      );
    }

    // Check for duplicate event_id (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from('ingestion_events')
      .select('id, status')
      .eq('site_id', siteId)
      .eq('event_id', event_id)
      .single();

    if (existingEvent) {
      // Event already processed, return duplicate status
      return NextResponse.json({
        status: 'duplicate',
        event_id,
      });
    }

    // Insert event record with 'processing' status
    const { error: insertEventError } = await supabaseAdmin
      .from('ingestion_events')
      .insert({
        site_id: siteId,
        event_id,
        event_type: event,
        entity_type,
        entity_id,
        occurred_at,
        status: 'processing',
        metadata: { request_id: requestId },
      });

    if (insertEventError) {
      // Check if it's a unique constraint violation (race condition)
      if (insertEventError.code === '23505') {
        // Duplicate event_id detected (race condition)
        logger.info('Duplicate event detected (race condition)', { event_id });
        return NextResponse.json({
          status: 'duplicate',
          event_id,
        });
      }

      logger.error('Failed to insert ingestion event', insertEventError as any);
      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to record ingestion event',
          },
        },
        { status: 500 }
      );
    }

    // Process the ingestion event
    try {
      const ingestionContext: IngestionContext = {
        siteId: site.id,
        tenantId: site.tenant_id,
        siteUrl: site.site_url,
        siteSecret: site.secret,
      };

      let ingestionResult;

      if (event === 'product.updated') {
        ingestionResult = await ingestProduct(ingestionContext, entity_id);
      } else if (event === 'page.updated' || event === 'policy.updated') {
        ingestionResult = await ingestPage(ingestionContext, entity_id);
      } else if (event === 'product.deleted' || event === 'page.deleted') {
        // Delete embeddings for deleted entities
        await deleteEntityEmbeddings(
          ingestionContext,
          entity_type as 'product' | 'page' | 'policy',
          entity_id
        );
        ingestionResult = {
          success: true,
          embeddingsCreated: 0,
          tokensUsed: 0,
        };
      } else {
        throw new Error(`Unhandled event type: ${event}`);
      }

      // Update event status (distinguish failed vs retryable)
      const isRetryable = ingestionResult.error?.includes('timeout') || 
                         ingestionResult.error?.includes('network') ||
                         ingestionResult.error?.includes('429') ||
                         ingestionResult.error?.includes('5');

      await supabaseAdmin
        .from('ingestion_events')
        .update({
          status: ingestionResult.success ? 'completed' : (isRetryable ? 'retryable' : 'failed'),
          processed_at: new Date().toISOString(),
          error_message: ingestionResult.error || null,
          metadata: {
            request_id: requestId,
            embeddings_created: ingestionResult.embeddingsCreated,
            tokens_used: ingestionResult.tokensUsed,
            retryable: isRetryable,
          },
        })
        .eq('site_id', siteId)
        .eq('event_id', event_id);

      if (!ingestionResult.success) {
        logger.error('Ingestion failed', new Error(ingestionResult.error || 'Unknown error'), {
          retryable: isRetryable,
        });
        return NextResponse.json(
          {
            error: {
              code: 'INGESTION_FAILED',
              message: ingestionResult.error || 'Ingestion failed',
            },
          },
          { status: 500 }
        );
      }

      logger.info('Ingestion completed successfully', {
        embeddings_created: ingestionResult.embeddingsCreated,
        tokens_used: ingestionResult.tokensUsed,
      });

      return NextResponse.json({
        status: 'processed',
        event_id,
      });
    } catch (error) {
      // Determine if error is retryable
      const isRetryable = error instanceof Error && (
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('429') ||
        error.message.includes('5')
      );

      // Update event status to failed or retryable
      await supabaseAdmin
        .from('ingestion_events')
        .update({
          status: isRetryable ? 'retryable' : 'failed',
          processed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            request_id: requestId,
            retryable: isRetryable,
          },
        })
        .eq('site_id', siteId)
        .eq('event_id', event_id);

      logger.error('Ingestion processing error', error instanceof Error ? error : new Error('Unknown error'), {
        retryable: isRetryable,
      });

      return NextResponse.json(
        {
          error: {
            code: 'INGESTION_FAILED',
            message: error instanceof Error ? error.message : 'Failed to process ingestion',
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Ingestion webhook error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process webhook',
        },
      },
      { status: 500 }
    );
  }
}
