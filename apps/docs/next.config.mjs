/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kroszborg/rune', '@kroszborg/rune-react'],
  // Never bundle the optional native raster/PDF peers (only used via /node).
  serverExternalPackages: ['@resvg/resvg-js', 'sharp', 'pdf-lib'],
};

export default nextConfig;
