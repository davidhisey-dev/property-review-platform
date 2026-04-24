'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export const NAV_H = 56

type Props = {
  isAdmin?: boolean
  displayName?: string
  hideNav?: boolean
  // Search — only passed from dashboard
  showSearch?: boolean
  query?: string
  searching?: boolean
  onQueryChange?: (value: string) => void
  onClear?: () => void
  onSearchNow?: () => void
  onSearchFocus?: () => void
  onSearchBlur?: () => void
}

export default function AppHeader({
  isAdmin = false,
  displayName = '',
  hideNav = false,
  showSearch = false,
  query = '',
  searching = false,
  onQueryChange,
  onClear,
  onSearchNow,
  onSearchFocus,
  onSearchBlur,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
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
    <>
      {/* ── Header bar ── */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: NAV_H,
        zIndex: 9999,
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        boxSizing: 'border-box',
      }}>
        {/* Logo */}
        <span
          onClick={() => router.push('/dashboard')}
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#111827',
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Adam's List
        </span>

        {/* Search input — flex-grow, centered */}
        {showSearch && (
          <div style={{ flex: 1, position: 'relative', maxWidth: 400, margin: '0 auto' }}>
            <input
              type="text"
              value={query}
              onChange={e => onQueryChange?.(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSearchNow?.() }}
              onFocus={() => onSearchFocus?.()}
              onBlur={() => onSearchBlur?.()}
              placeholder="Search an address..."
              style={{
                width: '100%',
                paddingLeft: 12,
                paddingRight: query.length > 0 ? 76 : 44,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: '0.875rem',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
                height: 38,
                backgroundColor: '#f9fafb',
              }}
            />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}>
              {query.length > 0 && (
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => onClear?.()}
                  style={{ width: 32, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => onSearchNow?.()}
                disabled={searching}
                style={{ width: 40, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                {searching
                  ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.75"/>
                      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                    </svg>
                  )
                }
              </button>
            </div>
          </div>
        )}

        {/* Spacer when no search */}
        {!showSearch && <div style={{ flex: 1 }} />}

        {/* Right side: sign-out only (hideNav) or hamburger */}
        {hideNav ? (
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
              flexShrink: 0,
            }}
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#374151', flexShrink: 0, borderRadius: 6,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Drawer backdrop ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 19998,
          }}
        />
      )}

      {/* ── Slide-out drawer ── */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 240,
        backgroundColor: 'white',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex: 19999,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 24,
        boxSizing: 'border-box',
      }}>
        {/* Drawer header row */}
        <div style={{
          height: NAV_H,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid #f3f4f6',
          flexShrink: 0,
        }}>
          {displayName
            ? <span style={{ fontSize: '0.8125rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{displayName}</span>
            : <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Adam's List</span>
          }
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '8px 8px', flex: 1 }}>
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => { router.push(item.path); setDrawerOpen(false) }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.9375rem',
                fontWeight: pathname === item.path ? 600 : 400,
                cursor: 'pointer',
                backgroundColor: pathname === item.path ? '#eff6ff' : 'transparent',
                color: pathname === item.path ? '#1d4ed8' : '#111827',
                marginBottom: 2,
                display: 'block',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '0 8px', flexShrink: 0 }}>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.9375rem',
              color: '#6b7280',
              cursor: 'pointer',
              backgroundColor: 'transparent',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}
