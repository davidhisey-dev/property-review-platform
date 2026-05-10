'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SuspendedPage() {
  const router = useRouter()
  const supabase = createClient()

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
      <h1>Account Suspended</h1>
      <p style={{ fontSize: '1.1rem', color: '#555', margin: '1.5rem 0' }}>
        Your account has been suspended. You no longer have access to the platform.
      </p>
      <p style={{ color: '#555' }}>
        If you believe this was done in error, please contact us at{' '}
        <a href="mailto:placeholder@placeholder.com" style={{ color: '#2563eb' }}>
          placeholder@placeholder.com
        </a>
      </p>
      <div style={{ marginTop: '2rem' }}>
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
