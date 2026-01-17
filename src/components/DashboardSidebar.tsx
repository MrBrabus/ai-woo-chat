/**
 * Dashboard Sidebar - Client Component
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface DashboardSidebarProps {
  user?: any; // Optional - not used, email fetched from Supabase directly
}

export default function DashboardSidebar({ user: _user }: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

  // Load user email and site ID (don't use user prop to avoid metadata in cookies)
  useEffect(() => {
    const loadUserData = async () => {
      try {
        let supabase;
        try {
          supabase = createClient();
        } catch (clientError) {
          console.error('Failed to create Supabase client:', clientError);
          return;
        }
        
        if (!supabase || !supabase.auth) {
          console.error('Supabase client or auth is not available');
          return;
        }
        
        // Get user email only - don't use full user object to avoid user_metadata in cookies
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error getting user:', userError);
          return;
        }
        
        if (!currentUser) return;
        
        // Only store email - don't store full user object to avoid metadata
        setUserEmail(currentUser.email || '');
        
        // Check if user is super admin (via API endpoint to bypass RLS)
        try {
          const response = await fetch('/api/admin/license-check');
          if (!response.ok) {
            console.error('Failed to check super admin status:', response.status);
            setIsSuperAdmin(false);
          } else {
            const data = await response.json();
            const isAdmin = data.isSuperAdmin === true;
            console.log('Super admin check result:', { isAdmin, data, userId: currentUser.id });
            setIsSuperAdmin(isAdmin);
            
            // Get user's tenant (skip for super admin)
            if (isAdmin) {
              return; // Super admin doesn't need tenant/site data
            }
          }
        } catch (error) {
          console.error('Error checking super admin status:', error);
          setIsSuperAdmin(false);
        }
        const { data: userTenants, error: tenantError } = await supabase
          .from('user_tenants')
          .select('tenant_id')
          .eq('user_id', currentUser.id)
          .limit(1)
          .single();
        
        if (tenantError || !userTenants) {
          console.error('Error loading tenant:', tenantError);
          return;
        }
        
        // Get first site for this tenant
        const { data: sites, error: sitesError } = await supabase
          .from('sites')
          .select('id')
          .eq('tenant_id', userTenants.tenant_id)
          .eq('status', 'active')
          .limit(1)
          .single();
        
        if (sitesError || !sites) {
          console.error('Error loading sites:', sitesError);
          return;
        }
        
        setSiteId(sites.id);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    
    loadUserData();
  }, []); // Empty deps - only load once on mount

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      if (supabase && supabase.auth) {
        await supabase.auth.signOut();
      }
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error during logout:', error);
      router.push('/login');
    }
  };
  
  // Helper function to add site_id to settings URLs
  const getSettingsUrl = (basePath: string) => {
    if (siteId) {
      return `${basePath}?site_id=${siteId}`;
    }
    return basePath;
  };

  // Helper function to add site_id to navigation URLs
  const getNavUrl = (basePath: string) => {
    if (basePath === '/dashboard' || basePath === '/dashboard/sites') {
      return basePath; // Dashboard and Sites don't need site_id
    }
    if (basePath === '/dashboard/analytics' && siteId) {
      return `${basePath}?site_id=${siteId}`; // Analytics needs site_id
    }
    if (siteId) {
      return `${basePath}?site_id=${siteId}`;
    }
    return basePath;
  };

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Conversations',
      href: '/dashboard/conversations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      name: 'Sites',
      href: '/dashboard/sites',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    },
    {
      name: 'Analytics',
      href: '/dashboard/analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  // Super admin only navigation items
  const adminNavItems: NavItem[] = [
    {
      name: 'All Licenses',
      href: '/admin/licenses',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: 'All Tenants',
      href: '/admin/tenants',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      name: 'Usage Analytics',
      href: '/admin/usage',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'All Conversations',
      href: '/admin/conversations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      name: 'System Logs',
      href: '/admin/logs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  const settingsItems: NavItem[] = [
    {
      name: 'General',
      href: '/dashboard/settings/general',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      name: 'Voice',
      href: '/dashboard/settings/voice',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      name: 'Sales',
      href: '/dashboard/settings/sales',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      name: 'Knowledge',
      href: '/dashboard/settings/knowledge',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      name: 'Email',
      href: '/dashboard/settings/email',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`${
        sidebarOpen ? 'w-64' : 'w-20'
      } bg-white/80 backdrop-blur-sm border-r border-gray-200/50 transition-all duration-300 flex flex-col shadow-xl`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200/50">
        <Link href="/dashboard" className="flex items-center space-x-2 flex-1">
          {sidebarOpen && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <span className="text-xl font-bold gradient-text">AI Woo Chat</span>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mx-auto">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
          )}
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const navUrl = getNavUrl(item.href);
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={navUrl}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-600'}>
                {item.icon}
              </span>
              {sidebarOpen && (
                <>
                  <span className="flex-1 font-medium">{item.name}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}

        {/* Admin Section (Super Admin Only) */}
        {isSuperAdmin && sidebarOpen && (
          <div className="pt-6 mt-6 border-t border-gray-200/50">
            <div className="px-4 mb-2">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Admin</p>
            </div>
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-500/50'
                      : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-red-600'}>
                    {item.icon}
                  </span>
                  {sidebarOpen && <span className="flex-1 font-medium">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        )}

        {/* Settings Section */}
        {sidebarOpen && (
          <div className="pt-6 mt-6 border-t border-gray-200/50">
            <div className="px-4 mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Settings</p>
            </div>
            {settingsItems.map((item) => {
              const settingsUrl = getSettingsUrl(item.href);
              const isActive = pathname === item.href || pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={settingsUrl}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-600'}>
                    {item.icon}
                  </span>
                  {sidebarOpen && <span className="flex-1 font-medium">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="border-t border-gray-200/50 p-4">
        <Link
          href="/dashboard/account"
          className={`flex items-center space-x-3 mb-3 rounded-xl p-2 transition-all duration-200 group ${
            pathname === '/dashboard/account'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
              : 'hover:bg-gray-100'
          }`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
            pathname === '/dashboard/account'
              ? 'bg-white/20'
              : 'bg-gradient-to-br from-indigo-500 to-purple-500'
          }`}>
            {userEmail?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${
                pathname === '/dashboard/account' ? 'text-white' : 'text-gray-900'
              }`}>
                {userEmail || 'User'}
              </p>
              <p className={`text-xs ${
                pathname === '/dashboard/account' ? 'text-white/80' : 'text-gray-500'
              }`}>
                Admin
              </p>
            </div>
          )}
        </Link>
        {sidebarOpen && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign out</span>
          </button>
        )}
        {!sidebarOpen && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
            title="Sign out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
