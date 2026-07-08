/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/queue',
        permanent: true, // Tells browsers and search engines to cache the redirect
      },
    ];
  },
};

module.exports = nextConfig;
