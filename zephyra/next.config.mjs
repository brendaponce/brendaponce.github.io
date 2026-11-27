/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Photos are uploaded to our own API routes; the browser shrinks each one first,
  // so every request stays well under the 4.5 MB limit of serverless hosting.
};
export default nextConfig;
