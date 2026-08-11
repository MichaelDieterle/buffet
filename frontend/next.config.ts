import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    domains: [],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
