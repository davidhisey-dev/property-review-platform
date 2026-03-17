'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'


type Contractor = {
  id: string
  display_name: string
  email: string
  company_name: string
  license_number: string
  license_status: string
  insurance_provider: string
  insurance_expiry: string
  is_active: boolean
  suspended_at: string | null
  suspension_reason: string | null
  created_at: string
  business_types: { label: string }[] | null
}

type Tab = 'pending' | 'active' | 'suspended' | 'rejected'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [tab, setTab] = useState<Tab>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reasonInput, setReasonInput] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchContractors = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select(`
        id, display_name, email, company_name,
        license_number, license_status,
        insurance_provider, insurance_expiry,
        is_active, suspended_at, suspension_reason,
        created_at,
        business_types ( label )
      `)
      .eq('is_admin', false)
      .order('created_at', { ascending: false })

    if (data) setContractors(data as Contractor[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

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

  const filteredContractors = contractors.filter((c) => {
    if (tab === 'pending')   return !c.is_active && !c.suspended_at && c.license_status === 'pending'
    if (tab === 'active')    return c.is_active && !c.suspended_at
    if (tab === 'suspended') return !!c.suspended_at
    if (tab === 'rejected')  return !c.is_active && c.license_status === 'rejected'
    return false
  })

  const handleApprove = async (contractor: Contractor) => {
    setActionLoading(contractor.id)
    const { id, email, display_name } = contractor

    await supabase
      .from('users')
      .update({
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

  const handleReject = async (contractor: Contractor) => {
    const reason = reasonInput[contractor.id]
    if (!reason) {
      alert('Please enter a rejection reason before rejecting.')
      return
    }

    setActionLoading(contractor.id)
    const { id, email, display_name } = contractor

    await supabase
      .from('users')
      .update({
        is_active: false,
        license_status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', id)

    await fetch('/api/email/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: display_name, reason }),
    })

    await fetchContractors()
    setActionLoading(null)
  }

  const handleSuspend = async (contractor: Contractor) => {
    const reason = reasonInput[contractor.id]
    if (!reason) {
      alert('Please enter a suspension reason before suspending.')
      return
    }

    setActionLoading(contractor.id)
    const { id, email, display_name } = contractor

    await supabase
      .from('users')
      .update({
        is_active: false,
        suspended_at: new Date().toISOString(),
        suspension_reason: reason,
      })
      .eq('id', id)

    await fetch('/api/email/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: display_name, reason }),
    })

    await fetchContractors()
    setActionLoading(null)
  }

  const handleReactivate = async (contractor: Contractor) => {
    setActionLoading(contractor.id)
    const { id, email, display_name } = contractor

    await supabase
      .from('users')
      .update({
        is_active: true,
        suspended_at: null,
        suspension_reason: null,
        suspension_lifted_at: new Date().toISOString(),
      })
      .eq('id', id)

    await fetch('/api/email/reactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: display_name }),
    })

    await fetchContractors()
    setActionLoading(null)
  }

  const getTabCount = (key: Tab) => contractors.filter((c) => {
    if (key === 'pending')   return !c.is_active && !c.suspended_at && c.license_status === 'pending'
    if (key === 'active')    return c.is_active && !c.suspended_at
    if (key === 'suspended') return !!c.suspended_at
    if (key === 'rejected')  return !c.is_active && c.license_status === 'rejected'
    return false
  }).length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending',   label: 'Pending' },
    { key: 'active',    label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'rejected',  label: 'Rejected' },
  ]

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
        <NavBar />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '2px solid var(--color-neutral-200)',
        }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '0.5rem 1.25rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: tab === t.key ? '600' : '400',
                color: tab === t.key
                  ? 'var(--color-primary-600)'
                  : 'var(--color-neutral-500)',
                borderBottom: tab === t.key
                  ? '2px solid var(--color-primary-600)'
                  : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >
              {t.label}
              <span style={{
                marginLeft: '0.5rem',
                backgroundColor: tab === t.key
                  ? 'var(--color-primary-100)'
                  : 'var(--color-neutral-100)',
                color: tab === t.key
                  ? 'var(--color-primary-700)'
                  : 'var(--color-neutral-500)',
                padding: '0.1rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
              }}>
                {getTabCount(t.key)}
              </span>
            </button>
          ))}
        </div>

        {/* Contractor List */}
        {loading ? (
          <p style={{ color: 'var(--color-neutral-500)' }}>Loading...</p>
        ) : filteredContractors.length === 0 ? (
          <div className="card" style={{
            textAlign: 'center',
            color: 'var(--color-neutral-400)',
          }}>
            <p>No contractors in this category.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredContractors.map((contractor) => (
              <div key={contractor.id} className="card">

                {/* Contractor Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.75rem',
                }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{contractor.display_name}</h3>
                    <p style={{
                      color: 'var(--color-neutral-500)',
                      fontSize: '0.875rem',
                      margin: '0.25rem 0 0',
                    }}>
                      {contractor.company_name} —{' '}
                      {contractor.business_types?.[0]?.label ?? 'Unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedId(
                      expandedId === contractor.id ? null : contractor.id
                    )}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-primary-600)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {expandedId === contractor.id
                      ? 'Hide Details'
                      : 'View Details'}
                  </button>
                </div>

                {/* Expanded Details */}
                {expandedId === contractor.id && (
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
                    <div>
                      <span style={{ color: 'var(--color-neutral-500)' }}>
                        Email:{' '}
                      </span>
                      {contractor.email}
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-neutral-500)' }}>
                        License:{' '}
                      </span>
                      {contractor.license_number}
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-neutral-500)' }}>
                        Insurance:{' '}
                      </span>
                      {contractor.insurance_provider}
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-neutral-500)' }}>
                        Expiry:{' '}
                      </span>
                      {contractor.insurance_expiry
                        ? new Date(contractor.insurance_expiry)
                            .toLocaleDateString()
                        : 'N/A'}
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-neutral-500)' }}>
                        Registered:{' '}
                      </span>
                      {new Date(contractor.created_at).toLocaleDateString()}
                    </div>
                    {contractor.suspension_reason && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: 'var(--color-neutral-500)' }}>
                          Suspension Reason:{' '}
                        </span>
                        {contractor.suspension_reason}
                      </div>
                    )}
                  </div>
                )}

                {/* Reason Input */}
                {(tab === 'pending' || tab === 'active') && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label>
                      {tab === 'pending'
                        ? 'Rejection Reason (required to reject)'
                        : 'Suspension Reason (required to suspend)'}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        tab === 'pending'
                          ? 'Enter reason for rejection...'
                          : 'Enter reason for suspension...'
                      }
                      value={reasonInput[contractor.id] ?? ''}
                      onChange={(e) =>
                        setReasonInput({
                          ...reasonInput,
                          [contractor.id]: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {tab === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(contractor)}
                        disabled={actionLoading === contractor.id}
                        className="btn-primary"
                      >
                        {actionLoading === contractor.id
                          ? 'Processing...'
                          : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(contractor)}
                        disabled={actionLoading === contractor.id}
                        className="btn-danger"
                      >
                        {actionLoading === contractor.id
                          ? 'Processing...'
                          : 'Reject'}
                      </button>
                    </>
                  )}

                  {tab === 'active' && (
                    <button
                      onClick={() => handleSuspend(contractor)}
                      disabled={actionLoading === contractor.id}
                      className="btn-danger"
                    >
                      {actionLoading === contractor.id
                        ? 'Processing...'
                        : 'Suspend'}
                    </button>
                  )}

                  {tab === 'suspended' && (
                    <button
                      onClick={() => handleReactivate(contractor)}
                      disabled={actionLoading === contractor.id}
                      className="btn-primary"
                    >
                      {actionLoading === contractor.id
                        ? 'Processing...'
                        : 'Reactivate'}
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}