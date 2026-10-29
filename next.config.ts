import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Automatically Copying Traced Files
  output: 'standalone',
  reactStrictMode: true,
  async headers() {
    if (process.env.NEXT_PUBLIC_ENV === 'development') {
      return [
        {
          source: '/_next/static/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store, max-age=0, must-revalidate',
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
