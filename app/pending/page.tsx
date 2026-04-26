'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PendingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  const supabase = createClient()

  // Silent check on page load - no loading state needed
  useEffect(() => {
    const silentCheck = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('is_active, is_admin')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin) { router.push('/admin'); return }
      if (profile?.is_active) { router.push('/dashboard'); return }
    }
    silentCheck()
  }, [])

  // Manual check triggered by button click
  const checkStatus = async () => {
    setChecking(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: profile } = await supabase
      .from('users')
      .select('is_active, is_admin')
      .eq('id', user.id)
      .single()

    if (profile?.is_admin) { router.push('/admin'); return }
    if (profile?.is_active) { router.push('/dashboard'); return }

    setChecking(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main style={{
      padding: '2rem',
      maxWidth: '600px',
      margin: '4rem auto',
      textAlign: 'center',
    }}>
      <h1>Thank You for Trusting Us to Serve You</h1>
      <p style={{ fontSize: '1.1rem', color: '#555', margin: '1.5rem 0' }}>
        Your application has been received and your account is currently
        under review by our team.
      </p>
      <p style={{ color: '#555' }}>
        You will be contacted at your registered email address once your
        account has been verified and is ready to use.
      </p>
      <p style={{ marginTop: '2rem', color: '#555' }}>
        If you have any questions in the meantime, please reach out to us at{' '}
        <a href="mailto:placeholder@placeholder.com" style={{ color: '#2563eb' }}>
          placeholder@placeholder.com
        </a>
      </p>
      <div style={{
        marginTop: '2rem',
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center',
      }}>
        <button
          onClick={checkStatus}
          disabled={checking}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: checking ? 'not-allowed' : 'pointer',
          }}
        >
          {checking ? 'Checking...' : 'Check Status'}
        </button>
        <button
          onClick={handleSignOut}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}