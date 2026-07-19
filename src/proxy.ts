import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Cron/webhook 系ルートはユーザーセッションを持たない (CRON_SECRET 等で
  // 各ルート自身が認証する) ため、この Cookie ベースの認証ガードから除外する
  const isSystemRoute = pathname.startsWith("/api/discover/refresh");

  if (
    !user &&
    pathname !== "/" &&
    !pathname.startsWith("/auth") &&
    !isSystemRoute
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/recipes", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // 認証ガードを通さない静的アセット類: 画像 / favicon / SW / manifest 系
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|json)$).*)",
  ],
};
