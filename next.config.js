/** @type {import('next').NextConfig} */

const remotePatterns = [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'https', hostname: 'i.pravatar.cc' },
];

if (process.env.SUPABASE_URL) {
  try {
    remotePatterns.push({ protocol: 'https', hostname: new URL(process.env.SUPABASE_URL).hostname });
  } catch {
    // Ignore an invalid SUPABASE_URL at build time; uploaded photos just won't render until it's fixed.
  }
}

const nextConfig = {
  images: {
    remotePatterns,
  },
};

module.exports = nextConfig;
