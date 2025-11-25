import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        autoLoginToken: { label: 'Auto Login Token', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error('Please enter your email');
        }

        const user = await db.get<User>(
          'SELECT * FROM users WHERE email = ?',
          [credentials.email]
        );

        if (!user) {
          throw new Error('EMAIL_NOT_FOUND');
        }

        // Check for auto-login token (used after email verification)
        if (credentials.autoLoginToken) {
          const now = Math.floor(Date.now() / 1000);
          const tokenRecord = await db.get<{ expires: number }>(
            'SELECT expires FROM verification_tokens WHERE identifier = ? AND token = ?',
            [`autologin:${credentials.email}`, credentials.autoLoginToken]
          );

          if (!tokenRecord || tokenRecord.expires < now) {
            throw new Error('Invalid or expired auto-login token');
          }

          // Delete the used token (one-time use)
          await db.run(
            'DELETE FROM verification_tokens WHERE identifier = ? AND token = ?',
            [`autologin:${credentials.email}`, credentials.autoLoginToken]
          );

          // Check if user has access (access_level > 0)
          if (!user.access_level || user.access_level === 0) {
            throw new Error('EMAIL_NOT_VERIFIED');
          }

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name || null,
            image: user.image || null,
          };
        }

        // Regular password-based login
        if (!credentials?.password) {
          throw new Error('Please enter your password');
        }

        if (!user.password_hash) {
          throw new Error('EMAIL_NOT_FOUND');
        }

        const isValid = await compare(credentials.password, user.password_hash);

        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        // Check if user has access (access_level > 0)
        if (!user.access_level || user.access_level === 0) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name || null,
          image: user.image || null,
        };
      }
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [GitHubProvider({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        })]
      : []),
  ],
  adapter: {
    async createUser(user: any) {
      const result = await db.run(
        'INSERT INTO users (email, name, image, email_verified, access_level) VALUES (?, ?, ?, ?, ?)',
        [user.email, user.name || null, user.image || null, user.emailVerified ? 1 : 0, 0]
      );

      return {
        id: result.lastID.toString(),
        email: user.email!,
        emailVerified: user.emailVerified || null,
        name: user.name || null,
        image: user.image || null,
      };
    },
    async getUser(id: string) {
      const user = await db.get<User>('SELECT * FROM users WHERE id = ?', [id]);
      if (!user) return null;
      return {
        id: user.id.toString(),
        email: user.email,
        emailVerified: user.email_verified ? new Date(user.email_verified * 1000) : null,
        name: user.name || null,
        image: user.image || null,
      };
    },
    async getUserByEmail(email: string) {
      const user = await db.get<User>('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) return null;
      return {
        id: user.id.toString(),
        email: user.email,
        emailVerified: user.email_verified ? new Date(user.email_verified * 1000) : null,
        name: user.name || null,
        image: user.image || null,
      };
    },
    async getUserByAccount({ providerAccountId, provider }: any) {
      const account = await db.get<{ user_id: number }>(
        'SELECT user_id FROM accounts WHERE provider = ? AND provider_account_id = ?',
        [provider, providerAccountId]
      );
      if (!account) return null;
      return this.getUser!(account.user_id.toString());
    },
    async updateUser(user: any) {
      await db.run(
        'UPDATE users SET email = ?, name = ?, image = ?, email_verified = ?, updated_at = unixepoch() WHERE id = ?',
        [user.email, user.name || null, user.image || null, user.emailVerified ? 1 : 0, user.id]
      );
      const updated = await this.getUser!(user.id);
      return updated!;
    },
    async deleteUser(userId: string) {
      await db.run('DELETE FROM users WHERE id = ?', [userId]);
    },
    async linkAccount(account: any) {
      await db.run(
        `INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token || null,
          account.access_token || null,
          account.expires_at || null,
          account.token_type || null,
          account.scope || null,
          account.id_token || null,
          account.session_state || null,
        ]
      );
      return account;
    },
    async unlinkAccount({ providerAccountId, provider }: any) {
      await db.run(
        'DELETE FROM accounts WHERE provider = ? AND provider_account_id = ?',
        [provider, providerAccountId]
      );
    },
    async createSession({ sessionToken, userId, expires }: any) {
      await db.run(
        'INSERT INTO sessions (session_token, user_id, expires) VALUES (?, ?, ?)',
        [sessionToken, userId, Math.floor(expires.getTime() / 1000)]
      );
      return { sessionToken, userId, expires };
    },
    async getSessionAndUser(sessionToken: string) {
      const session = await db.get<{ user_id: number; expires: number }>(
        'SELECT * FROM sessions WHERE session_token = ?',
        [sessionToken]
      );
      if (!session) return null;
      if (session.expires < Math.floor(Date.now() / 1000)) {
        await db.run('DELETE FROM sessions WHERE session_token = ?', [sessionToken]);
        return null;
      }
      const user = await this.getUser!(session.user_id.toString());
      if (!user) return null;
      return {
        session: {
          sessionToken,
          userId: session.user_id.toString(),
          expires: new Date(session.expires * 1000),
        },
        user,
      };
    },
    async updateSession({ sessionToken }: any) {
      const session = await db.get<{ user_id: number; expires: number }>(
        'SELECT * FROM sessions WHERE session_token = ?',
        [sessionToken]
      );
      if (!session) return null;
      return {
        sessionToken,
        userId: session.user_id.toString(),
        expires: new Date(session.expires * 1000),
      };
    },
    async deleteSession(sessionToken: string) {
      await db.run('DELETE FROM sessions WHERE session_token = ?', [sessionToken]);
    },
    async createVerificationToken({ identifier, expires, token }: any) {
      await db.run(
        'INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)',
        [identifier, token, Math.floor(expires.getTime() / 1000)]
      );
      return { identifier, token, expires };
    },
    async useVerificationToken({ identifier, token }: any) {
      const verificationToken = await db.get<{ expires: number }>(
        'SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?',
        [identifier, token]
      );
      if (!verificationToken) return null;
      await db.run(
        'DELETE FROM verification_tokens WHERE identifier = ? AND token = ?',
        [identifier, token]
      );
      return {
        identifier,
        token,
        expires: new Date(verificationToken.expires * 1000),
      };
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
