import type { NextConfig } from "next";

/**
 * 双模式配置:
 * - 默认: standalone 产物, 用于 Docker / Node 服务器部署 (bun run build)
 * - GitHub Pages: GITHUB_EXPORT=1 时切换为纯静态导出 (bun run build:gh)
 *
 * NEXT_PUBLIC_BASE_PATH 为项目站点子路径, 如 /观声仓库 =>
 *   NEXT_PUBLIC_BASE_PATH=/my-repo
 * 若部署到用户主站 (username.github.io 仓库), 设为空字符串即可。
 */
const ghExport = process.env.GITHUB_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

const nextConfig: NextConfig = ghExport
  ? {
      // 静态导出到 out/ 目录
      output: "export",
      // 项目站点子路径 (用户主站留空时自动省略)
      ...(basePath ? { basePath, assetPrefix: basePath } : {}),
      images: { unoptimized: true },
      typescript: {
        ignoreBuildErrors: true,
      },
      reactStrictMode: false,
    }
  : {
      output: "standalone",
      typescript: {
        ignoreBuildErrors: true,
      },
      reactStrictMode: false,
    };

export default nextConfig;
