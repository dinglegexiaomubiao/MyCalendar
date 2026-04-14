import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { hasAccess } from "./access";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user || !user.password) {
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isValid) {
            return null;
          }

          if (!hasAccess(user.name)) {
            throw new Error("UNAUTHORIZED_NAME");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            coupleId: user.coupleId ?? undefined,
          };
        } catch (e) {
          if (e instanceof Error && e.message === "UNAUTHORIZED_NAME") {
            throw e;
          }
          console.error("Auth authorize error:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name ?? undefined;
        token.coupleId = user.coupleId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.coupleId = token.coupleId as string | undefined;
      }
      return session;
    },
  },
});
