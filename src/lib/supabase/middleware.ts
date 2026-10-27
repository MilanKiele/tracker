import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // The scheduled push endpoint performs its own Bearer-token check.
  if (request.nextUrl.pathname === "/api/notifications/reminders") return response;
  const { url, key, configured } = getPublicSupabaseConfig();
  if (!configured) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthRoute = ["/login", "/register", "/forgot-password", "/reset-password"].includes(path);
  if (!user && !isAuthRoute) return NextResponse.redirect(new URL("/login", request.url));
  if (user && (path === "/login" || path === "/register")) return NextResponse.redirect(new URL("/", request.url));
  return response;
}
