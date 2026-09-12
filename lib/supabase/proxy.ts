import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run Supabase code during API routes that don't need auth checks or static asset requests
  const path = request.nextUrl.pathname
  const isProtectedApp = path.startsWith('/app')
  const isOnboarding = path.startsWith('/onboarding')
  const isAuthRoute = path.startsWith('/auth/login')

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could compromise security.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect /app and /onboarding
  if (!user && (isProtectedApp || isOnboarding)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // If authenticated user visits login or signup, redirect them to /app
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    url.searchParams.delete('redirect')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
