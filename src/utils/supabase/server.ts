import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for Server Components/Actions.
 * Auth is handled by NextAuth/Google, not Supabase Auth, so no Supabase
 * session cookie is ever set here — the cookie plumbing below is just the
 * standard @supabase/ssr wiring and stays inert in this app.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render; safe to ignore since
            // this app never relies on Supabase to refresh a session cookie.
          }
        },
      },
    }
  );
}
