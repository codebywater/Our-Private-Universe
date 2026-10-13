import { SiteNav } from "@/components/layout/site-nav";
import { signOut } from "@/lib/actions/auth";
import { getAccess } from "@/lib/auth/session";

/** Серверная часть шапки: узнаёт, кто вошёл, и передаёт это в клиентскую навигацию. */
export async function SiteHeader() {
  const access = await getAccess();
  return (
    <SiteNav
      signedIn={access.status === "member"}
      displayName={access.status === "member" ? access.member.displayName : undefined}
      signOutAction={signOut}
    />
  );
}
