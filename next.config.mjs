/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Docker 优化：生成精简运行时
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    "@resvg/resvg-js",
    "@resvg/resvg-js-darwin-arm64",
    "@prisma/client",
    ".prisma/client",
  ],
}

export default nextConfig
