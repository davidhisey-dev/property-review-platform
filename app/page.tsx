'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('is_active, is_admin')
        .eq('id', user.id)
        .single()

      if (!profile) {
        router.push('/register')
        return
      }

      if (profile.is_admin) {
        router.push('/admin')
        return
      }

      if (!profile.is_active) {
        router.push('/pending')
        return
      }

      router.push('/dashboard')
    }

    checkUser()
  }, [router])

  const handleSignIn = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  if (loading) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </main>
    )
  }

  return (
    <main style={{
      padding: '2rem',
      maxWidth: '400px',
      margin: '4rem auto',
      textAlign: 'center',
    }}>
      <h1>Property Review Platform</h1>
      <p style={{ color: '#555', marginBottom: '2rem' }}>
        A closed platform for verified contractors.
      </p>
      <button
        onClick={handleSignIn}
        style={{
          padding: '0.75rem 2rem',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Sign In with Google
      </button>
    </main>
  )
}