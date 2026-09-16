import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "1; mode=block",
  // Permitir unsafe-eval para Next.js (HMR, eval en runtime)
  // unsafe-inline necesario para scripts inline de Next.js
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';",
};

function addSecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function proxy(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superuser, force_password_change')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profile?.force_password_change && !request.nextUrl.pathname.startsWith('/cambiar-password')) {
        return NextResponse.redirect(new URL('/cambiar-password', request.url));
      }
    }
  } catch {
    // No autorizamos acá (eso vive en server components/actions, Fase 1+);
    // solo refrescamos la sesión. Dejamos pasar la request si falla el refresh.
  }

  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Corre en todo excepto archivos estáticos e imágenes.
     * Nota (Next 16): este archivo se llama `proxy.ts` (antes `middleware.ts`).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
