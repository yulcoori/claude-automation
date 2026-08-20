import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      role: "ADMIN" | "INSTRUCTOR" | "MEMBER";
      status: "ACTIVE" | "PENDING";
    };
  }
  interface User {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
  }
}
