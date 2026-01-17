/**
 * Admin: All Tenants Page
 * Super admin only - displays all tenants
 */

import { createAdminClient } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/auth/check-super-admin';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  license_count: number;
  site_count: number;
  user_count: number;
}

export default async function AdminTenantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is super admin
  const admin = await isSuperAdmin(user.id);
  if (!admin) {
    redirect('/dashboard');
  }

  const supabaseAdmin = createAdminClient();

  // Fetch all tenants
  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tenants:', error);
  }

  // Get counts for each tenant
  const tenantsWithCounts: Tenant[] = await Promise.all(
    (tenants || []).map(async (tenant) => {
      const [licenseCount, siteCount, userCount] = await Promise.all([
        supabaseAdmin
          .from('licenses')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
        supabaseAdmin
          .from('sites')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
        supabaseAdmin
          .from('user_tenants')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
      ]);

      return {
        ...tenant,
        license_count: licenseCount.count || 0,
        site_count: siteCount.count || 0,
        user_count: userCount.count || 0,
      } as Tenant;
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Tenants</h1>
          <p className="text-gray-600 mt-1">Manage all tenants on the platform</p>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="card-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Licenses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sites
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenantsWithCounts.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm font-mono text-gray-500">{tenant.slug}</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        tenant.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : tenant.status === 'suspended'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.license_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.site_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.user_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!tenantsWithCounts.length && (
          <div className="text-center py-12">
            <p className="text-gray-500">No tenants found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
