import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    disableStaticImages: true,
  },
  // PowerSync worker se copia a public/@powersync/ (ver postinstall).
  turbopack: {},
  async headers() {
    return [
      {
        source: "/:all",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
