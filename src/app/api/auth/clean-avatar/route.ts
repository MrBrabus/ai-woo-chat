/**
 * API Route: Clean avatar_url from user_metadata
 * This fixes the 431 error (Request Header Fields Too Large) caused by base64 avatar images
 * in user_metadata being serialized into JWT tokens and cookies.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if avatar_url exists in user_metadata
    const metadata = user.user_metadata || {};
    
    if (!metadata.avatar_url) {
      // No avatar_url to clean
      return NextResponse.json({
        success: true,
        message: 'No avatar_url found in user_metadata',
      });
    }

    // Remove avatar_url from metadata
    const { avatar_url: _, ...metadataWithoutAvatar } = metadata;
    
    // Update user metadata without avatar_url
    const { error: updateError } = await supabase.auth.updateUser({
      data: metadataWithoutAvatar,
    });

    if (updateError) {
      console.error('Error cleaning avatar_url:', updateError);
      return NextResponse.json(
        { error: 'Failed to clean avatar_url', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Avatar URL cleaned from user_metadata',
    });
  } catch (error) {
    console.error('Error in clean-avatar endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
