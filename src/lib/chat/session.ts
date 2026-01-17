/**
 * Chat session management
 * 
 * Handles visitor and conversation creation/retrieval
 */

import { createAdminClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

const supabaseAdmin = createAdminClient();

export interface SessionInfo {
  visitorId: string;
  conversationId: string;
  welcomeBack: boolean;
  session?: {
    firstSeenAt: string;
    lastSeenAt: string;
    conversationCount: number;
  };
}

/**
 * Get or create visitor
 */
export async function getOrCreateVisitor(
  siteId: string,
  visitorId?: string
): Promise<{ id: string; visitorId: string; isNew: boolean; firstSeenAt: string; lastSeenAt: string }> {
  // Generate visitor_id if not provided
  const finalVisitorId = visitorId || `vis_${randomUUID()}`;

  // Try to find existing visitor
  const { data: existing } = await supabaseAdmin
    .from('visitors')
    .select('*')
    .eq('site_id', siteId)
    .eq('visitor_id', finalVisitorId)
    .single();

  if (existing) {
    // Update last_seen_at
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('visitors')
      .update({ last_seen_at: now, updated_at: now })
      .eq('id', existing.id);

    return {
      id: existing.id,
      visitorId: finalVisitorId,
      isNew: false,
      firstSeenAt: existing.first_seen_at,
      lastSeenAt: now,
    };
  }

  // Create new visitor
  const now = new Date().toISOString();
  const { data: newVisitor, error } = await supabaseAdmin
    .from('visitors')
    .insert({
      site_id: siteId,
      visitor_id: finalVisitorId,
      first_seen_at: now,
      last_seen_at: now,
      metadata: {},
    })
    .select()
    .single();

  if (error || !newVisitor) {
    throw new Error(`Failed to create visitor: ${error?.message || 'Unknown error'}`);
  }

  return {
    id: newVisitor.id,
    visitorId: finalVisitorId,
    isNew: true,
    firstSeenAt: now,
    lastSeenAt: now,
  };
}

/**
 * Get or create conversation
 */
export async function getOrCreateConversation(
  siteId: string,
  visitorDbId: string,
  conversationId?: string
): Promise<{ id: string; conversationId: string; isNew: boolean }> {
  // Generate conversation_id if not provided
  const finalConversationId = conversationId || `conv_${randomUUID()}`;

  // Try to find existing conversation
  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('site_id', siteId)
    .eq('conversation_id', finalConversationId)
    .single();

  if (existing) {
    return {
      id: existing.id,
      conversationId: finalConversationId,
      isNew: false,
    };
  }

  // Create new conversation
  const now = new Date().toISOString();
  const { data: newConversation, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      site_id: siteId,
      visitor_id: visitorDbId,
      conversation_id: finalConversationId,
      started_at: now,
      last_message_at: now,
      message_count: 0,
      metadata: {},
    })
    .select()
    .single();

  if (error || !newConversation) {
    throw new Error(`Failed to create conversation: ${error?.message || 'Unknown error'}`);
  }

  return {
    id: newConversation.id,
    conversationId: finalConversationId,
    isNew: true,
  };
}

/**
 * Get conversation count for visitor
 */
export async function getConversationCount(
  siteId: string,
  visitorDbId: string
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('visitor_id', visitorDbId);

  if (error) {
    console.error('Error getting conversation count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Bootstrap chat session
 */
export async function bootstrapSession(
  siteId: string,
  visitorId?: string,
  conversationId?: string
): Promise<SessionInfo> {
  // Get or create visitor
  const visitor = await getOrCreateVisitor(siteId, visitorId);

  // Get or create conversation
  const conversation = await getOrCreateConversation(
    siteId,
    visitor.id,
    conversationId
  );

  // Get conversation count for returning visitors
  let conversationCount = 0;
  if (!visitor.isNew) {
    conversationCount = await getConversationCount(siteId, visitor.id);
  }

  return {
    visitorId: visitor.visitorId,
    conversationId: conversation.conversationId,
    welcomeBack: !visitor.isNew,
    session: !visitor.isNew
      ? {
          firstSeenAt: visitor.firstSeenAt,
          lastSeenAt: visitor.lastSeenAt,
          conversationCount,
        }
      : undefined,
  };
}
