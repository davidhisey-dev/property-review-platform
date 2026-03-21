'use client'

import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Props = {
  isAdmin?: boolean
  displayName?: string
}

export default function NavBar({ isAdmin = false, displayName = '' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    sessionStorage.removeItem('userProfile')
    sessionStorage.removeItem('dashboardUrl')
    sessionStorage.removeItem('lastSearchResults')
    sessionStorage.removeItem('lastSearchQuery')
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
      <span
        style={{
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
        {navItem('Account', '/account')}
        {isAdmin && navItem('Admin', '/admin')}
      </div>

      {/* Right — user name and sign out */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        {displayName && (
          <span style={{
            fontSize: '0.875rem',
            opacity: 0.85,
          }}>
            {displayName}
          </span>
        )}
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