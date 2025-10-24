import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: '/auth/signin',
  },
});

export const config = {
  // Protect all routes except auth pages and public assets
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - auth (auth pages)
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - erudate.png (logo)
     */
    '/((?!auth|api/auth|_next/static|_next/image|favicon.ico|erudate.png).*)',
  ],
};
