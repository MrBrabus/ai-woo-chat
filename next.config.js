/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // Environment variables available on the client
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // Allow build to succeed on shared hosting
  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Limit parallelization for shared hosting (prevents EAGAIN errors)
  experimental: {
    webpackBuildWorker: false, // Disable webpack build workers
  },

  // Reduce build parallelism
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Limit server-side build parallelism
      config.parallelism = 1;
    }
    return config;
  },
};

module.exports = nextConfig;
