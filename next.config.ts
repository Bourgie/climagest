import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    disableStaticImages: true,
  },
  // PowerSync worker se copia a public/@powersync/ (ver postinstall).
  turbopack: {},
};

export default nextConfig;
