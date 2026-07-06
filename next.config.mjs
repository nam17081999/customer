/** @type {import('next').NextConfig} */

const nextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      poll: 300,
      aggregateTimeout: 100,
    }
    return config
  },
};

export default nextConfig;
