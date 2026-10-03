import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating dev badge so it doesn't cover the UI during the demo. Errors still surface.
  devIndicators: false,
};

export default nextConfig;
