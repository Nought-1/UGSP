import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    role: "ADMIN" | "OFFICER";
    departmentId: string;
    serviceIds: string[];
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "ADMIN" | "OFFICER";
      departmentId: string;
      serviceIds: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "OFFICER";
    departmentId?: string;
    serviceIds?: string[];
  }
}
