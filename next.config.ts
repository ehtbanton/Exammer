import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/exam/:examId',
        destination: '/subject/:examId',
        permanent: true,
      },
      {
        source: '/exam/:examId/topic/:topicId',
        destination: '/subject/:examId/paper/default/topic/:topicId',
        permanent: false, // These might not be permanent depending on the app's evolution
      },
       {
        source: '/exam/:examId/topic/:topicId/subsection/:subsectionId',
        destination: '/subject/:examId/paper/default/topic/:topicId/subsection/:subsectionId',
        permanent: false,
      }
    ]
  }
};

export default nextConfig;
