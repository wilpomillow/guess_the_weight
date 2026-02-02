/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // keep defaults; avoid unstable flags
  },
  images: {
    // allow local images from /public
    remotePatterns: []
  }
}

export default nextConfig
