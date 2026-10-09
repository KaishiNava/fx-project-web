/** @type {import('next').NextConfig} */
const nextConfig = { poweredByHeader: false, experimental: { serverComponentsExternalPackages: ['bcryptjs'] } };
module.exports = nextConfig;
