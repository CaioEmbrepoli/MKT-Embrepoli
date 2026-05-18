import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    devtoolSegmentExplorer: false
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
