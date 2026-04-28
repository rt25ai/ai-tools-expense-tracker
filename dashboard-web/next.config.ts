import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const repoBasePath = "/ai-tools-expense-tracker";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isProduction ? repoBasePath : "",
  assetPrefix: isProduction ? repoBasePath : "",
  env: {
    NEXT_PUBLIC_BASE_PATH: isProduction ? repoBasePath : "",
  },
};

export default nextConfig;
