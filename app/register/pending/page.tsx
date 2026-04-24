'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import DashNav, { NAV_H } from '@/components/DashNav'

type Profile = {
  display_name: string | null
  company_name: string | null
  license_number: string | null
  license_state: string | null
  license_classification: string | null
  insurance_provider: string | null
  insurance_policy: string | null
  insurance_expiry: string | null
  language_preference: string | null
  created_at: string
  business_types: { label: string } | null
}

export default function RegisterPendingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('users')
        .select(`
          display_name, company_name, license_number, license_state,
          license_classification, insurance_provider, insurance_policy,
          insurance_expiry, language_preference, created_at,
          registration_status,
          business_types ( label )
        `)
        .eq('id', user.id)
        .maybeSingle()

      if (!data) { router.push('/register'); return }
      if (data.registration_status === 'approved') { router.push('/dashboard'); return }
      if (data.registration_status === 'rejected') { router.push('/register/rejected'); return }

      setProfile(data as unknown as Profile)
      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50" style={{ paddingTop: NAV_H }}>
      <DashNav isAdmin={false} displayName={profile?.display_name ?? ''} hideNav />

      <div className="max-w-xl mx-auto py-10 px-4">

        {/* Status card */}
        <div className="card mb-6 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Application Submitted</h1>
          <p className="text-neutral-600 text-sm leading-relaxed mb-6">
            Thank you for applying to Adam's List. Your application is under review. You will
            receive an email notification once a decision has been made. This typically takes
            1–2 business days.
          </p>
          <button
            onClick={handleSignOut}
            className="btn-secondary"
          >
            Sign Out
          </button>
        </div>

        {/* Submitted details summary */}
        {profile && (
          <div className="card">
            <h2 className="text-base font-semibold text-neutral-800 mb-4">Your Submitted Details</h2>
            <dl className="grid grid-cols-1 gap-3 text-sm">
              <DetailRow label="Full Name" value={profile.display_name} />
              <DetailRow label="Company" value={profile.company_name} />
              <DetailRow
                label="Business Type"
                value={(profile.business_types as any)?.label ?? null}
              />
              <DetailRow label="License Number" value={profile.license_number} />
              <DetailRow label="License State" value={profile.license_state} />
              <DetailRow label="License Classification" value={profile.license_classification} />
              <DetailRow label="Insurance Provider" value={profile.insurance_provider} />
              <DetailRow label="Insurance Policy" value={profile.insurance_policy} />
              <DetailRow
                label="Insurance Expiry"
                value={
                  profile.insurance_expiry
                    ? new Date(profile.insurance_expiry).toLocaleDateString()
                    : null
                }
              />
              <DetailRow label="Language Preference" value={profile.language_preference} />
              <DetailRow
                label="Submitted"
                value={new Date(profile.created_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              />
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-3">
      <dt className="text-neutral-500 w-44 flex-shrink-0">{label}</dt>
      <dd className="text-neutral-800 font-medium">{value ?? '—'}</dd>
    </div>
  )
}
