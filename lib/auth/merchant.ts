import { createClient } from '@/lib/supabase/server'

export interface MerchantProfile {
  id: string
  auth_user_id: string
  business_name: string
  website: string | null
  description: string | null
  receiving_address: string | null
  privacy_preset: 'strict' | 'standard' | null
  auto_expire_hours: number | null
  onboarding_status: 'pending' | 'completed'
  created_at: string
  updated_at: string
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function getCurrentMerchantProfile(): Promise<MerchantProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('merchant_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as MerchantProfile
}
