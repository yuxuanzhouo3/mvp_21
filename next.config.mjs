/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  async redirects() {
    return [
      {
        source: "/contracts/create",
        destination: "/create",
        permanent: true,
      },
      {
        source: "/contracts/new",
        destination: "/create",
        permanent: true,
      },
      {
        source: "/contracts/ai-generate",
        destination: "/create/ai-chat",
        permanent: true,
      },
      {
        source: "/contracts/upload-template",
        destination: "/create/import?method=screenshot&legacy=upload-template",
        permanent: true,
      },
    ];
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
