/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@resvg/resvg-js", "@resvg/resvg-js-darwin-arm64"],
}

export default nextConfig
