import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth", "/sw.js", "/manifest.webmanifest", "/manifest.json", "/icons"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No usar getSession(): getUser() valida el token contra Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const invite = pathname === "/amigos" ? request.nextUrl.searchParams.get("codigo") : null;
  const remember = (res: NextResponse) => {
    if (invite && /^[A-Za-z0-9]{6,12}$/.test(invite)) {
      res.cookies.set("invite_code", invite.toUpperCase(), { maxAge: 60 * 60 * 24 * 7, httpOnly: true, sameSite: "lax", path: "/" });
    }
    return res;
  };
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return remember(NextResponse.redirect(url));
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return remember(response);
}
