import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('registration_status, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  console.log('[Middleware] userId:', user.id, 'profile:', profile, 'error:', profileError?.message ?? null)

  // No users row → must complete registration form
  if (!profile) {
    return NextResponse.redirect(new URL('/register', request.url))
  }

  // Admins bypass registration status routing
  if (profile.is_admin) {
    return response
  }

  if (profile.registration_status === 'pending') {
    return NextResponse.redirect(new URL('/register/pending', request.url))
  }

  if (profile.registration_status === 'rejected') {
    return NextResponse.redirect(new URL('/register/rejected', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/account/:path*',
    '/property/:path*',
    '/admin/:path*',
  ],
}
