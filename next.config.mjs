/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    remotePatterns: [
      new URL('https://kjhjaqbjhblflaruiwwm.supabase.co/**'),
    ],
  },
};

export default nextConfig;
