import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

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
        console.log("[AUTH] authorize called, email:", credentials?.email);
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log("[AUTH] missing credentials");
            return null;
          }

          console.log("[AUTH] querying user...");
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });
          console.log("[AUTH] user found:", !!user);

          if (!user || !user.password) {
            console.log("[AUTH] user not found or no password");
            return null;
          }

          console.log("[AUTH] comparing password...");
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          console.log("[AUTH] password valid:", isValid);

          if (!isValid) {
            console.log("[AUTH] password invalid");
            return null;
          }

          console.log("[AUTH] authorize success:", user.email, "name:", user.name);
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            coupleId: user.coupleId ?? undefined,
          };
        } catch (e) {
          console.error("[AUTH] authorize error:", e);
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
