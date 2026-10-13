import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { PRIVATE_PATH_PREFIXES } from "@/lib/site-config";
import type { Database } from "@/types/database";

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Обновляет сессию Supabase (токены в cookies) и отсекает анонимов от
 * приватных путей. Это первый, «быстрый» рубеж: окончательная проверка
 * allowlist выполняется на сервере в каждой странице, данных и действии.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) {
    if (isPrivatePath(request.nextUrl.pathname)) {
      return redirectToLogin(request);
    }
    return response;
  }

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() проверяет JWT на сервере Auth (а не просто читает cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isPrivatePath(request.nextUrl.pathname)) {
    return redirectToLogin(request);
  }

  // Приватные ответы не должны оседать в общих кэшах.
  if (isPrivatePath(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
