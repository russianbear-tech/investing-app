/** @type {import('next').NextConfig} */
const nextConfig = {
  // yahoo-finance2 is a server-only CommonJS package; keep it out of the bundle.
  serverExternalPackages: ["yahoo-finance2"],
};

export default nextConfig;
