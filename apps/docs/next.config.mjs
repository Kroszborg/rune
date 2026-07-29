/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static HTML export - the site has no server runtime, so it can be
  // served by any static host (Nginx on a VPS) with near-zero memory.
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  transpilePackages: ['@kroszborg/rune', '@kroszborg/rune-react'],
};

export default nextConfig;
