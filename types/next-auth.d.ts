import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      coupleId?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    coupleId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    name?: string;
    coupleId?: string;
  }
}
