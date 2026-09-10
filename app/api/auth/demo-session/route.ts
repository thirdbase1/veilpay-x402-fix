import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
    }

    const admin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const demoEmail = 'demo.merchant@veilpay.io'
    const demoPassword = 'VeilPaySecure2026!'

    // 1. Ensure user exists and is confirmed
    const {
      data: { users },
    } = await admin.auth.admin.listUsers()

    let demoUser = users.find((u) => u.email === demoEmail)

    if (!demoUser) {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
      })
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }
      demoUser = newUser.user
    } else if (!demoUser.email_confirmed_at) {
      await admin.auth.admin.updateUserById(demoUser.id, {
        email_confirm: true,
        password: demoPassword,
      })
    }

    // 2. Ensure merchant profile exists with completed status
    await admin.from('merchant_profiles').upsert(
      {
        auth_user_id: demoUser.id,
        business_name: 'VeilPay Protocol Labs',
        website: 'https://veilpay.io',
        description: 'Zero-knowledge private merchant payments infrastructure.',
        receiving_address: 'mn_merchant_alpha_9942a',
        privacy_preset: 'strict',
        auto_expire_hours: 24,
        onboarding_status: 'completed',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id' },
    )

    // 3. Authenticate session through SSR server client
    const serverSupabase = await createServerClient()
    const { data: authData, error: signInError } =
      await serverSupabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      })

    if (signInError) {
      return NextResponse.json({ error: signInError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      redirect: '/app',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Demo session initialization failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
