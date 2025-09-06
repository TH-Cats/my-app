import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove standalone output for Vercel compatibility
  typescript: {
    // Don't block builds on type errors in production
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
  eslint: {
    // Don't block builds on lint errors in production  
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
