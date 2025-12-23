import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

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
     * - exammer.png (logo)
     */
    '/((?!auth|api/auth|_next/static|_next/image|favicon.ico|exammer.png).*)',
  ],
};
