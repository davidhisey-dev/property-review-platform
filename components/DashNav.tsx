'use client'

import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export const NAV_H = 52

type Props = {
  isAdmin?: boolean
  displayName?: string
}

export default function DashNav({ isAdmin = false, displayName = '' }: Props) {
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

  const navItems = [
    { label: 'Map', path: '/dashboard' },
    { label: 'Account', path: '/account' },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin' }] : []),
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: NAV_H,
        // High z-index to sit above Mapbox GL canvas and slide-up panel
        zIndex: 9999,
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        boxSizing: 'border-box',
      }}
    >
      {/* Logo */}
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: '700',
          color: '#111827',
          cursor: 'pointer',
          userSelect: 'none',
          flexShrink: 0,
        }}
        onClick={() => router.push('/dashboard')}
      >
        Adam's List
      </span>

      {/* Nav items */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {navItems.map(item => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              backgroundColor: pathname === item.path ? '#eff6ff' : 'transparent',
              color: pathname === item.path ? '#1d4ed8' : '#4b5563',
              minHeight: 36,
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right: display name + sign out */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {displayName && (
          <span
            style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </span>
        )}
        <button
          onClick={handleSignOut}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: '0.375rem',
            border: 'none',
            fontSize: '0.875rem',
            color: '#4b5563',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            minHeight: 36,
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
