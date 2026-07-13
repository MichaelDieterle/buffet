/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure we can access the API base via env variable
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;
