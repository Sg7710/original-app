import { createClient } from "@/lib/supabase/client";

/** Signs out and returns to the login screen. */
export async function signOutToLogin() {
  await createClient().auth.signOut();
  // Full reload so the server re-checks the (now cleared) session cookie.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login";
}
