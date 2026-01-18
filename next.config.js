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
    workerThreads: false, // Disable worker threads
  },

  // Limit cache size to prevent excessive memory/disk usage on shared hosting
  // This helps prevent resource exhaustion from accumulated cache
  cacheMaxMemorySize: 50 * 1024 * 1024, // 50 MB max cache (default is 50 MB, but explicit for clarity)

  // Reduce build parallelism
  webpack: (config, { isServer, dev }) => {
    // Disable all parallel processing for shared hosting
    config.parallelism = 1;
    
    // Disable worker pool
    if (config.optimization && config.optimization.minimizer) {
      config.optimization.minimizer.forEach((plugin) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          plugin.options.parallel = false;
        }
      });
    }
    
    return config;
  },
};

module.exports = nextConfig;
