import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalSupabasePublicConfig } from "@/lib/supabase/env";

const protectedPrefixes = ["/requests", "/admin"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const config = getOptionalSupabasePublicConfig();
  const isProtected = isProtectedPath(request.nextUrl.pathname);

  if (!config) {
    console.error(
      "Supabase public config is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );

    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    return response;
  }

  const { url, key } = config;
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // The root page performs its own session check. Keeping it out of middleware
  // lets Next.js stream app/loading.tsx while that check and the initial shell
  // queries are still running.
  matcher: ["/requests/:path*", "/admin/:path*"],
};
