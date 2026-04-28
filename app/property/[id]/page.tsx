'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import AppHeader, { NAV_H } from '@/components/AppHeader'

type Property = {
  id: string
  parcel_number: string
  address_full: string
  city: string
  state: string
  zip_code: string
  property_type: string
  present_use: string
  acreage: number | null
  square_feet_lot: number | null
  appraised_land_value: number | null
  appraised_improvement_value: number | null
  appraised_total_value: number | null
  tax_year: number | null
  last_sale_price: number | null
  last_sale_date: string | null
  last_sale_seller: string | null
  last_sale_buyer: string | null
  is_unincorporated: boolean | null
  latitude: number | null
  longitude: number | null
  legal_desc: string | null
  zoning: string | null
  levy_code: string | null
  levy_jurisdiction: string | null
  taxable_land_value: number | null
  taxable_improvement_value: number | null
  tax_val_reason: string | null
  new_construction: boolean | null
  tax_account_number: string | null
  plat_name: string | null
  plat_lot: string | null
  plat_block: string | null
}

type PropertyProfile = {
  review_count: number
  avg_overall_rating: number | null
  avg_payment_timeliness: number | null
  avg_ease_of_collecting: number | null
  avg_final_payment_experience: number | null
  avg_scope_clarity: number | null
  avg_change_order_willingness: number | null
  avg_ease_of_interaction: number | null
  avg_responsiveness: number | null
  avg_professionalism: number | null
  avg_decision_consistency: number | null
  avg_timeline_expectations: number | null
  avg_plan_readiness: number | null
  avg_financial_readiness: number | null
  avg_site_accessibility: number | null
  no_call_no_show_count: number
  flag_payment_delays_count: number
  flag_legal_action_count: number
  flag_disputed_scope_count: number
  flag_aggressive_behaviour_count: number
  flag_safety_challenges_count: number
}

type Review = {
  id: string
  user_id: string
  overall_rating: number | null
  payment_timeliness: number | null
  ease_of_collecting_payment: number | null
  final_payment_experience: number | null
  scope_clarity: number | null
  change_order_willingness: number | null
  ease_of_interaction: number | null
  responsiveness: number | null
  professionalism: number | null
  decision_consistency: number | null
  timeline_expectations: number | null
  plan_design_readiness: number | null
  financial_readiness: number | null
  site_accessibility: number | null
  paid_on_time: boolean | null
  no_call_no_show: boolean | null
  completed_project: boolean | null
  change_order_count: number | null
  job_size: string | null
  job_value: number | null
  job_description: string | null
  job_completion_date: string | null
  job_completed_at: string | null
  primary_contact_name: string | null
  primary_contact_is_owner: boolean | null
  contractor_role: string | null
  would_work_again: string | null
  watch_out_for: string | null
  what_worked_well: string | null
  title: string | null
  body: string | null
  created_at: string
  updated_at: string
  users: {
    display_name: string
    company_name: string
    business_types: { label: string } | null
  } | null
  review_payment_tactics: { payment_tactics: { label: string } | null }[]
  review_red_flags: { red_flags: { label: string } | null }[]
  review_client_pattern_tags: { client_pattern_tags: { label: string } | null }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2
}

function avgRating(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v != null)
  if (valid.length === 0) return null
  return roundHalf(valid.reduce((a, b) => a + b, 0) / valid.length)
}

function formatRoleLabel(role: string | null): string | null {
  if (!role) return null
  const map: Record<string, string> = {
    general_contractor: 'General Contractor',
    subcontractor: 'Subcontractor',
    specialist_trade: 'Specialist Trade',
  }
  return map[role] ?? role
}

function formatMonthYear(date: string | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatCurrency(val: number | null) {
  if (!val) return 'N/A'
  return `$${val.toLocaleString()}`
}

function formatDate(val: string | null) {
  if (!val) return 'N/A'
  return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateShort(val: string | null) {
  if (!val) return ''
  return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Star display with half-star support ─────────────────────────────────────

function StarDisplay({ rating, size = 20, showEmpty = false }: { rating: number | null; size?: number; showEmpty?: boolean }) {
  if (rating == null && !showEmpty) return null
  return (
    <div style={{ display: 'flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map(pos => {
        const fill = rating == null ? 0 : Math.min(1, Math.max(0, rating - (pos - 1)))
        const isHalf = fill >= 0.25 && fill < 0.75
        const isFull = fill >= 0.75
        return (
          <span key={pos} style={{ position: 'relative', fontSize: size, lineHeight: 1, display: 'inline-block' }}>
            <span style={{ color: '#d1d5db' }}>★</span>
            {(isHalf || isFull) && (
              <span style={{
                position: 'absolute', left: 0, top: 0,
                overflow: 'hidden', width: isFull ? '100%' : '50%',
                color: '#f59e0b',
              }}>★</span>
            )}
          </span>
        )
      })}
    </div>
  )
}

// ─── Pill badge ───────────────────────────────────────────────────────────────

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      backgroundColor: bg, color,
      padding: '0.2rem 0.6rem',
      borderRadius: '9999px',
      fontSize: '0.72rem',
      fontWeight: '500',
      display: 'inline-block',
    }}>
      {label}
    </span>
  )
}

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PropertyDetailPage() {
  const { profile: navProfile } = useProfile()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  type UserHistoryItem = { id: string; status: string; updated_at: string }

  const fetchedRef = useRef<string | null>(null)
  const [property, setProperty] = useState<Property | null>(null)
  const [propertyProfile, setPropertyProfile] = useState<PropertyProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [userHistory, setUserHistory] = useState<UserHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [parcelOpen, setParcelOpen] = useState(false)

  useEffect(() => {
    if (fetchedRef.current === id) return
    fetchedRef.current = id
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

      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (propertyError || !propertyData) {
        router.push('/dashboard')
        return
      }

      setProperty(propertyData)

      await supabase
        .from('recently_viewed')
        .upsert(
          { user_id: user.id, property_id: id, last_viewed_at: new Date().toISOString() },
          { onConflict: 'user_id,property_id' }
        )

      const { data: ppData } = await supabase
        .from('property_profiles')
        .select(`
          review_count, avg_overall_rating,
          avg_payment_timeliness, avg_ease_of_collecting, avg_final_payment_experience,
          avg_scope_clarity, avg_change_order_willingness,
          avg_ease_of_interaction, avg_responsiveness, avg_professionalism, avg_decision_consistency,
          avg_timeline_expectations, avg_plan_readiness, avg_financial_readiness,
          avg_site_accessibility,
          no_call_no_show_count, flag_payment_delays_count, flag_legal_action_count,
          flag_disputed_scope_count, flag_aggressive_behaviour_count, flag_safety_challenges_count
        `)
        .eq('property_id', id)
        .single()

      if (ppData) setPropertyProfile(ppData as unknown as PropertyProfile)

      const { data: reviewData } = await supabase
        .from('reviews')
        .select(`
          id, user_id, property_id, status,
          overall_rating,
          payment_timeliness, ease_of_collecting_payment, final_payment_experience,
          scope_clarity, change_order_willingness,
          ease_of_interaction, responsiveness, professionalism, decision_consistency,
          timeline_expectations, plan_design_readiness, financial_readiness,
          site_accessibility,
          paid_on_time, no_call_no_show, completed_project, change_order_count,
          job_size, job_value, job_description, job_completion_date, job_completed_at,
          primary_contact_name, primary_contact_is_owner, contractor_role, would_work_again,
          watch_out_for, what_worked_well,
          title, body, created_at, updated_at,
          users!reviews_user_id_fkey ( display_name, company_name, business_types ( label ) ),
          review_payment_tactics ( payment_tactics ( label ) ),
          review_red_flags ( red_flags ( label ) ),
          review_client_pattern_tags ( client_pattern_tags ( label ) )
        `)
        .eq('property_id', id)
        .eq('status', 'submitted')
        .order('updated_at', { ascending: false })

      if (reviewData) {
        setReviews(reviewData as unknown as Review[])
      }

      const { data: historyData } = await supabase
        .from('reviews')
        .select('id, status, updated_at')
        .eq('property_id', id)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (historyData) setUserHistory(historyData)

      setLoading(false)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSearchSelect = (result: { address: string; lat: number; lng: number; propertyId: string | null }) => {
    const p = new URLSearchParams({ search: result.address, lat: String(result.lat), lng: String(result.lng) })
    router.push(`/dashboard?${p.toString()}`)
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: NAV_H }}>
        <AppHeader isAdmin={navProfile?.is_admin ?? false} displayName={navProfile?.display_name ?? ''} showSearch onSearchSelect={handleSearchSelect} />
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Loading property...
        </div>
      </div>
    )
  }

  if (!property) return null

  // ─── Derived values for At a Glance ────────────────────────────────────────

  const reviewCount = propertyProfile?.review_count ?? 0

  const wwaYes   = reviews.filter(r => r.would_work_again === 'yes').length
  const wwaNo    = reviews.filter(r => r.would_work_again === 'no').length
  const wwaTerms = reviews.filter(r => r.would_work_again === 'higher_price_stricter_terms').length

  const tagCounts: Record<string, number> = {}
  reviews.forEach(r => {
    r.review_client_pattern_tags?.forEach(t => {
      const label = t.client_pattern_tags?.label
      if (label) tagCounts[label] = (tagCounts[label] ?? 0) + 1
    })
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label)

  const pp = propertyProfile
  const glanceAverages = pp ? [
    { label: 'Payment & Financial',    avg: avgRating([pp.avg_payment_timeliness, pp.avg_ease_of_collecting, pp.avg_final_payment_experience]) },
    { label: 'Scope & Change',          avg: avgRating([pp.avg_scope_clarity, pp.avg_change_order_willingness]) },
    { label: 'Communication',           avg: avgRating([pp.avg_ease_of_interaction, pp.avg_responsiveness, pp.avg_professionalism, pp.avg_decision_consistency]) },
    { label: 'Timeline & Preparedness', avg: avgRating([pp.avg_timeline_expectations, pp.avg_plan_readiness, pp.avg_financial_readiness]) },
    { label: 'Site Conditions',         avg: pp.avg_site_accessibility },
  ].filter(s => s.avg != null) as { label: string; avg: number }[] : []

  const flagItems = pp ? [
    { label: 'No Call / No Show reported',     count: pp.no_call_no_show_count,           serious: true,  prefix: '⚠️' },
    { label: 'payment delay reports',           count: pp.flag_payment_delays_count,       serious: false, prefix: '' },
    { label: 'legal action reports',            count: pp.flag_legal_action_count,         serious: false, prefix: '' },
    { label: 'disputed scope reports',          count: pp.flag_disputed_scope_count,       serious: false, prefix: '' },
    { label: 'aggressive behaviour reports',    count: pp.flag_aggressive_behaviour_count, serious: true,  prefix: '⚠️' },
    { label: 'safety challenge reports',        count: pp.flag_safety_challenges_count,    serious: true,  prefix: '⚠️' },
  ].filter(f => f.count > 0) : []

  // ─── Parcel Details internal sections ──────────────────────────────────────

  const taxableVsAppraisedDiffers =
    property.taxable_land_value != null &&
    property.appraised_land_value != null &&
    property.appraised_land_value > 0 &&
    Math.abs(property.taxable_land_value - property.appraised_land_value) /
      property.appraised_land_value > 0.05

  const platLine = property.plat_name
    ? [property.plat_name, property.plat_lot ? `Lot ${property.plat_lot}` : null, property.plat_block ? `Block ${property.plat_block}` : null]
        .filter(Boolean).join(' ')
    : null

  const detailRows = [
    property.zoning            ? { label: 'Zoning',            value: property.zoning } : null,
    property.legal_desc        ? { label: 'Legal Description',  value: property.legal_desc.length > 100 ? property.legal_desc.slice(0, 100) + '…' : property.legal_desc } : null,
    platLine                   ? { label: 'Plat',               value: platLine } : null,
    property.new_construction  ? { label: 'New Construction',   value: 'Yes' } : null,
    property.levy_jurisdiction ? { label: 'Levy Jurisdiction',  value: property.levy_jurisdiction } : null,
    property.tax_val_reason    ? { label: 'Tax Valuation Note', value: property.tax_val_reason } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const submittedHistory = userHistory.filter(r => r.status === 'submitted')
  const draft = userHistory.find(r => r.status === 'draft')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', paddingTop: NAV_H }}>
      <AppHeader isAdmin={navProfile?.is_admin ?? false} displayName={navProfile?.display_name ?? ''} showSearch onSearchSelect={handleSearchSelect} />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* Back button */}
        <button
          onClick={() => {
            const dashboardUrl = sessionStorage.getItem('dashboardUrl')
            router.push(dashboardUrl ?? '/dashboard')
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none', color: '#2563eb',
            cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1rem', padding: 0,
          }}
        >
          ← Back to Map
        </button>

        {/* ── PART 1: Property Header ── */}
        <div style={{
          backgroundColor: 'white', borderRadius: '12px',
          border: '1px solid #e5e7eb', padding: '1.5rem',
          marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {/* Address row + Leave a Review button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.2rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#111827', lineHeight: 1.25 }}>
              {property.address_full}
            </h1>
            <button
              onClick={() => router.push(`/property/${id}/review`)}
              style={{
                flexShrink: 0,
                padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: '500', minHeight: '44px',
              }}
            >
              + Leave a Review
            </button>
          </div>

          {/* City / State / Zip */}
          <p style={{ margin: '0 0 1.25rem', color: '#6b7280', fontSize: '0.95rem' }}>
            {property.city}, {property.state} {property.zip_code}
            {property.is_unincorporated && (
              <span style={{
                marginLeft: '0.5rem', fontSize: '0.75rem',
                backgroundColor: '#f3f4f6', color: '#6b7280',
                padding: '0.1rem 0.5rem', borderRadius: '9999px',
              }}>
                Unincorporated
              </span>
            )}
          </p>

          {/* Star rating summary */}
          {reviewCount > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.3rem' }}>
                <StarDisplay rating={propertyProfile?.avg_overall_rating ?? null} size={26} showEmpty />
                {propertyProfile?.avg_overall_rating != null && (
                  <span style={{ fontSize: '1.15rem', fontWeight: '700', color: '#111827' }}>
                    {propertyProfile.avg_overall_rating.toFixed(1)}
                  </span>
                )}
                <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>average</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#9ca3af' }}>
                {reviewCount} contractor review{reviewCount !== 1 ? 's' : ''}
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>No reviews yet</p>
          )}
        </div>

        {/* ── PART 2: At a Glance ── */}
        {reviewCount > 0 && (
          <div style={{
            backgroundColor: 'white', borderRadius: '12px',
            border: '1px solid #e5e7eb', padding: '1.5rem',
            marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
              At a Glance
            </h2>

            {/* Would Work Again */}
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>
                Would Work Again
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {wwaYes > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#166534', fontWeight: '500' }}>✓</span>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Would work again:</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#166534' }}>{wwaYes}</span>
                  </div>
                )}
                {wwaNo > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: '500' }}>✕</span>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Would not work again:</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#991b1b' }}>{wwaNo}</span>
                  </div>
                )}
                {wwaTerms > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: '500' }}>~</span>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Only with stricter terms:</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e' }}>{wwaTerms}</span>
                  </div>
                )}
                {wwaYes === 0 && wwaNo === 0 && wwaTerms === 0 && (
                  <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>Not recorded</span>
                )}
              </div>
            </div>

            {/* Section rating averages */}
            {glanceAverages.length > 0 && (
              <>
                <div style={{ height: '1px', backgroundColor: '#f3f4f6', margin: '0 0 1.25rem' }} />
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>
                    Section Averages
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {glanceAverages.map(s => (
                      <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: '#374151' }}>{s.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <StarDisplay rating={s.avg} size={14} />
                          <span style={{ fontSize: '0.8rem', color: '#6b7280', minWidth: '2rem', textAlign: 'right' }}>{s.avg.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Flag counts */}
            {flagItems.length > 0 && (
              <>
                <div style={{ height: '1px', backgroundColor: '#f3f4f6', margin: '0 0 1.25rem' }} />
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>
                    Reported Issues
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {flagItems.map(f => (
                      <div key={f.label} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        backgroundColor: f.serious ? '#fef2f2' : '#fffbeb',
                        border: `1px solid ${f.serious ? '#fecaca' : '#fde68a'}`,
                        borderRadius: '8px',
                        padding: '0.4rem 0.75rem',
                        alignSelf: 'flex-start',
                      }}>
                        {f.prefix && <span style={{ fontSize: '0.875rem' }}>{f.prefix}</span>}
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: f.serious ? '#991b1b' : '#92400e' }}>
                          {f.count}
                        </span>
                        <span style={{ fontSize: '0.875rem', color: f.serious ? '#991b1b' : '#92400e' }}>
                          {f.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Top client pattern tags */}
            {topTags.length > 0 && (
              <>
                <div style={{ height: '1px', backgroundColor: '#f3f4f6', margin: '0 0 1.25rem' }} />
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>
                    Common Tags
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {topTags.map((tag, i) => (
                      <Pill key={i} label={tag} bg="#f3f4f6" color="#374151" />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PART 3: Parcel Details (collapsible) ── */}
        <div style={{
          backgroundColor: 'white', borderRadius: '12px',
          border: '1px solid #e5e7eb',
          marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setParcelOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1.25rem 1.5rem',
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Parcel Details</h2>
            <Chevron open={parcelOpen} />
          </button>

          {parcelOpen && (
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '1.5rem' }}>

              {/* Key facts grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Present Use',        value: property.present_use || 'N/A' },
                  { label: 'Property Type',      value: property.property_type || 'N/A' },
                  { label: 'Lot Size',           value: property.square_feet_lot ? `${property.square_feet_lot.toLocaleString()} sq ft` : 'N/A' },
                  { label: 'Acreage',            value: property.acreage ? `${property.acreage.toFixed(3)} acres` : 'N/A' },
                  { label: 'Assessed Value',     value: formatCurrency(property.appraised_total_value) },
                  { label: 'Land Value',         value: formatCurrency(property.appraised_land_value) },
                  { label: 'Improvement Value',  value: formatCurrency(property.appraised_improvement_value) },
                  { label: 'Tax Year',           value: property.tax_year?.toString() || 'N/A' },
                  { label: 'Last Sale Price',    value: formatCurrency(property.last_sale_price) },
                  { label: 'Last Sale Date',     value: formatDate(property.last_sale_date) },
                  { label: 'Parcel Number',      value: property.parcel_number },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {item.label}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#111827', fontWeight: '500' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Additional detail rows */}
              {(taxableVsAppraisedDiffers || detailRows.length > 0) && (
                <>
                  <div style={{ height: '1px', backgroundColor: '#f3f4f6', marginBottom: '1.25rem' }} />

                  {taxableVsAppraisedDiffers && (
                    <div style={{
                      backgroundColor: '#fffbeb', border: '1px solid #fde68a',
                      borderRadius: '8px', padding: '0.625rem 0.875rem',
                      marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e',
                    }}>
                      Taxable value differs from appraised — exemption may apply
                    </div>
                  )}

                  {detailRows.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      {detailRows.map(row => (
                        <div key={row.label}>
                          <p style={{ margin: '0 0 0.15rem', fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {row.label}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#111827', fontWeight: '500' }}>
                            {row.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Public Records links */}
              <div style={{ height: '1px', backgroundColor: '#f3f4f6', marginBottom: '1.25rem' }} />
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Public Records
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {property.parcel_number && (
                  <a
                    href={`https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=${property.parcel_number}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.875rem 1rem', border: '1px solid #e5e7eb', borderRadius: '8px',
                      textDecoration: 'none', minHeight: '48px', transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div>
                      <p style={{ margin: '0 0 0.1rem', fontSize: '0.9rem', fontWeight: '500', color: '#111827' }}>
                        View Tax &amp; Assessment Records
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                        King County Department of Assessments
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: '0.75rem' }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}
                <a
                  href="https://recordsearch.kingcounty.gov/LandmarkWeb/search/index"
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.875rem 1rem', border: '1px solid #e5e7eb', borderRadius: '8px',
                    textDecoration: 'none', minHeight: '48px', transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div>
                    <p style={{ margin: '0 0 0.1rem', fontSize: '0.9rem', fontWeight: '500', color: '#111827' }}>
                      Search Lien &amp; Deed Records
                    </p>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#6b7280' }}>
                      King County Recorder&apos;s Office
                    </p>
                    {property.parcel_number && (
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af' }}>
                        Search by Parcel ID: {property.parcel_number}
                      </p>
                    )}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: '0.75rem' }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ── PART 4: Contractor Reviews ── */}

        {/* Your History Banner */}
        {(submittedHistory.length > 0 || draft) && (
          <div style={{
            backgroundColor: 'white', borderRadius: '12px',
            border: '1px solid #e5e7eb', padding: '1.25rem 1.5rem',
            marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Your History
            </p>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', color: '#374151', lineHeight: '1.6' }}>
              My Reviews for this property: <span style={{ fontWeight: '500' }}>{submittedHistory.length}</span>
            </p>
            {submittedHistory.length > 0 && (
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', color: '#374151', lineHeight: '1.6' }}>
                Last Review: <span style={{ fontWeight: '500' }}>{formatDate(submittedHistory[0].updated_at)}</span>
              </p>
            )}
            {draft && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#92400e', lineHeight: '1.6' }}>
                ⚠️ You have a draft in progress —{' '}
                <button
                  onClick={() => router.push(`/property/${id}/review?draftId=${draft.id}`)}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#d97706', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'underline' }}
                >
                  Resume draft
                </button>
              </p>
            )}
          </div>
        )}

        {/* Reviews section heading */}
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
            Contractor Reviews
            {reviews.length > 0 && (
              <span style={{
                marginLeft: '0.5rem', fontSize: '0.875rem',
                backgroundColor: '#dbeafe', color: '#1d4ed8',
                padding: '0.1rem 0.6rem', borderRadius: '9999px', fontWeight: '500',
              }}>
                {reviews.length}
              </span>
            )}
          </h2>
        </div>

        {/* No Reviews State */}
        {reviews.length === 0 && (
          <div style={{
            backgroundColor: 'white', borderRadius: '12px',
            border: '1px solid #e5e7eb', padding: '2rem',
            textAlign: 'center', color: '#6b7280',
          }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>No reviews yet for this property.</p>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Be the first contractor to leave a review.</p>
          </div>
        )}

        {/* Review Cards */}
        {reviews.map(review => {
          const roleLabel = formatRoleLabel(review.contractor_role)
          const businessTypeLabel = review.users?.business_types?.label ?? null

          const jobContextParts = [
            review.job_size,
            review.completed_project != null ? `Completed: ${review.completed_project ? 'Yes' : 'No'}` : null,
            formatMonthYear(review.job_completion_date),
          ].filter(Boolean) as string[]

          const reviewerLine = [businessTypeLabel, roleLabel].filter(Boolean).join(' · ')

          const sections = [
            { label: 'Payment & Financial',     ratings: [review.payment_timeliness, review.ease_of_collecting_payment, review.final_payment_experience] },
            { label: 'Scope & Change',           ratings: [review.scope_clarity, review.change_order_willingness] },
            { label: 'Communication',            ratings: [review.ease_of_interaction, review.responsiveness, review.professionalism, review.decision_consistency] },
            { label: 'Timeline & Preparedness',  ratings: [review.timeline_expectations, review.plan_design_readiness, review.financial_readiness] },
            { label: 'Site Conditions',          ratings: [review.site_accessibility] },
          ].map(s => ({ label: s.label, avg: avgRating(s.ratings) }))
           .filter(s => s.avg != null) as { label: string; avg: number }[]

          const clientTags = (review.review_client_pattern_tags ?? []).map(t => t.client_pattern_tags?.label).filter(Boolean) as string[]
          const paymentTactics = (review.review_payment_tactics ?? []).map(t => t.payment_tactics?.label).filter(Boolean) as string[]
          const redFlags = (review.review_red_flags ?? []).map(t => t.red_flags?.label).filter(Boolean) as string[]

          return (
            <div
              key={review.id}
              style={{
                backgroundColor: 'white', borderRadius: '12px',
                border: '1px solid #e5e7eb', marginBottom: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden',
              }}
            >
              {/* 1. No Call / No Show Banner */}
              {review.no_call_no_show && (
                <div style={{
                  backgroundColor: '#dc2626', color: 'white',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem', fontWeight: '600',
                }}>
                  ⚠️ No Call / No Show reported
                </div>
              )}

              <div style={{ padding: '1.25rem 1.5rem' }}>

                {/* 2. Card Header Row */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem',
                  marginBottom: '0.5rem',
                }}>
                  {/* Left: stacked REVIEWER + CLIENT CONTACT rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>

                    {/* REVIEWER row */}
                    <div>
                      <p style={{ margin: '0 0 0.15rem', fontSize: '0.62rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: '600' }}>
                        Reviewer
                      </p>
                      {reviewerLine
                        ? <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>{reviewerLine}</p>
                        : <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>Unknown</p>
                      }
                    </div>

                    {/* CLIENT CONTACT row */}
                    <div>
                      <p style={{ margin: '0 0 0.15rem', fontSize: '0.62rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: '600' }}>
                        Client Contact
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {review.primary_contact_name
                          ? <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>{review.primary_contact_name}</span>
                          : <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No contact recorded</span>
                        }
                        {review.primary_contact_is_owner != null && (
                          <span style={{
                            backgroundColor: review.primary_contact_is_owner ? '#eff6ff' : '#f9fafb',
                            color: review.primary_contact_is_owner ? '#1d4ed8' : '#6b7280',
                            border: `1px solid ${review.primary_contact_is_owner ? '#bfdbfe' : '#e5e7eb'}`,
                            padding: '0.1rem 0.5rem', borderRadius: '9999px',
                            fontSize: '0.68rem', fontWeight: '500',
                          }}>
                            {review.primary_contact_is_owner ? 'Owner' : 'Not Owner'}
                          </span>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Right: Would Work Again badge */}
                  {review.would_work_again && (
                    <div>
                      {review.would_work_again === 'yes' && (
                        <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '600' }}>
                          Would work again ✓
                        </span>
                      )}
                      {review.would_work_again === 'no' && (
                        <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '600' }}>
                          Would not work again
                        </span>
                      )}
                      {review.would_work_again === 'higher_price_stricter_terms' && (
                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '600' }}>
                          Only with stricter terms
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Job Context Row */}
                {jobContextParts.length > 0 && (
                  <p style={{ margin: '0 0 0.875rem', fontSize: '0.78rem', color: '#9ca3af' }}>
                    {jobContextParts.join(' · ')}
                  </p>
                )}

                {/* 4. Overall Star Rating */}
                {review.overall_rating != null && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Overall Rating
                    </p>
                    <StarDisplay rating={review.overall_rating} size={22} />
                  </div>
                )}

                {/* 5. Section Ratings */}
                {sections.length > 0 && (
                  <div style={{
                    backgroundColor: '#f9fafb', borderRadius: '8px',
                    padding: '0.75rem', marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {sections.map(section => (
                        <div key={section.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{section.label}</span>
                          <StarDisplay rating={section.avg} size={14} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Client Pattern Tags */}
                {clientTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {clientTags.map((tag, i) => (
                      <Pill key={i} label={tag} bg="#f3f4f6" color="#374151" />
                    ))}
                  </div>
                )}

                {/* 7. Payment Tactics */}
                {paymentTactics.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Payment Tactics
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {paymentTactics.map((label, i) => (
                        <Pill key={i} label={label} bg="#fef3c7" color="#92400e" />
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. Red Flags */}
                {redFlags.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Red Flags
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {redFlags.map((label, i) => (
                        <Pill key={i} label={label} bg="#fef2f2" color="#b91c1c" />
                      ))}
                    </div>
                  </div>
                )}

                {/* 9. Watch Out For */}
                {review.watch_out_for && (
                  <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '0.75rem', marginBottom: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', fontWeight: '600', color: '#92400e' }}>Watch out for</p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{review.watch_out_for}</p>
                  </div>
                )}

                {/* 10. What Worked Well */}
                {review.what_worked_well && (
                  <div style={{ borderLeft: '3px solid #16a34a', paddingLeft: '0.75rem', marginBottom: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', fontWeight: '600', color: '#166534' }}>What worked well</p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{review.what_worked_well}</p>
                  </div>
                )}

                {/* 11. Review Text */}
                {(review.title || review.body) && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    {review.title && (
                      <p style={{ margin: '0 0 0.25rem', fontWeight: '600', fontSize: '0.9rem', color: '#111827' }}>{review.title}</p>
                    )}
                    {review.body && (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{review.body}</p>
                    )}
                  </div>
                )}

                {/* 12. Card Footer */}
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#9ca3af' }}>
                  Submitted {formatDateShort(review.updated_at)}
                </p>

              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}
