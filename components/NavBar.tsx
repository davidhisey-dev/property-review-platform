'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('display_name, is_admin')
        .eq('id', user.id)
        .single()

      if (profile) {
        setName(profile.display_name)
        setIsAdmin(profile.is_admin)
      }
    }
    load()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const navItem = (label: string, path: string) => (
    <button
      onClick={() => router.push(path)}
      style={{
        padding: '0.4rem 0.75rem',
        backgroundColor: pathname === path
          ? 'rgba(255,255,255,0.25)'
          : 'transparent',
        color: 'white',
        border: pathname === path
          ? '1px solid rgba(255,255,255,0.4)'
          : '1px solid transparent',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: pathname === path ? '600' : '400',
        minHeight: '44px',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      backgroundColor: '#2563eb',
      padding: '0.75rem 1rem',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      {/* Left — app name */}
      <span style={{
        fontWeight: '700',
        fontSize: '1rem',
        color: 'white',
        cursor: 'pointer',
      }}
        onClick={() => router.push('/dashboard')}
      >
        PropReview
      </span>

      {/* Center — navigation links */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {navItem('Map', '/dashboard')}
        {isAdmin && navItem('Admin', '/admin')}
      </div>

      {/* Right — user name and sign out */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{
          fontSize: '0.875rem',
          opacity: 0.85,
          display: 'none',
        }}
          className="sm:block"
        >
          {name}
        </span>
        <button
          onClick={handleSignOut}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            minHeight: '44px',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}