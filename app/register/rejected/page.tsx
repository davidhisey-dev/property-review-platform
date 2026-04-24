'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import DashNav, { NAV_H } from '@/components/DashNav'

export default function RegisterRejectedPage() {
  const router = useRouter()
  const supabase = createClient()
  const [displayName, setDisplayName] = useState('')
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('users')
        .select('registration_status, display_name, rejection_reason')
        .eq('id', user.id)
        .maybeSingle()

      if (!data) { router.push('/register'); return }
      if (data.registration_status === 'approved') { router.push('/dashboard'); return }
      if (data.registration_status === 'pending') { router.push('/register/pending'); return }

      setDisplayName(data.display_name ?? '')
      setRejectionReason(data.rejection_reason ?? null)
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
      <DashNav isAdmin={false} displayName={displayName} hideNav />

      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="card mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Application Not Approved</h1>
          <p className="text-neutral-600 text-sm leading-relaxed mb-6">
            Unfortunately your application was not approved at this time.
          </p>

          {rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-red-800">{rejectionReason}</p>
            </div>
          )}

          <p className="text-neutral-500 text-sm mb-6">
            You may reapply at any time. Your previous details will be pre-filled so you can
            update and resubmit.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/register')}
              className="btn-primary"
            >
              Reapply
            </button>
            <button
              onClick={handleSignOut}
              className="btn-secondary"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
