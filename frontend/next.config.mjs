/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  ...(process.env.VERCEL === "1" ? {} : { output: "standalone" }),
};

export default nextConfig;
