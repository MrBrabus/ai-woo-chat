/**
 * Dashboard Header - Client Component
 */

'use client';

import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';

export default function DashboardHeader() {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/dashboard/conversations') return 'Conversations';
    if (pathname === '/dashboard/sites') return 'Sites';
    if (pathname === '/dashboard/analytics') return 'Analytics';
    if (pathname === '/dashboard/account') return 'Account';
    if (pathname?.startsWith('/dashboard/settings')) return 'Settings';
    return 'Dashboard';
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center space-x-4">
        <h2 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h2>
      </div>
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <NotificationBell />
      </div>
    </header>
  );
}
