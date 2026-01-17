/**
 * Dashboard layout wrapper - Modern design with sidebar
 * Applies to all routes under /dashboard and /admin
 * Protects dashboard routes and requires authentication
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import DashboardHeader from '@/components/DashboardHeader';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // If avatar_url exists in user_metadata, remove it to fix 431 error (cookie too large)
  // This happens automatically on first dashboard load
  // CRITICAL: This must happen BEFORE rendering to prevent JWT token with large avatar in cookies
  if (user.user_metadata?.avatar_url) {
    const { avatar_url: _, ...metadataWithoutAvatar } = user.user_metadata;
    const { error: updateError } = await supabase.auth.updateUser({
      data: metadataWithoutAvatar,
    });
    
    if (updateError) {
      console.error('Failed to clean avatar_url from user_metadata:', updateError);
    } else {
      // Force session refresh to get new JWT without avatar_url
      // This is critical - without refreshing, the old JWT with avatar will still be in cookies
      await supabase.auth.refreshSession();
    }
  }

  // Don't pass ANY user data to sidebar - sidebar will fetch email directly from Supabase
  // This completely avoids user_metadata being serialized into props/cookies

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - no user prop to avoid metadata in cookies */}
        <DashboardSidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <DashboardHeader />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
