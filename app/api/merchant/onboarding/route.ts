import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isValidAddress } from '@/lib/payments/intent'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Merchant authentication required.' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const { businessName, website, description, receivingAddress, privacyPreset, autoExpireHours } = body

    if (!businessName || typeof businessName !== 'string' || businessName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Business name is required and must be at least 2 characters.' },
        { status: 400 },
      )
    }

    if (businessName.trim().length > 100) {
      return NextResponse.json(
        { error: 'Business name cannot exceed 100 characters.' },
        { status: 400 },
      )
    }

    // Validate website if provided
    let cleanWebsite: string | null = null
    if (website && typeof website === 'string' && website.trim()) {
      const trimmed = website.trim()
      if (trimmed.length > 200) {
        return NextResponse.json({ error: 'Website URL cannot exceed 200 characters.' }, { status: 400 })
      }
      try {
        const parsed = new URL(trimmed)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json({ error: 'Website must be a valid HTTP or HTTPS URL.' }, { status: 400 })
        }
        cleanWebsite = parsed.toString()
      } catch {
        return NextResponse.json({ error: 'Invalid website URL format.' }, { status: 400 })
      }
    }

    // Validate description
    let cleanDescription: string | null = null
    if (description && typeof description === 'string' && description.trim()) {
      cleanDescription = description.trim().slice(0, 500)
    }

    // Validate receiving address
    let cleanReceivingAddress: string | null = null
    if (receivingAddress && typeof receivingAddress === 'string' && receivingAddress.trim()) {
      const trimmedAddr = receivingAddress.trim()
      if (!isValidAddress(trimmedAddr)) {
        return NextResponse.json(
          { error: 'Receiving address must be 8-128 alphanumeric characters or underscores.' },
          { status: 400 },
        )
      }
      cleanReceivingAddress = trimmedAddr
    }

    // Validate privacy preset enum
    const allowedPresets = ['strict', 'standard', 'minimal'] as const
    const cleanPreset = allowedPresets.includes(privacyPreset) ? privacyPreset : 'strict'

    // Validate auto expire hours
    const parsedHours = Number(autoExpireHours)
    const cleanHours = Number.isInteger(parsedHours) && parsedHours >= 1 && parsedHours <= 168 ? parsedHours : 24

    // Upsert merchant profile authoritatively scoped to user.id
    const { data: profile, error: dbError } = await supabase
      .from('merchant_profiles')
      .upsert(
        {
          auth_user_id: user.id,
          business_name: businessName.trim(),
          website: cleanWebsite,
          description: cleanDescription,
          receiving_address: cleanReceivingAddress,
          privacy_preset: cleanPreset,
          auto_expire_hours: cleanHours,
          onboarding_status: 'completed',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'auth_user_id' }
      )
      .select('id, auth_user_id, business_name, website, description, receiving_address, privacy_preset, auto_expire_hours, onboarding_status, created_at, updated_at')
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to save merchant profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to complete onboarding.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
