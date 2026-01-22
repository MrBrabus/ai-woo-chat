/**
 * POST /api/ingestion/sync
 * Manual ingestion sync endpoint
 * 
 * Syncs all products from WordPress site to embeddings database
 * Useful for initial setup or when webhooks haven't been working
 * 
 * Requires authentication (dashboard users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WPAPIClient } from '@/lib/wordpress/client';
import { ingestProductsBatch, type IngestionContext } from '@/lib/ingestion/service';
import { createLogger, generateRequestId } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const logger = createLogger({ request_id: requestId });

  try {
    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { site_id } = body;

    if (!site_id) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'site_id is required',
          },
        },
        { status: 400 }
      );
    }

    // Verify user has access to this site
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    const { data: site, error: siteError } = await supabaseAdmin
      .from('sites')
      .select('id, tenant_id, site_url, site_secret, rest_base_url')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return NextResponse.json(
        {
          error: {
            code: 'SITE_NOT_FOUND',
            message: 'Site not found',
          },
        },
        { status: 404 }
      );
    }

    logger.info('Starting manual ingestion sync', {
      site_id,
      site_url: site.site_url,
    });

    // Discover REST API base URL if not already stored
    let restBaseUrl = site.rest_base_url;
    if (!restBaseUrl) {
      try {
        logger.info('Discovering REST API base URL', {
          site_id,
          site_url: site.site_url,
        });
        restBaseUrl = await WPAPIClient.discoverRestBaseUrl(site.site_url);
        
        // Store discovered URL in database
        const { error: updateError } = await supabaseAdmin
          .from('sites')
          .update({ rest_base_url: restBaseUrl })
          .eq('id', site_id);
        
        if (updateError) {
          logger.warn('Failed to store REST API base URL', {
            site_id,
            error: updateError.message,
          });
        } else {
          logger.info('REST API base URL stored', {
            site_id,
            rest_base_url: restBaseUrl,
          });
        }
      } catch (error) {
        logger.error('Failed to discover REST API base URL', {
          site_id,
          site_url: site.site_url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: {
              code: 'REST_API_DISCOVERY_FAILED',
              message: error instanceof Error ? error.message : 'Failed to discover WordPress REST API base URL',
            },
          },
          { status: 500 }
        );
      }
    }

    // Create WordPress API client with discovered base URL
    const wpClient = new WPAPIClient({
      siteUrl: site.site_url,
      siteId: site.id,
      secret: site.site_secret,
      restBaseUrl: restBaseUrl,
    });

    // Get all products (use very old date to get all products)
    const allProductIds: number[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await wpClient.getChangedProducts(
          '1970-01-01T00:00:00Z', // Very old date to get all products
          page,
          100 // Max per page
        );

        if (response.products && response.products.length > 0) {
          allProductIds.push(...response.products.map((p) => p.id));
          page++;

          // Check if there are more pages
          if (response.pagination) {
            hasMore = page <= response.pagination.total_pages;
          } else {
            hasMore = response.products.length === 100; // Assume more if we got full page
          }
        } else {
          hasMore = false;
        }
      } catch (error) {
        logger.error('Error fetching products', error instanceof Error ? error : new Error('Unknown error'));
        return NextResponse.json(
          {
            error: {
              code: 'WORDPRESS_API_ERROR',
              message: error instanceof Error ? error.message : 'Failed to fetch products from WordPress',
            },
          },
          { status: 500 }
        );
      }
    }

    if (allProductIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products found to sync',
        products_synced: 0,
        embeddings_created: 0,
        tokens_used: 0,
      });
    }

    logger.info('Found products to sync', {
      total_products: allProductIds.length,
    });

    // Create ingestion context
    const ingestionContext: IngestionContext = {
      siteId: site.id,
      tenantId: site.tenant_id,
      siteUrl: site.site_url,
      siteSecret: site.site_secret,
    };

    // Ingest all products in batch
    const batchResult = await ingestProductsBatch(
      ingestionContext,
      allProductIds.map((id) => id.toString())
    );

    // Count successful vs failed
    const successful = batchResult.results.filter((r) => r.result.success).length;
    const failed = batchResult.results.filter((r) => !r.result.success).length;

    logger.info('Ingestion sync completed', {
      total_products: allProductIds.length,
      successful,
      failed,
      embeddings_created: batchResult.totalEmbeddings,
      tokens_used: batchResult.totalTokens,
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${successful} products successfully`,
      products_synced: successful,
      products_failed: failed,
      total_products: allProductIds.length,
      embeddings_created: batchResult.totalEmbeddings,
      tokens_used: batchResult.totalTokens,
      failures: batchResult.results
        .filter((r) => !r.result.success)
        .map((r) => ({
          product_id: r.productId,
          error: r.result.error,
        })),
    });
  } catch (error) {
    logger.error('Ingestion sync error', error instanceof Error ? error : new Error('Unknown error'));
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to sync products',
        },
      },
      { status: 500 }
    );
  }
}
