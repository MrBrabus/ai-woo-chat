/**
 * Home page
 */

import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">AI Woo Chat</h1>
        <p className="mb-4">SaaS Platform for AI-powered WooCommerce chat</p>
        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Dashboard
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
