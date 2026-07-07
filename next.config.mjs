/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow embedding in an iframe (e.g. on the Huck marketing site).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Intentionally permissive framing so the scorecard can be embedded.
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
    ];
  },
};

export default nextConfig;
