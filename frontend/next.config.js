/** @type {import('next').NextConfig} */
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (process.env.NODE_ENV === 'production' && !apiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL must be set before the production build/start.');
}
if (apiBaseUrl) {
  const url = new URL(apiBaseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) origin without a path or credentials.');
  }
  if (process.env.VERCEL && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Vercel requires an HTTPS production backend origin.');
  }
}

const nextConfig = {
  reactStrictMode: true,
  // Support static/standalone exports if needed
};

module.exports = nextConfig;
