'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import AppHeader, { NAV_H } from '@/components/AppHeader'

type Contractor = {
  id: string
  display_name: string
  email: string
  company_name: string
  license_number: string
  license_state: string | null
  license_classification: string | null
  license_status: string
  insurance_provider: string
  insurance_expiry: string
  is_active: boolean
  is_admin: boolean
  suspended_at: string | null
  suspension_reason: string | null
  registration_status: string
  rejection_reason: string | null
  license_verified_at: string | null
  rejected_at: string | null
  created_at: string
  business_types: { label: string }[] | null
}

type Tab = 'pending' | 'active' | 'rejected'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile: navProfile } = useProfile()

  const [loading, setLoading] = useState(true)
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [tab, setTab] = useState<Tab>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Rejection modal (pending tab)
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string; email: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Admin toggle confirmation (active tab)
  const [adminConfirm, setAdminConfirm] = useState<{ id: string; name: string; granting: boolean } | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchContractors = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, display_name, email, company_name,
        license_number, license_state, license_classification, license_status,
        insurance_provider, insurance_expiry,
        is_active, is_admin, suspended_at, suspension_reason,
        registration_status, rejection_reason,
        license_verified_at, rejected_at,
        created_at,
        business_types ( label )
      `)
      .order('created_at', { ascending: false })

    console.log('[Admin fetchContractors] rows:', data?.length ?? 0, 'error:', error)
    if (data) setContractors(data as Contractor[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) { router.push('/'); return }

      await fetchContractors()
    }
    checkAdmin()
  }, [fetchContractors, router, supabase])

  // ── Tab filtering ───────────────────────────────────────────────────────────

  const pendingList = contractors
    .filter(c => c.registration_status === 'pending')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const activeList = contractors
    .filter(c => c.registration_status === 'approved')
    .sort((a, b) => (a.company_name ?? '').localeCompare(b.company_name ?? ''))

  const rejectedList = contractors
    .filter(c => c.registration_status === 'rejected')
    .sort((a, b) => new Date(b.rejected_at ?? b.created_at).getTime() - new Date(a.rejected_at ?? a.created_at).getTime())

  const tabCounts: Record<Tab, number> = {
    pending: pendingList.length,
    active: activeList.length,
    rejected: rejectedList.length,
  }

  // ── Pending: approve ───────────────────────────────────────────────────────

  const handleApprove = async (contractor: Contractor) => {
    setActionLoading(contractor.id)
    const { id, email, display_name } = contractor

    await supabase
      .from('users')
      .update({
        registration_status: 'approved',
        is_active: true,
        license_status: 'verified',
        license_verified_at: new Date().toISOString(),
      })
      .eq('id', id)

    await fetch('/api/email/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: display_name }),
    })

    await fetchContractors()
    setActionLoading(null)
  }

  // ── Pending: reject ────────────────────────────────────────────────────────

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return
    const { id, email, name } = rejectModal

    setActionLoading(id)
    setRejectModal(null)

    await supabase
      .from('users')
      .update({
        registration_status: 'rejected',
        rejection_reason: rejectReason.trim(),
        rejected_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id)

    await fetch('/api/email/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, reason: rejectReason.trim() }),
    })

    setRejectReason('')
    await fetchContractors()
    setActionLoading(null)
  }

  // ── Rejected: reinstate ────────────────────────────────────────────────────

  const handleReinstate = async (contractor: Contractor) => {
    setActionLoading(contractor.id)
    const { id, email, display_name } = contractor

    await supabase
      .from('users')
      .update({
        registration_status: 'approved',
        is_active: true,
        license_status: 'verified',
        license_verified_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', id)

    await fetch('/api/email/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: display_name }),
    })

    await fetchContractors()
    setActionLoading(null)
  }

  // ── Active: admin toggle ───────────────────────────────────────────────────

  const handleAdminToggleConfirm = async () => {
    if (!adminConfirm) return
    const { id, name, granting } = adminConfirm

    setActionLoading(id)
    setAdminConfirm(null)

    await supabase
      .from('users')
      .update({ is_admin: granting })
      .eq('id', id)

    showToast(`Admin access ${granting ? 'granted to' : 'removed from'} ${name}`)
    await fetchContractors()
    setActionLoading(null)
  }

  // ── Shared tab bar ─────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending',  label: 'Pending' },
    { key: 'active',   label: 'Active' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="min-h-screen bg-neutral-50" style={{ paddingTop: NAV_H }}>
      <AppHeader isAdmin={navProfile?.is_admin || false} displayName={navProfile?.display_name || ''} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '2px solid var(--color-neutral-200)',
        }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setExpandedId(null) }}
              style={{
                padding: '0.5rem 1.25rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: tab === t.key ? '600' : '400',
                color: tab === t.key ? 'var(--color-primary-600)' : 'var(--color-neutral-500)',
                borderBottom: tab === t.key ? '2px solid var(--color-primary-600)' : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >
              {t.label}
              <span style={{
                marginLeft: '0.5rem',
                backgroundColor: tab === t.key ? 'var(--color-primary-100)' : 'var(--color-neutral-100)',
                color: tab === t.key ? 'var(--color-primary-700)' : 'var(--color-neutral-500)',
                padding: '0.1rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
              }}>
                {tabCounts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-neutral-500)' }}>Loading...</p>
        ) : tab === 'pending' ? (
          <PendingTab
            contractors={pendingList}
            actionLoading={actionLoading}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onApprove={handleApprove}
            onReject={(c) => { setRejectModal({ id: c.id, name: c.display_name, email: c.email }); setRejectReason('') }}
          />
        ) : tab === 'active' ? (
          <ActiveTab
            contractors={activeList}
            currentUserId={currentUserId}
            actionLoading={actionLoading}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            adminConfirm={adminConfirm}
            setAdminConfirm={setAdminConfirm}
            onAdminToggleConfirm={handleAdminToggleConfirm}
          />
        ) : (
          <RejectedTab
            contractors={rejectedList}
            actionLoading={actionLoading}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onReinstate={handleReinstate}
          />
        )}
      </div>

      {/* Rejection modal */}
      {rejectModal && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setRejectModal(null)}
        >
          <div
            className="card"
            style={{ maxWidth: '480px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.5rem' }}>Reject Application</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', marginBottom: '1rem' }}>
              {rejectModal.name} — {rejectModal.email}
            </p>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Rejection Reason *
            </label>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this application is being rejected..."
              style={{
                width: '100%', padding: '0.625rem', border: '1px solid var(--color-neutral-200)',
                borderRadius: 'var(--radius-md)', fontSize: '0.875rem', resize: 'vertical',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || !!actionLoading}
                className="btn-danger"
              >
                {actionLoading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#111827', color: 'white', borderRadius: '0.75rem',
          padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: '500',
          zIndex: 9999, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Shared: expanded details grid ─────────────────────────────────────────────

function DetailsGrid({ c }: { c: Contractor }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-neutral-50)',
      borderRadius: 'var(--radius-md)',
      padding: '1rem',
      marginBottom: '1rem',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '0.5rem',
      fontSize: '0.875rem',
    }}>
      <div><span style={{ color: 'var(--color-neutral-500)' }}>Email: </span>{c.email}</div>
      <div><span style={{ color: 'var(--color-neutral-500)' }}>Business Type: </span>{(c.business_types as any)?.[0]?.label ?? '—'}</div>
      <div><span style={{ color: 'var(--color-neutral-500)' }}>License Number: </span>{c.license_number}</div>
      <div><span style={{ color: 'var(--color-neutral-500)' }}>License State: </span>{c.license_state ?? '—'}</div>
      <div><span style={{ color: 'var(--color-neutral-500)' }}>Classification: </span>{c.license_classification ?? '—'}</div>
      <div><span style={{ color: 'var(--color-neutral-500)' }}>Insurance Provider: </span>{c.insurance_provider}</div>
      <div>
        <span style={{ color: 'var(--color-neutral-500)' }}>Insurance Expiry: </span>
        {c.insurance_expiry ? new Date(c.insurance_expiry).toLocaleDateString() : '—'}
      </div>
      <div><span style={{ color: 'var(--color-neutral-500)' }}>Joined: </span>{new Date(c.created_at).toLocaleDateString()}</div>
    </div>
  )
}

// ── Shared: toggle switch ─────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled, title }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  title?: string
}) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: '2.5rem',
          height: '1.375rem',
          borderRadius: '9999px',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: checked ? 'var(--color-primary-600)' : 'var(--color-neutral-300)',
          position: 'relative',
          transition: 'background-color 0.2s',
          opacity: disabled ? 0.5 : 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: '0.125rem',
          left: checked ? 'calc(100% - 1.125rem)' : '0.125rem',
          width: '1.125rem',
          height: '1.125rem',
          borderRadius: '50%',
          backgroundColor: 'white',
          transition: 'left 0.2s',
          display: 'block',
        }} />
      </button>
    </span>
  )
}

// ── Tab: Pending ──────────────────────────────────────────────────────────────

function PendingTab({
  contractors,
  actionLoading,
  expandedId,
  setExpandedId,
  onApprove,
  onReject,
}: {
  contractors: Contractor[]
  actionLoading: string | null
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onApprove: (c: Contractor) => void
  onReject: (c: Contractor) => void
}) {
  if (contractors.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', color: 'var(--color-neutral-400)' }}>
        <p>No pending applications.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {contractors.map((c) => (
        <div key={c.id} className="card">
          {/* Summary row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>{c.display_name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral-500)' }}>{c.company_name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral-400)' }}>
                  {(c.business_types as any)?.[0]?.label ?? 'Unknown type'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.375rem', fontSize: '0.8rem', color: 'var(--color-neutral-500)' }}>
                <span>License: {c.license_number}{c.license_state ? ` (${c.license_state})` : ''}</span>
                <span>Submitted: {new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-600)', fontSize: '0.875rem', flexShrink: 0 }}
            >
              {expandedId === c.id ? 'Hide Details' : 'View Details'}
            </button>
          </div>

          {expandedId === c.id && <DetailsGrid c={c} />}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => onApprove(c)} disabled={actionLoading === c.id} className="btn-primary">
              {actionLoading === c.id ? 'Processing...' : 'Approve'}
            </button>
            <button onClick={() => onReject(c)} disabled={!!actionLoading} className="btn-danger">
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Active ───────────────────────────────────────────────────────────────

function ActiveTab({
  contractors,
  currentUserId,
  actionLoading,
  expandedId,
  setExpandedId,
  adminConfirm,
  setAdminConfirm,
  onAdminToggleConfirm,
}: {
  contractors: Contractor[]
  currentUserId: string | null
  actionLoading: string | null
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  adminConfirm: { id: string; name: string; granting: boolean } | null
  setAdminConfirm: (v: { id: string; name: string; granting: boolean } | null) => void
  onAdminToggleConfirm: () => void
}) {
  if (contractors.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', color: 'var(--color-neutral-400)' }}>
        <p>No active contractors.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {contractors.map((c) => {
        const isSelf = c.id === currentUserId
        const isConfirming = adminConfirm?.id === c.id

        return (
          <div key={c.id} className="card">
            {/* Summary row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>{c.display_name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral-500)' }}>{c.company_name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral-400)' }}>
                    {(c.business_types as any)?.[0]?.label ?? 'Unknown type'}
                  </span>
                  {c.is_admin && (
                    <span style={{
                      padding: '0.1rem 0.5rem',
                      backgroundColor: 'var(--color-primary-100)',
                      color: 'var(--color-primary-700)',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                    }}>
                      Admin
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.375rem', fontSize: '0.8rem', color: 'var(--color-neutral-500)' }}>
                  <span>License: {c.license_number}{c.license_state ? ` (${c.license_state})` : ''}</span>
                  <span>Joined: {new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-600)', fontSize: '0.875rem', flexShrink: 0 }}
              >
                {expandedId === c.id ? 'Hide Details' : 'View Details'}
              </button>
            </div>

            {expandedId === c.id && <DetailsGrid c={c} />}

            {/* Admin toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-neutral-100)' }}>
              <ToggleSwitch
                checked={c.is_admin}
                disabled={isSelf || !!actionLoading}
                title={isSelf ? 'You cannot change your own admin status' : undefined}
                onChange={(granting) => setAdminConfirm({ id: c.id, name: c.display_name, granting })}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Admin</span>
              {isSelf && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)' }}>
                  You cannot change your own admin status
                </span>
              )}
              {isConfirming && adminConfirm && (
                <span style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--color-neutral-700)' }}>
                    {adminConfirm.granting ? 'Grant' : 'Remove'} admin access
                    {adminConfirm.granting ? ' to' : ' from'} {c.display_name}?
                  </span>
                  <button
                    onClick={onAdminToggleConfirm}
                    disabled={!!actionLoading}
                    style={{
                      padding: '0.2rem 0.6rem',
                      backgroundColor: 'var(--color-primary-600)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setAdminConfirm(null)}
                    style={{
                      padding: '0.2rem 0.6rem',
                      backgroundColor: 'var(--color-neutral-100)',
                      color: 'var(--color-neutral-700)',
                      border: '1px solid var(--color-neutral-200)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Rejected ─────────────────────────────────────────────────────────────

function RejectedTab({
  contractors,
  actionLoading,
  expandedId,
  setExpandedId,
  onReinstate,
}: {
  contractors: Contractor[]
  actionLoading: string | null
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onReinstate: (c: Contractor) => void
}) {
  if (contractors.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', color: 'var(--color-neutral-400)' }}>
        <p>No rejected contractors.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {contractors.map((c) => (
        <div key={c.id} className="card">
          {/* Summary row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>{c.display_name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral-500)' }}>{c.company_name}</span>
              </div>
              <div style={{ marginTop: '0.375rem', fontSize: '0.8rem' }}>
                {c.rejection_reason && (
                  <span style={{ color: '#b91c1c' }}>
                    Reason: {c.rejection_reason}
                  </span>
                )}
              </div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--color-neutral-400)' }}>
                Rejected: {c.rejected_at ? new Date(c.rejected_at).toLocaleDateString() : '—'}
              </div>
            </div>
            <button
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-600)', fontSize: '0.875rem', flexShrink: 0 }}
            >
              {expandedId === c.id ? 'Hide Details' : 'View Details'}
            </button>
          </div>

          {expandedId === c.id && <DetailsGrid c={c} />}

          <button
            onClick={() => onReinstate(c)}
            disabled={actionLoading === c.id}
            className="btn-primary"
          >
            {actionLoading === c.id ? 'Processing...' : 'Reinstate'}
          </button>
        </div>
      ))}
    </div>
  )
}
