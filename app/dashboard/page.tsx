'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('display_name, is_active, is_admin')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/register'); return }
      if (profile.is_admin) { router.push('/admin'); return }
      if (!profile.is_active) { router.push('/pending'); return }

      setName(profile.display_name)
    }
    check()
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <h1>Welcome, {name}</h1>
        <button
          onClick={handleSignOut}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
      <p style={{ color: '#666' }}>
        Your account is active. The full dashboard is coming soon.
      </p>
    </div>
  )
}