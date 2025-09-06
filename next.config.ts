import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: {
      // Turbopack specific configurations for production
    }
  },
  typescript: {
    // During builds, we'll ignore type errors to prevent blocking
    ignoreBuildErrors: false,
  },
  eslint: {
    // Don't block builds on lint errors
    ignoreDuringBuilds: false,
  },
  output: 'standalone',
  // Ensure all pages are properly generated
  generateBuildId: async () => {
    return 'drc-trainer-build-' + Date.now();
  },
};

export default nextConfig;
