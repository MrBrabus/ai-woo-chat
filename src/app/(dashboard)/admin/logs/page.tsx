/**
 * Admin: System Logs Page
 * Super admin only - displays error logs and system health
 */

import { createAdminClient } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/auth/check-super-admin';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLogsPage() {
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

  // Get recent audit logs (errors/warnings)
  const { data: auditLogs, error } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .or('action.ilike.%error%,action.ilike.%failed%,action.ilike.%warning%')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching audit logs:', error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
          <p className="text-gray-600 mt-1">Monitor error logs and system health</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metadata
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auditLogs?.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.action.toLowerCase().includes('error') || log.action.toLowerCase().includes('failed')
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.resource_type} {log.resource_id ? `#${log.resource_id.substring(0, 8)}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.tenant_id ? log.tenant_id.substring(0, 8) + '...' : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.metadata ? (
                      <details className="cursor-pointer">
                        <summary className="text-indigo-600 hover:text-indigo-800">View Details</summary>
                        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-w-md">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!auditLogs || auditLogs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No logs found.</p>
          </div>
        )}
      </div>

      {/* System Health Placeholder */}
      <div className="card-modern p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
        <div className="text-center py-12 text-gray-500">
          <p>System health metrics coming soon...</p>
          <p className="text-sm mt-2">This will show API response times, error rates, and system performance metrics.</p>
        </div>
      </div>
    </div>
  );
}
