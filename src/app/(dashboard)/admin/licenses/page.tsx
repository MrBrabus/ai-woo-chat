/**
 * Admin: All Licenses Page
 * Super admin only - displays all licenses across all tenants
 */

import { createAdminClient } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/auth/check-super-admin';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

interface License {
  id: string;
  license_key: string;
  customer_email: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  site_count: number;
}

export default async function AdminLicensesPage() {
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

  // Fetch all licenses with tenant info
  const { data: licenses, error } = await supabaseAdmin
    .from('licenses')
    .select(`
      id,
      license_key,
      customer_email,
      status,
      expires_at,
      created_at,
      tenant:tenants!licenses_tenant_id_fkey (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching licenses:', error);
  }

  // Get site count for each license
  const licensesWithCounts: License[] = await Promise.all(
    (licenses || []).map(async (license) => {
      const { count } = await supabaseAdmin
        .from('sites')
        .select('*', { count: 'exact', head: true })
        .eq('license_id', license.id);

      const result = {
        ...license,
        tenant: Array.isArray(license.tenant) ? license.tenant[0] : license.tenant,
        site_count: count || 0,
      } as License;
      
      // Debug: Log customer_email to check if it's being loaded
      if (!result.customer_email) {
        console.log('License missing customer_email:', {
          id: result.id,
          license_key: result.license_key,
          customer_email: result.customer_email,
        });
      }
      
      return result;
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Licenses</h1>
          <p className="text-gray-600 mt-1">Manage all licenses across all tenants</p>
        </div>
      </div>

      {/* Licenses Table */}
      <div className="card-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  License Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sites
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {licensesWithCounts.map((license) => (
                <tr key={license.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <code className="text-sm font-mono text-gray-900 break-all">
                      {license.license_key}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {license.customer_email ? (
                        <a 
                          href={`mailto:${license.customer_email}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {license.customer_email}
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">No email</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {license.tenant?.name || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">{license.tenant?.slug || ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        license.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : license.status === 'revoked'
                          ? 'bg-red-100 text-red-800'
                          : license.status === 'expired'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {license.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {license.site_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {license.expires_at
                      ? new Date(license.expires_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(license.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!licensesWithCounts.length && (
          <div className="text-center py-12">
            <p className="text-gray-500">No licenses found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
