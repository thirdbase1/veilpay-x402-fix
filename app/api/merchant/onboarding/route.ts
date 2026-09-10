import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { businessName, website, description, receivingAddress, privacyPreset, autoExpireHours } = body

    if (!businessName || typeof businessName !== 'string' || businessName.trim().length === 0) {
      return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
    }

    // Upsert merchant profile
    const { data: profile, error: dbError } = await supabase
      .from('merchant_profiles')
      .upsert(
        {
          auth_user_id: user.id,
          business_name: businessName.trim(),
          website: website?.trim() || null,
          description: description?.trim() || null,
          receiving_address: receivingAddress?.trim() || null,
          privacy_preset: privacyPreset || 'strict',
          auto_expire_hours: Number(autoExpireHours) || 24,
          onboarding_status: 'completed',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'auth_user_id' }
      )
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to complete onboarding.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
