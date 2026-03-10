/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_PUBLIC_BACKEND_URL is set per-environment in the Vercel dashboard.
  // During local dev it falls back to http://localhost:8000 (see api.ts).
};

module.exports = nextConfig;
