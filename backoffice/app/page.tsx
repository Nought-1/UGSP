import { redirect } from "next/navigation";

// proxy.ts sends "/" to the sign-in page or the role's home page; this is only a fallback
export default function Home() {
  redirect("/sign-in");
}
