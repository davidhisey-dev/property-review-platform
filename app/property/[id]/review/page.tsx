'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { useProfile } from '@/lib/useProfile'

type ChecklistItem = {
  id: number
  label: string
  code: string
}

type FormState = {
  overall_rating: number
  ease_of_interaction: number
  payment_timeliness: number
  paid_on_time: boolean | null
  no_call_no_show: boolean
  change_order_count: number
  job_size: string
  job_value: string
  job_description: string
  job_completed_at: string
  title: string
  body: string
  selected_tactics: number[]
  selected_flags: number[]
}

const INTERACTION_OPTIONS = [
  { value: 1, label: 'Extremely Difficult' },
  { value: 2, label: 'Difficult' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Easy' },
  { value: 5, label: 'Very Easy' },
]

const PAYMENT_OPTIONS = [
  { value: 1, label: 'Very Poor' },
  { value: 2, label: 'Poor' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
]

const JOB_SIZES = [
  'Under $500',
  '$500 - $2,500',
  '$2,500 - $10,000',
  '$10,000 - $50,000',
  'Over $50,000',
]

function StarInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.75rem',
            color: star <= value ? '#f59e0b' : '#d1d5db',
            padding: '0 2px',
            minHeight: '44px',
            minWidth: '44px',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h2 style={{
        margin: '0 0 0.25rem',
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#111827',
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

export default function ReviewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { profile: navProfile } = useProfile()

  const [propertyAddress, setPropertyAddress] = useState('')
  const [paymentTactics, setPaymentTactics] = useState<ChecklistItem[]>([])
  const [redFlags, setRedFlags] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormState>({
    overall_rating: 0,
    ease_of_interaction: 0,
    payment_timeliness: 0,
    paid_on_time: null,
    no_call_no_show: false,
    change_order_count: 0,
    job_size: '',
    job_value: '',
    job_description: '',
    job_completed_at: '',
    title: '',
    body: '',
    selected_tactics: [],
    selected_flags: [],
  })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('is_active, license_status')
        .eq('id', user.id)
        .single()

      if (!profile?.is_active || profile?.license_status !== 'verified') {
        router.push('/')
        return
      }

      // Check property exists
      const { data: property } = await supabase
        .from('properties')
        .select('id, address_full')
        .eq('id', id)
        .single()

      if (!property) { router.push('/dashboard'); return }
      setPropertyAddress(property.address_full)

      // Check user hasn't already reviewed this property
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('property_id', id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        router.push(`/property/${id}`)
        return
      }

      // Load checklists
      const [{ data: tactics }, { data: flags }] = await Promise.all([
        supabase
          .from('payment_tactics')
          .select('id, label, code')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('red_flags')
          .select('id, label, code')
          .eq('is_active', true)
          .order('sort_order'),
      ])

      if (tactics) setPaymentTactics(tactics)
      if (flags) setRedFlags(flags)
      setLoading(false)
    }

    load()
  }, [id, router, supabase])

  const toggleTactic = (tacticId: number) => {
    setForm((prev) => ({
      ...prev,
      selected_tactics: prev.selected_tactics.includes(tacticId)
        ? prev.selected_tactics.filter((t) => t !== tacticId)
        : [...prev.selected_tactics, tacticId],
    }))
  }

  const toggleFlag = (flagId: number) => {
    setForm((prev) => ({
      ...prev,
      selected_flags: prev.selected_flags.includes(flagId)
        ? prev.selected_flags.filter((f) => f !== flagId)
        : [...prev.selected_flags, flagId],
    }))
  }

  const handleSubmit = async () => {
    setError('')

    if (form.overall_rating === 0) {
      setError('Please provide an overall rating.')
      return
    }
    if (form.ease_of_interaction === 0) {
      setError('Please rate ease of interaction.')
      return
    }
    if (form.payment_timeliness === 0) {
      setError('Please rate payment timeliness.')
      return
    }
    if (form.paid_on_time === null) {
      setError('Please indicate whether the client paid on time.')
      return
    }
    if (!form.job_size) {
      setError('Please select a job size.')
      return
    }

    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    // Insert review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        property_id:        id,
        user_id:            user.id,
        overall_rating:     form.overall_rating,
        ease_of_interaction: form.ease_of_interaction,
        payment_timeliness: form.payment_timeliness,
        paid_on_time:       form.paid_on_time,
        no_call_no_show:    form.no_call_no_show,
        change_order_count: form.change_order_count,
        job_size:           form.job_size,
        job_value:          form.job_value ? parseFloat(form.job_value) : null,
        job_description:    form.job_description || null,
        job_completed_at:   form.job_completed_at || null,
        title:              form.title || null,
        body:               form.body || null,
        is_published:       true,
      })
      .select('id')
      .single()

    if (reviewError || !review) {
      console.error(reviewError)
      setError('Failed to submit review. Please try again.')
      setSubmitting(false)
      return
    }

    // Insert payment tactics
    if (form.selected_tactics.length > 0) {
      await supabase.from('review_payment_tactics').insert(
        form.selected_tactics.map((tactic_id) => ({
          review_id: review.id,
          tactic_id,
        }))
      )
    }

    // Insert red flags
    if (form.selected_flags.length > 0) {
      await supabase.from('review_red_flags').insert(
        form.selected_flags.map((flag_id) => ({
          review_id: review.id,
          flag_id,
        }))
      )
    }

    router.push(`/property/${id}`)
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
<NavBar isAdmin={navProfile?.is_admin || false} displayName={navProfile?.display_name || ''} />
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Loading...
        </div>
      </div>
    )
  }

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '1.5rem',
    marginBottom: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
<NavBar isAdmin={navProfile?.is_admin || false} displayName={navProfile?.display_name || ''} />

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* Header */}
        <button
          onClick={() => router.push(`/property/${id}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: 'none',
            color: '#2563eb',
            cursor: 'pointer',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            padding: 0,
          }}
        >
          ← Back to Property
        </button>

        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: '700' }}>
          Leave a Review
        </h1>
        <p style={{ margin: '0 0 1.5rem', color: '#6b7280' }}>
          {propertyAddress}
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {/* Overall Rating */}
        <div style={cardStyle}>
          <SectionHeader
            title="Overall Rating"
            subtitle="How would you rate your overall experience with this client?"
          />
          <StarInput
            value={form.overall_rating}
            onChange={(v) => setForm({ ...form, overall_rating: v })}
          />
        </div>

        {/* Interaction & Payment Ratings */}
        <div style={cardStyle}>
          <SectionHeader title="Ratings" />

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Ease of Interaction
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {INTERACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, ease_of_interaction: opt.value })}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '9999px',
                    border: '1px solid',
                    borderColor: form.ease_of_interaction === opt.value
                      ? '#2563eb'
                      : '#d1d5db',
                    backgroundColor: form.ease_of_interaction === opt.value
                      ? '#dbeafe'
                      : 'white',
                    color: form.ease_of_interaction === opt.value
                      ? '#1d4ed8'
                      : '#374151',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: form.ease_of_interaction === opt.value ? '600' : '400',
                    minHeight: '44px',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Payment Timeliness
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, payment_timeliness: opt.value })}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '9999px',
                    border: '1px solid',
                    borderColor: form.payment_timeliness === opt.value
                      ? '#2563eb'
                      : '#d1d5db',
                    backgroundColor: form.payment_timeliness === opt.value
                      ? '#dbeafe'
                      : 'white',
                    color: form.payment_timeliness === opt.value
                      ? '#1d4ed8'
                      : '#374151',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: form.payment_timeliness === opt.value ? '600' : '400',
                    minHeight: '44px',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Payment Behaviour */}
        <div style={cardStyle}>
          <SectionHeader title="Payment Behaviour" />

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Did the client pay on time? *
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setForm({ ...form, paid_on_time: opt.value })}
                  style={{
                    padding: '0.5rem 1.5rem',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: form.paid_on_time === opt.value
                      ? opt.value ? '#16a34a' : '#dc2626'
                      : '#d1d5db',
                    backgroundColor: form.paid_on_time === opt.value
                      ? opt.value ? '#f0fdf4' : '#fef2f2'
                      : 'white',
                    color: form.paid_on_time === opt.value
                      ? opt.value ? '#16a34a' : '#dc2626'
                      : '#374151',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    minHeight: '44px',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              <input
                type="checkbox"
                checked={form.no_call_no_show}
                onChange={(e) => setForm({ ...form, no_call_no_show: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              No call, no show
            </label>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Number of Change Orders
            </label>
            <input
              type="number"
              min="0"
              value={form.change_order_count}
              onChange={(e) => setForm({
                ...form,
                change_order_count: parseInt(e.target.value) || 0
              })}
              style={{
                width: '120px',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </div>
        </div>

        {/* Job Details */}
        <div style={cardStyle}>
          <SectionHeader title="Job Details" />

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Job Size *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {JOB_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setForm({ ...form, job_size: size })}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '9999px',
                    border: '1px solid',
                    borderColor: form.job_size === size ? '#2563eb' : '#d1d5db',
                    backgroundColor: form.job_size === size ? '#dbeafe' : 'white',
                    color: form.job_size === size ? '#1d4ed8' : '#374151',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: form.job_size === size ? '600' : '400',
                    minHeight: '44px',
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Job Value (optional)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#6b7280' }}>$</span>
              <input
                type="number"
                min="0"
                value={form.job_value}
                onChange={(e) => setForm({ ...form, job_value: e.target.value })}
                placeholder="0.00"
                style={{
                  width: '180px',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Job Description (optional)
            </label>
            <textarea
              value={form.job_description}
              onChange={(e) => setForm({ ...form, job_description: e.target.value })}
              placeholder="Brief description of the work performed..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Job Completion Date (optional)
            </label>
            <input
              type="date"
              value={form.job_completed_at}
              onChange={(e) => setForm({ ...form, job_completed_at: e.target.value })}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </div>
        </div>

        {/* Review Narrative */}
        <div style={cardStyle}>
          <SectionHeader
            title="Your Review"
            subtitle="Share your experience with other contractors."
          />

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Title (optional)
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Summarize your experience..."
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Review (optional)
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Describe your experience in detail..."
              rows={5}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Payment Tactics */}
        <div style={cardStyle}>
          <SectionHeader
            title="Payment Tactics"
            subtitle="Select any tactics this client used to avoid or delay payment."
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {paymentTactics.map((tactic) => (
              <label
                key={tactic.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  backgroundColor: form.selected_tactics.includes(tactic.id)
                    ? '#fef2f2'
                    : 'transparent',
                  minHeight: '44px',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.selected_tactics.includes(tactic.id)}
                  onChange={() => toggleTactic(tactic.id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{
                  fontSize: '0.875rem',
                  color: form.selected_tactics.includes(tactic.id)
                    ? '#b91c1c'
                    : '#374151',
                }}>
                  {tactic.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Red Flags */}
        <div style={cardStyle}>
          <SectionHeader
            title="Red Flags"
            subtitle="Select any red flags you observed with this client or job."
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {redFlags.map((flag) => (
              <label
                key={flag.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  backgroundColor: form.selected_flags.includes(flag.id)
                    ? '#fff7ed'
                    : 'transparent',
                  minHeight: '44px',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.selected_flags.includes(flag.id)}
                  onChange={() => toggleFlag(flag.id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{
                  fontSize: '0.875rem',
                  color: form.selected_flags.includes(flag.id)
                    ? '#c2410c'
                    : '#374151',
                }}>
                  {flag.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: submitting ? '#93c5fd' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            minHeight: '44px',
            marginBottom: '2rem',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>

      </div>
    </div>
  )
}