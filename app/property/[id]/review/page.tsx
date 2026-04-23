'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import DashNav, { NAV_H } from '@/components/DashNav'
import { useProfile } from '@/lib/useProfile'

// ─── Types ────────────────────────────────────────────────────────────────────

type RefItem = { id: number; label: string; code: string }
type PatternTag = { id: string; label: string; slug: string }

type FormState = {
  primary_contact_name: string
  primary_contact_is_owner: 'yes' | 'no' | 'unknown' | null
  no_call_no_show: boolean | null
  contractor_role: 'general_contractor' | 'subcontractor' | 'specialist_trade' | null
  job_size: string
  job_value: string
  completed_project: boolean | null
  job_completion_date: string
  job_description: string
  overall_rating: number
  would_work_again: 'yes' | 'no' | 'higher_price_stricter_terms' | null
  selected_pattern_tags: string[]
  paid_on_time: boolean | null
  payment_timeliness: number
  ease_of_collecting_payment: number
  final_payment_experience: number
  flag_payment_delays: boolean | null
  flag_renegotiated_mid_project: boolean | null
  flag_required_legal_action: boolean | null
  selected_tactics: number[]
  scope_clarity: number
  scope_change_frequency: number
  change_order_willingness: number
  change_request_count: string
  flag_expected_unpaid_work: boolean | null
  flag_disputed_agreed_scope: boolean | null
  selected_red_flags_s4: number[]
  ease_of_interaction: number
  responsiveness: number
  professionalism: number
  clear_decision_maker: boolean | null
  decision_consistency: number
  flag_hard_to_reach: boolean | null
  flag_conflicting_directions: boolean | null
  flag_frequent_reversals: boolean | null
  flag_last_minute_changes: boolean | null
  selected_red_flags_s5: number[]
  timeline_expectations: number
  plan_design_readiness: number
  financial_readiness: number
  site_type: 'occupied' | 'vacant' | null
  site_accessibility: number
  flag_unrealistic_deadlines: boolean | null
  flag_blamed_for_delays: boolean | null
  flag_major_changes_after_start: boolean | null
  flag_financial_issues_impacted: boolean | null
  flag_site_restrictions_impacted: boolean | null
  flag_safety_or_access_challenges: boolean | null
  selected_red_flags_s6: number[]
  title: string
  body: string
  watch_out_for: string
  what_worked_well: string
}

const EMPTY_FORM: FormState = {
  primary_contact_name: '',
  primary_contact_is_owner: null,
  no_call_no_show: null,
  contractor_role: null,
  job_size: '',
  job_value: '',
  completed_project: null,
  job_completion_date: '',
  job_description: '',
  overall_rating: 0,
  would_work_again: null,
  selected_pattern_tags: [],
  paid_on_time: null,
  payment_timeliness: 0,
  ease_of_collecting_payment: 0,
  final_payment_experience: 0,
  flag_payment_delays: null,
  flag_renegotiated_mid_project: null,
  flag_required_legal_action: null,
  selected_tactics: [],
  scope_clarity: 0,
  scope_change_frequency: 0,
  change_order_willingness: 0,
  change_request_count: '',
  flag_expected_unpaid_work: null,
  flag_disputed_agreed_scope: null,
  selected_red_flags_s4: [],
  ease_of_interaction: 0,
  responsiveness: 0,
  professionalism: 0,
  clear_decision_maker: null,
  decision_consistency: 0,
  flag_hard_to_reach: null,
  flag_conflicting_directions: null,
  flag_frequent_reversals: null,
  flag_last_minute_changes: null,
  selected_red_flags_s5: [],
  timeline_expectations: 0,
  plan_design_readiness: 0,
  financial_readiness: 0,
  site_type: null,
  site_accessibility: 0,
  flag_unrealistic_deadlines: null,
  flag_blamed_for_delays: null,
  flag_major_changes_after_start: null,
  flag_financial_issues_impacted: null,
  flag_site_restrictions_impacted: null,
  flag_safety_or_access_challenges: null,
  selected_red_flags_s6: [],
  title: '',
  body: '',
  watch_out_for: '',
  what_worked_well: '',
}

// Red flag IDs assigned per section based on semantic fit
const RED_FLAGS_S4 = [1, 2, 3, 4, 8, 10]
const RED_FLAGS_S5 = [5, 6, 9]
const RED_FLAGS_S6 = [7]

// Values must match DB CHECK constraint exactly
const JOB_SIZES = ['Under $500', '$500 - $2,500', '$2,500 - $10,000', '$10,000 - $50,000', 'Over $50,000']

// ─── Helper Components ────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function SectionCard({
  title, subtitle, open, onToggle, disabled, children,
}: {
  title: string
  subtitle?: string
  open: boolean
  onToggle: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`bg-white rounded-xl border mb-3 overflow-hidden shadow-sm transition-opacity ${disabled ? 'opacity-60' : 'opacity-100'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <span className="font-semibold text-gray-900 text-base">{title}</span>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className={`px-5 pb-5 border-t border-gray-100 ${disabled ? 'pointer-events-none select-none' : ''}`}>
          {children}
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

// Wraps a field selector in an error highlight when error=true
function FieldErrorWrap({ error, children }: { error: boolean; children: React.ReactNode }) {
  if (!error) return <>{children}</>
  return (
    <div style={{
      border: '1px solid rgba(231,91,82,1)',
      backgroundColor: 'rgba(231,91,82,0.08)',
      borderRadius: '0.5rem',
      padding: '8px',
      display: 'inline-block',
    }}>
      {children}
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star} type="button" onClick={() => onChange(star)}
          className={`text-3xl leading-none transition-colors ${star <= value ? 'text-amber-400' : 'text-gray-200'} hover:text-amber-300`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function YesNo({
  value, onChange, disabled, invert,
}: {
  value: boolean | null
  onChange: (v: boolean) => void
  disabled?: boolean
  invert?: boolean
}) {
  return (
    <div className="flex gap-2">
      {([true, false] as const).map((v) => (
        <button
          key={String(v)} type="button"
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors ${
            value === v
              ? (invert ? !v : v)
                ? 'bg-green-50 border-green-500 text-green-700'
                : 'bg-red-50 border-red-400 text-red-700'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
          }`}
        >
          {v ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  )
}

function ThreeWay<T extends string>({
  options, value, onChange,
}: {
  options: { label: string; value: T }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function PillSelect({
  options, selected, onToggle, max,
}: {
  options: { id: string | number; label: string }[]
  selected: (string | number)[]
  onToggle: (id: string | number) => void
  max?: number
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.id)
        const atMax = max !== undefined && selected.length >= max && !active
        return (
          <button
            key={String(opt.id)} type="button"
            disabled={atMax}
            onClick={() => onToggle(opt.id)}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
              active
                ? 'bg-blue-600 border-blue-600 text-white'
                : atMax
                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function FlagRow({
  label, value, onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700 pr-4">{label}</span>
      <YesNo value={value} onChange={onChange} invert />
    </div>
  )
}

function SubBlock({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return (
    <div className="mt-4 pt-4 border-t border-amber-100 bg-amber-50 rounded-lg px-4 pb-4 space-y-4 transition-all">
      {children}
    </div>
  )
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 space-y-4">{children}</div>
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
      type === 'success' ? 'bg-gray-900' : 'bg-red-600'
    }`}>
      {message}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReviewPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const propertyId = params.id as string
  const supabase = createClient()
  const { profile: navProfile } = useProfile()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [propertyAddress, setPropertyAddress] = useState('')
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [errorBarDismissed, setErrorBarDismissed] = useState(false)

  const [paymentTactics, setPaymentTactics] = useState<RefItem[]>([])
  const [redFlags, setRedFlags] = useState<RefItem[]>([])
  const [patternTags, setPatternTags] = useState<PatternTag[]>([])

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [openSections, setOpenSections] = useState({
    s1: true, s2: true, s3: false, s4: false, s5: false, s6: false, s7: true,
  })

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleSection = (s: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [s]: !prev[s] }))
  }

  const togglePill = (field: 'selected_tactics' | 'selected_red_flags_s4' | 'selected_red_flags_s5' | 'selected_red_flags_s6', id: number) => {
    setForm(prev => {
      const arr = prev[field] as number[]
      return {
        ...prev,
        [field]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id],
      }
    })
  }

  const togglePatternTag = (id: string) => {
    setForm(prev => {
      const arr = prev.selected_pattern_tags
      return {
        ...prev,
        selected_pattern_tags: arr.includes(id)
          ? arr.filter(x => x !== id)
          : arr.length < 3 ? [...arr, id] : arr,
      }
    })
  }

  // ─── Load ────────────────────────────────────────────────────────────────────

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

      const { data: property } = await supabase
        .from('properties')
        .select('id, address_full')
        .eq('id', propertyId)
        .single()

      if (!property) { router.push('/dashboard'); return }
      setPropertyAddress(property.address_full)

      // Load draft by ID if specified (from history banner), otherwise find most recent draft
      const draftId = searchParams.get('draftId')
      const draftQuery = draftId
        ? supabase.from('reviews').select('*').eq('id', draftId).eq('user_id', user.id).eq('status', 'draft').maybeSingle()
        : supabase.from('reviews').select('*').eq('property_id', propertyId).eq('user_id', user.id).eq('status', 'draft').order('created_at', { ascending: false }).limit(1).maybeSingle()

      const { data: existingDraft } = await draftQuery
      if (existingDraft) {
        setReviewId(existingDraft.id)
        await populateDraft(existingDraft)
      }

      // Load reference data
      const [{ data: tactics }, { data: flags }, { data: tags }] = await Promise.all([
        supabase.from('payment_tactics').select('id, label, code').eq('is_active', true).order('sort_order'),
        supabase.from('red_flags').select('id, label, code').eq('is_active', true).order('sort_order'),
        supabase.from('client_pattern_tags').select('id, label, slug').order('sort_order'),
      ])

      if (tactics) setPaymentTactics(tactics)
      if (flags) setRedFlags(flags)
      if (tags) setPatternTags(tags)

      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const populateDraft = async (draft: Record<string, unknown>) => {
    const rid = draft.id as string

    const [{ data: tactics }, { data: flags }, { data: tags }] = await Promise.all([
      supabase.from('review_payment_tactics').select('tactic_id').eq('review_id', rid),
      supabase.from('review_red_flags').select('flag_id').eq('review_id', rid),
      supabase.from('review_client_pattern_tags').select('tag_id').eq('review_id', rid),
    ])

    const flagIds = flags?.map(f => f.flag_id as number) ?? []

    setForm({
      primary_contact_name: (draft.primary_contact_name as string) ?? '',
      primary_contact_is_owner: (draft.primary_contact_is_owner as FormState['primary_contact_is_owner']) ?? null,
      no_call_no_show: draft.no_call_no_show != null ? Boolean(draft.no_call_no_show) : null,
      contractor_role: (draft.contractor_role as FormState['contractor_role']) ?? null,
      job_size: (draft.job_size as string) ?? '',
      job_value: draft.job_value != null ? String(draft.job_value) : '',
      completed_project: draft.completed_project != null ? Boolean(draft.completed_project) : null,
      job_completion_date: (draft.job_completion_date as string) ?? '',
      job_description: (draft.job_description as string) ?? '',
      overall_rating: (draft.overall_rating as number) ?? 0,
      would_work_again: (draft.would_work_again as FormState['would_work_again']) ?? null,
      selected_pattern_tags: tags?.map(t => t.tag_id as string) ?? [],
      paid_on_time: draft.paid_on_time != null ? Boolean(draft.paid_on_time) : null,
      payment_timeliness: (draft.payment_timeliness as number) ?? 0,
      ease_of_collecting_payment: (draft.ease_of_collecting_payment as number) ?? 0,
      final_payment_experience: (draft.final_payment_experience as number) ?? 0,
      flag_payment_delays: draft.flag_payment_delays != null ? Boolean(draft.flag_payment_delays) : null,
      flag_renegotiated_mid_project: draft.flag_renegotiated_mid_project != null ? Boolean(draft.flag_renegotiated_mid_project) : null,
      flag_required_legal_action: draft.flag_required_legal_action != null ? Boolean(draft.flag_required_legal_action) : null,
      selected_tactics: tactics?.map(t => t.tactic_id as number) ?? [],
      scope_clarity: (draft.scope_clarity as number) ?? 0,
      scope_change_frequency: (draft.scope_change_frequency as number) ?? 0,
      change_order_willingness: (draft.change_order_willingness as number) ?? 0,
      change_request_count: draft.change_request_count != null ? String(draft.change_request_count) : '',
      flag_expected_unpaid_work: draft.flag_expected_unpaid_work != null ? Boolean(draft.flag_expected_unpaid_work) : null,
      flag_disputed_agreed_scope: draft.flag_disputed_agreed_scope != null ? Boolean(draft.flag_disputed_agreed_scope) : null,
      selected_red_flags_s4: flagIds.filter(id => RED_FLAGS_S4.includes(id)),
      ease_of_interaction: (draft.ease_of_interaction as number) ?? 0,
      responsiveness: (draft.responsiveness as number) ?? 0,
      professionalism: (draft.professionalism as number) ?? 0,
      clear_decision_maker: draft.clear_decision_maker != null ? Boolean(draft.clear_decision_maker) : null,
      decision_consistency: (draft.decision_consistency as number) ?? 0,
      flag_hard_to_reach: draft.flag_hard_to_reach != null ? Boolean(draft.flag_hard_to_reach) : null,
      flag_conflicting_directions: draft.flag_conflicting_directions != null ? Boolean(draft.flag_conflicting_directions) : null,
      flag_frequent_reversals: draft.flag_frequent_reversals != null ? Boolean(draft.flag_frequent_reversals) : null,
      flag_last_minute_changes: draft.flag_last_minute_changes != null ? Boolean(draft.flag_last_minute_changes) : null,
      selected_red_flags_s5: flagIds.filter(id => RED_FLAGS_S5.includes(id)),
      timeline_expectations: (draft.timeline_expectations as number) ?? 0,
      plan_design_readiness: (draft.plan_design_readiness as number) ?? 0,
      financial_readiness: (draft.financial_readiness as number) ?? 0,
      site_type: (draft.site_type as FormState['site_type']) ?? null,
      site_accessibility: (draft.site_accessibility as number) ?? 0,
      flag_unrealistic_deadlines: draft.flag_unrealistic_deadlines != null ? Boolean(draft.flag_unrealistic_deadlines) : null,
      flag_blamed_for_delays: draft.flag_blamed_for_delays != null ? Boolean(draft.flag_blamed_for_delays) : null,
      flag_major_changes_after_start: draft.flag_major_changes_after_start != null ? Boolean(draft.flag_major_changes_after_start) : null,
      flag_financial_issues_impacted: draft.flag_financial_issues_impacted != null ? Boolean(draft.flag_financial_issues_impacted) : null,
      flag_site_restrictions_impacted: draft.flag_site_restrictions_impacted != null ? Boolean(draft.flag_site_restrictions_impacted) : null,
      flag_safety_or_access_challenges: draft.flag_safety_or_access_challenges != null ? Boolean(draft.flag_safety_or_access_challenges) : null,
      selected_red_flags_s6: flagIds.filter(id => RED_FLAGS_S6.includes(id)),
      title: (draft.title as string) ?? '',
      body: (draft.body as string) ?? '',
      watch_out_for: (draft.watch_out_for as string) ?? '',
      what_worked_well: (draft.what_worked_well as string) ?? '',
    })
  }

  // ─── Save / Submit ────────────────────────────────────────────────────────────

  const buildReviewPayload = (status: 'draft' | 'submitted') => ({
    status,
    last_edited_at: new Date().toISOString(),
    primary_contact_name: form.primary_contact_name || null,
    primary_contact_is_owner: form.primary_contact_is_owner,
    no_call_no_show: form.no_call_no_show ?? false,
    contractor_role: form.contractor_role,
    job_size: form.job_size || null,
    job_value: form.job_value ? parseFloat(form.job_value) : null,
    completed_project: form.completed_project,
    job_completion_date: form.job_completion_date || null,
    job_description: form.job_description || null,
    overall_rating: form.overall_rating || null,
    would_work_again: form.would_work_again,
    paid_on_time: form.paid_on_time,
    payment_timeliness: form.payment_timeliness || null,
    ease_of_collecting_payment: form.ease_of_collecting_payment || null,
    final_payment_experience: form.final_payment_experience || null,
    flag_payment_delays: form.flag_payment_delays,
    flag_renegotiated_mid_project: form.flag_renegotiated_mid_project,
    flag_required_legal_action: form.flag_required_legal_action,
    scope_clarity: form.scope_clarity || null,
    scope_change_frequency: form.scope_change_frequency || null,
    change_order_willingness: form.change_order_willingness || null,
    change_request_count: form.change_request_count ? parseInt(form.change_request_count) : null,
    flag_expected_unpaid_work: form.flag_expected_unpaid_work,
    flag_disputed_agreed_scope: form.flag_disputed_agreed_scope,
    ease_of_interaction: form.ease_of_interaction || null,
    responsiveness: form.responsiveness || null,
    professionalism: form.professionalism || null,
    clear_decision_maker: form.clear_decision_maker,
    decision_consistency: form.decision_consistency || null,
    flag_hard_to_reach: form.flag_hard_to_reach,
    flag_conflicting_directions: form.flag_conflicting_directions,
    flag_frequent_reversals: form.flag_frequent_reversals,
    flag_last_minute_changes: form.flag_last_minute_changes,
    timeline_expectations: form.timeline_expectations || null,
    plan_design_readiness: form.plan_design_readiness || null,
    financial_readiness: form.financial_readiness || null,
    site_type: form.site_type,
    site_accessibility: form.site_accessibility || null,
    flag_unrealistic_deadlines: form.flag_unrealistic_deadlines,
    flag_blamed_for_delays: form.flag_blamed_for_delays,
    flag_major_changes_after_start: form.flag_major_changes_after_start,
    flag_financial_issues_impacted: form.flag_financial_issues_impacted,
    flag_site_restrictions_impacted: form.flag_site_restrictions_impacted,
    flag_safety_or_access_challenges: form.flag_safety_or_access_challenges,
    title: form.title || null,
    body: form.body || null,
    watch_out_for: form.watch_out_for || null,
    what_worked_well: form.what_worked_well || null,
  })

  const syncJunctionTables = async (rid: string) => {
    console.log('[syncJunctionTables] rid:', rid)
    const [d1, d2, d3] = await Promise.all([
      supabase.from('review_payment_tactics').delete().eq('review_id', rid),
      supabase.from('review_red_flags').delete().eq('review_id', rid),
      supabase.from('review_client_pattern_tags').delete().eq('review_id', rid),
    ])
    if (d1.error) console.error('[syncJunction] delete tactics:', d1.error)
    if (d2.error) console.error('[syncJunction] delete red_flags:', d2.error)
    if (d3.error) console.error('[syncJunction] delete pattern_tags:', d3.error)

    const allFlags = [
      ...form.selected_red_flags_s4,
      ...form.selected_red_flags_s5,
      ...form.selected_red_flags_s6,
    ]

    const [i1, i2, i3] = await Promise.all([
      form.selected_tactics.length > 0
        ? supabase.from('review_payment_tactics').insert(
            form.selected_tactics.map(tactic_id => ({ review_id: rid, tactic_id }))
          )
        : Promise.resolve({ error: null }),
      allFlags.length > 0
        ? supabase.from('review_red_flags').insert(
            allFlags.map(flag_id => ({ review_id: rid, flag_id }))
          )
        : Promise.resolve({ error: null }),
      form.selected_pattern_tags.length > 0
        ? supabase.from('review_client_pattern_tags').insert(
            form.selected_pattern_tags.map(tag_id => ({ review_id: rid, tag_id }))
          )
        : Promise.resolve({ error: null }),
    ])
    if (i1 && 'error' in i1 && i1.error) console.error('[syncJunction] insert tactics:', i1.error)
    if (i2 && 'error' in i2 && i2.error) console.error('[syncJunction] insert red_flags:', i2.error)
    if (i3 && 'error' in i3 && i3.error) console.error('[syncJunction] insert pattern_tags:', i3.error)
  }

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); router.push('/'); return }

    const payload = buildReviewPayload('draft')
    let rid = reviewId
    console.log('[handleSave] user:', user.id, 'propertyId:', propertyId, 'existingReviewId:', rid)

    if (rid) {
      const { error } = await supabase.from('reviews').update(payload).eq('id', rid)
      if (error) {
        console.error('[handleSave] update error:', JSON.stringify(error, null, 2))
        showToast('Failed to save draft.', 'error'); setSaving(false); return
      }
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ ...payload, property_id: propertyId, user_id: user.id })
        .select('id')
        .single()
      if (error || !data) {
        console.error('[handleSave] insert error:', JSON.stringify(error, null, 2), 'payload:', JSON.stringify({ ...payload, property_id: propertyId, user_id: user.id }, null, 2))
        showToast('Failed to save draft.', 'error'); setSaving(false); return
      }
      rid = data.id
      setReviewId(rid)
    }

    await syncJunctionTables(rid!)
    setSaving(false)
    showToast('Draft saved — return to My Reviews or the property page to continue.')
  }

  const handleSubmit = async () => {
    // Run validation — if anything fails, mark attempt and bail
    const isNcns = form.no_call_no_show === true
    const hasErrors =
      form.no_call_no_show === null ||
      (!isNcns && (
        !form.contractor_role ||
        !form.job_size ||
        form.completed_project === null ||
        form.overall_rating === 0 ||
        !form.would_work_again
      ))

    if (hasErrors) {
      setSubmitAttempted(true)
      setErrorBarDismissed(false)
      return
    }

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); router.push('/'); return }

    const payload = buildReviewPayload('submitted')
    let rid = reviewId
    console.log('[handleSubmit] user:', user.id, 'propertyId:', propertyId, 'existingReviewId:', rid)

    if (rid) {
      const { error } = await supabase.from('reviews').update(payload).eq('id', rid)
      if (error) {
        console.error('[handleSubmit] update error:', JSON.stringify(error, null, 2))
        showToast('Failed to submit.', 'error'); setSubmitting(false); return
      }
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ ...payload, property_id: propertyId, user_id: user.id })
        .select('id')
        .single()
      if (error || !data) {
        console.error('[handleSubmit] insert error:', JSON.stringify(error, null, 2), 'payload:', JSON.stringify({ ...payload, property_id: propertyId, user_id: user.id }, null, 2))
        showToast('Failed to submit.', 'error'); setSubmitting(false); return
      }
      rid = data.id
      setReviewId(rid)
    }

    await syncJunctionTables(rid!)

    try {
      await supabase.rpc('rebuild_property_profile', { p_property_id: propertyId })
    } catch (rpcErr) {
      console.error('[handleSubmit] rebuild_property_profile error:', rpcErr)
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  // ─── Derived state ────────────────────────────────────────────────────────────

  const ncns = form.no_call_no_show === true

  // Live validation errors — only shown after first failed submit attempt
  const validationErrors = submitAttempted ? [
    ...(form.no_call_no_show === null ? ['Please answer the No Call / No Show question.'] : []),
    ...(!ncns && !form.contractor_role ? ['Please select your role.'] : []),
    ...(!ncns && !form.job_size ? ['Please select a job range.'] : []),
    ...(!ncns && form.completed_project === null ? ['Please indicate whether the project was completed.'] : []),
    ...(!ncns && form.overall_rating === 0 ? ['Please provide an overall client rating.'] : []),
    ...(!ncns && !form.would_work_again ? ['Please answer the "would you work again" question.'] : []),
  ] : []

  // Per-field error flags — derived live so highlights clear as fields are filled
  const fe = submitAttempted ? {
    no_call_no_show: form.no_call_no_show === null,
    contractor_role: !ncns && !form.contractor_role,
    job_size: !ncns && !form.job_size,
    completed_project: !ncns && form.completed_project === null,
    overall_rating: !ncns && form.overall_rating === 0,
    would_work_again: !ncns && !form.would_work_again,
  } : {
    no_call_no_show: false, contractor_role: false, job_size: false,
    completed_project: false, overall_rating: false, would_work_again: false,
  }

  const showS3Sub =
    form.paid_on_time === false ||
    (form.payment_timeliness > 0 && form.payment_timeliness <= 3) ||
    (form.ease_of_collecting_payment > 0 && form.ease_of_collecting_payment <= 3) ||
    (form.final_payment_experience > 0 && form.final_payment_experience <= 3)
  const showS4Sub =
    (form.scope_clarity > 0 && form.scope_clarity <= 3) ||
    (form.scope_change_frequency > 0 && form.scope_change_frequency <= 3) ||
    (form.change_order_willingness > 0 && form.change_order_willingness <= 3)
  const showS5Sub =
    form.clear_decision_maker === false ||
    (form.ease_of_interaction > 0 && form.ease_of_interaction <= 3) ||
    (form.responsiveness > 0 && form.responsiveness <= 3) ||
    (form.professionalism > 0 && form.professionalism <= 3) ||
    (form.decision_consistency > 0 && form.decision_consistency <= 3)
  const showS6Sub =
    (form.timeline_expectations > 0 && form.timeline_expectations <= 3) ||
    (form.plan_design_readiness > 0 && form.plan_design_readiness <= 3) ||
    (form.financial_readiness > 0 && form.financial_readiness <= 3) ||
    (form.site_accessibility > 0 && form.site_accessibility <= 3)

  const redFlagsS4 = redFlags.filter(f => RED_FLAGS_S4.includes(f.id))
  const redFlagsS5 = redFlags.filter(f => RED_FLAGS_S5.includes(f.id))
  const redFlagsS6 = redFlags.filter(f => RED_FLAGS_S6.includes(f.id))

  // ─── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ paddingTop: NAV_H }}>
        <DashNav isAdmin={navProfile?.is_admin ?? false} displayName={navProfile?.display_name ?? ''} />
        <div className="flex items-center justify-center pt-24 text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  // ─── Confirmation Screen ──────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ paddingTop: NAV_H }}>
        <DashNav isAdmin={navProfile?.is_admin ?? false} displayName={navProfile?.display_name ?? ''} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border shadow-sm max-w-sm w-full p-8 text-center">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Review Submitted</h2>
            <p className="text-gray-500 text-sm mb-4">{propertyAddress}</p>
            {form.overall_rating > 0 && (
              <div className="flex justify-center gap-1 mb-6">
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} className={`text-2xl ${s <= form.overall_rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-6">
              Your review is now visible to other contractors on this property.
            </p>
            <button
              onClick={() => router.push(`/property/${propertyId}`)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              View Property
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full mt-3 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Form ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingTop: NAV_H }}>
      <DashNav isAdmin={navProfile?.is_admin ?? false} displayName={navProfile?.display_name ?? ''} />

      <div className="max-w-2xl mx-auto px-4 py-5 pb-32" onClick={() => setErrorBarDismissed(true)}>

        {/* Header */}
        <button
          type="button"
          onClick={() => router.push(`/property/${propertyId}`)}
          className="flex items-center gap-1.5 text-blue-600 text-sm mb-4 hover:underline"
        >
          ← Back to Property
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Leave a Review</h1>
        <p className="text-sm text-gray-500 mb-5">{propertyAddress}</p>

        {reviewId && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <span className="text-base">●</span>
            Resuming draft
          </div>
        )}

        {ncns && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 text-sm rounded-lg px-4 py-3 mb-4">
            No Call / No Show recorded — you may submit now or add a note below.
          </div>
        )}

        {/* ── Section 1: Project Info ─────────────────────────────────────────── */}
        <SectionCard
          title="Project Info"
          open={openSections.s1}
          onToggle={() => toggleSection('s1')}
        >
          <FieldGroup>
            <div>
              <FieldLabel>Primary Contact Name</FieldLabel>
              <input
                type="text"
                value={form.primary_contact_name}
                onChange={e => set('primary_contact_name', e.target.value)}
                placeholder="Name of person you dealt with"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <FieldLabel>Was the primary contact the property owner?</FieldLabel>
              <ThreeWay
                options={[
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                  { label: 'Unknown', value: 'unknown' },
                ]}
                value={form.primary_contact_is_owner}
                onChange={v => set('primary_contact_is_owner', v)}
              />
            </div>

            <div>
              <FieldLabel required>No Call / No Show</FieldLabel>
              <p className="text-xs text-gray-500 mb-2">Select Yes if the client failed to show up or respond without notice.</p>
              <FieldErrorWrap error={fe.no_call_no_show}>
                <YesNo value={form.no_call_no_show} onChange={v => set('no_call_no_show', v)} invert />
              </FieldErrorWrap>
            </div>

            <div>
              <FieldLabel required>Your Role</FieldLabel>
              <FieldErrorWrap error={fe.contractor_role}>
                <ThreeWay
                  options={[
                    { label: 'General Contractor', value: 'general_contractor' },
                    { label: 'Subcontractor', value: 'subcontractor' },
                    { label: 'Specialist Trade', value: 'specialist_trade' },
                  ]}
                  value={form.contractor_role}
                  onChange={v => set('contractor_role', v)}
                />
              </FieldErrorWrap>
            </div>

            <div>
              <FieldLabel required>Job Range</FieldLabel>
              <FieldErrorWrap error={fe.job_size}>
                <div className="flex flex-wrap gap-2">
                  {JOB_SIZES.map(size => (
                    <button
                      key={size} type="button"
                      onClick={() => set('job_size', size)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.job_size === size
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </FieldErrorWrap>
            </div>

            <div>
              <FieldLabel>Job Value</FieldLabel>
              <p className="text-xs text-gray-500 mb-2">Optional</p>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">$</span>
                <input
                  type="number" min="0"
                  value={form.job_value}
                  onChange={e => set('job_value', e.target.value)}
                  placeholder="0"
                  className="w-44 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <FieldLabel required>Did you complete the project?</FieldLabel>
              <FieldErrorWrap error={fe.completed_project}>
                <YesNo value={form.completed_project} onChange={v => set('completed_project', v)} />
              </FieldErrorWrap>
            </div>

            {form.completed_project === true && (
              <div>
                <FieldLabel>Job Completion Date (optional)</FieldLabel>
                <input
                  type="date"
                  value={form.job_completion_date}
                  onChange={e => set('job_completion_date', e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <FieldLabel>Job Description (optional)</FieldLabel>
              <textarea
                value={form.job_description}
                onChange={e => set('job_description', e.target.value)}
                placeholder="Brief description of the work performed…"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </FieldGroup>
        </SectionCard>

        {/* ── Section 2: Overall Experience ──────────────────────────────────── */}
        <div className={ncns ? 'hidden' : ''}>
        <SectionCard
          title="Overall Experience"
          open={openSections.s2}
          onToggle={() => toggleSection('s2')}
        >
          <FieldGroup>
            <div>
              <FieldLabel required>Overall Client Rating</FieldLabel>
              <FieldErrorWrap error={fe.overall_rating}>
                <StarRating value={form.overall_rating} onChange={v => set('overall_rating', v)} />
              </FieldErrorWrap>
            </div>

            <div>
              <FieldLabel required>Would you work with this client again?</FieldLabel>
              <FieldErrorWrap error={fe.would_work_again}>
                <ThreeWay
                  options={[
                    { label: 'Yes', value: 'yes' },
                    { label: 'No', value: 'no' },
                    { label: 'Only with higher price / stricter terms', value: 'higher_price_stricter_terms' },
                  ]}
                  value={form.would_work_again}
                  onChange={v => set('would_work_again', v)}
                />
              </FieldErrorWrap>
            </div>

            <div>
              <FieldLabel>Client Pattern Tags <span className="text-gray-400 font-normal">(select up to 3)</span></FieldLabel>
              <PillSelect
                options={patternTags.map(t => ({ id: t.id, label: t.label }))}
                selected={form.selected_pattern_tags}
                onToggle={id => togglePatternTag(id as string)}
                max={3}
              />
            </div>
          </FieldGroup>
        </SectionCard>
        </div>

        {/* ── Section 3: Payment & Financial Behaviour ───────────────────────── */}
        <div className={ncns ? 'hidden' : ''}>
        <SectionCard
          title="Payment & Financial Behaviour"
          open={openSections.s3}
          onToggle={() => toggleSection('s3')}
        >
          <FieldGroup>
            <div>
              <FieldLabel>Did the client pay on time?</FieldLabel>
              <YesNo value={form.paid_on_time} onChange={v => set('paid_on_time', v)} />
            </div>

            <div>
              <FieldLabel>Payment Timeliness</FieldLabel>
              <StarRating value={form.payment_timeliness} onChange={v => set('payment_timeliness', v)} />
            </div>

            <div>
              <FieldLabel>Ease of Collecting Payment</FieldLabel>
              <StarRating value={form.ease_of_collecting_payment} onChange={v => set('ease_of_collecting_payment', v)} />
            </div>

            <div>
              <FieldLabel>Final Payment Experience</FieldLabel>
              <StarRating value={form.final_payment_experience} onChange={v => set('final_payment_experience', v)} />
            </div>

            <SubBlock show={showS3Sub}>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">Payment Issues</p>
              <FlagRow label="Were there payment delays?" value={form.flag_payment_delays} onChange={v => set('flag_payment_delays', v)} />
              <FlagRow label="Did the client renegotiate mid-project?" value={form.flag_renegotiated_mid_project} onChange={v => set('flag_renegotiated_mid_project', v)} />
              <FlagRow label="Did this require legal action?" value={form.flag_required_legal_action} onChange={v => set('flag_required_legal_action', v)} />
              {paymentTactics.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Payment Tactics Used</p>
                  <PillSelect
                    options={paymentTactics.map(t => ({ id: t.id, label: t.label }))}
                    selected={form.selected_tactics}
                    onToggle={id => togglePill('selected_tactics', id as number)}
                  />
                </div>
              )}
            </SubBlock>
          </FieldGroup>
        </SectionCard>
        </div>

        {/* ── Section 4: Scope & Change Behaviour ────────────────────────────── */}
        <div className={ncns ? 'hidden' : ''}>
        <SectionCard
          title="Scope & Change Behaviour"
          open={openSections.s4}
          onToggle={() => toggleSection('s4')}
        >
          <FieldGroup>
            <div>
              <FieldLabel>Clarity of Initial Scope</FieldLabel>
              <StarRating value={form.scope_clarity} onChange={v => set('scope_clarity', v)} />
            </div>

            <div>
              <FieldLabel>Frequency of Scope Changes</FieldLabel>
              <StarRating value={form.scope_change_frequency} onChange={v => set('scope_change_frequency', v)} />
            </div>

            <div>
              <FieldLabel>Willingness to Approve Change Orders</FieldLabel>
              <StarRating value={form.change_order_willingness} onChange={v => set('change_order_willingness', v)} />
            </div>

            <div>
              <FieldLabel>Approximate Number of Change Requests</FieldLabel>
              <input
                type="number" min="0"
                value={form.change_request_count}
                onChange={e => set('change_request_count', e.target.value)}
                className="w-28 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <SubBlock show={showS4Sub}>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">Scope Issues</p>
              <FlagRow label="Did the client expect unpaid work?" value={form.flag_expected_unpaid_work} onChange={v => set('flag_expected_unpaid_work', v)} />
              <FlagRow label="Did the client dispute the agreed scope?" value={form.flag_disputed_agreed_scope} onChange={v => set('flag_disputed_agreed_scope', v)} />
              {redFlagsS4.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Red Flags</p>
                  <PillSelect
                    options={redFlagsS4.map(f => ({ id: f.id, label: f.label }))}
                    selected={form.selected_red_flags_s4}
                    onToggle={id => togglePill('selected_red_flags_s4', id as number)}
                  />
                </div>
              )}
            </SubBlock>
          </FieldGroup>
        </SectionCard>
        </div>

        {/* ── Section 5: Communication & Decision-Making ─────────────────────── */}
        <div className={ncns ? 'hidden' : ''}>
        <SectionCard
          title="Communication & Decision-Making"
          open={openSections.s5}
          onToggle={() => toggleSection('s5')}
        >
          <FieldGroup>
            <div>
              <FieldLabel>Ease of Interaction</FieldLabel>
              <StarRating value={form.ease_of_interaction} onChange={v => set('ease_of_interaction', v)} />
            </div>

            <div>
              <FieldLabel>Responsiveness</FieldLabel>
              <StarRating value={form.responsiveness} onChange={v => set('responsiveness', v)} />
            </div>

            <div>
              <FieldLabel>Professionalism / Respect</FieldLabel>
              <StarRating value={form.professionalism} onChange={v => set('professionalism', v)} />
            </div>

            <div>
              <FieldLabel>Was a clear decision-maker identified?</FieldLabel>
              <YesNo value={form.clear_decision_maker} onChange={v => set('clear_decision_maker', v)} />
            </div>

            <div>
              <FieldLabel>Consistency of Decisions</FieldLabel>
              <StarRating value={form.decision_consistency} onChange={v => set('decision_consistency', v)} />
            </div>

            <SubBlock show={showS5Sub}>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">Communication Issues</p>
              <FlagRow label="Was the client hard to reach?" value={form.flag_hard_to_reach} onChange={v => set('flag_hard_to_reach', v)} />
              <FlagRow label="Were there conflicting directions?" value={form.flag_conflicting_directions} onChange={v => set('flag_conflicting_directions', v)} />
              <FlagRow label="Were there frequent reversals of decisions?" value={form.flag_frequent_reversals} onChange={v => set('flag_frequent_reversals', v)} />
              <FlagRow label="Were there last-minute changes?" value={form.flag_last_minute_changes} onChange={v => set('flag_last_minute_changes', v)} />
              {redFlagsS5.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Red Flags</p>
                  <PillSelect
                    options={redFlagsS5.map(f => ({ id: f.id, label: f.label }))}
                    selected={form.selected_red_flags_s5}
                    onToggle={id => togglePill('selected_red_flags_s5', id as number)}
                  />
                </div>
              )}
            </SubBlock>
          </FieldGroup>
        </SectionCard>
        </div>

        {/* ── Section 6: Timeline, Preparedness & Site ───────────────────────── */}
        <div className={ncns ? 'hidden' : ''}>
        <SectionCard
          title="Timeline, Preparedness & Site Conditions"
          open={openSections.s6}
          onToggle={() => toggleSection('s6')}
        >
          <FieldGroup>
            <div>
              <FieldLabel>Timeline Expectations</FieldLabel>
              <StarRating value={form.timeline_expectations} onChange={v => set('timeline_expectations', v)} />
            </div>

            <div>
              <FieldLabel>Plan / Design Readiness</FieldLabel>
              <StarRating value={form.plan_design_readiness} onChange={v => set('plan_design_readiness', v)} />
            </div>

            <div>
              <FieldLabel>Financial Readiness</FieldLabel>
              <StarRating value={form.financial_readiness} onChange={v => set('financial_readiness', v)} />
            </div>

            <div>
              <FieldLabel>Site Type</FieldLabel>
              <ThreeWay
                options={[
                  { label: 'Occupied', value: 'occupied' },
                  { label: 'Vacant', value: 'vacant' },
                ]}
                value={form.site_type}
                onChange={v => set('site_type', v)}
              />
            </div>

            <div>
              <FieldLabel>Site Accessibility</FieldLabel>
              <StarRating value={form.site_accessibility} onChange={v => set('site_accessibility', v)} />
            </div>

            <SubBlock show={showS6Sub}>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">Site & Timeline Issues</p>
              <FlagRow label="Were there unrealistic deadlines?" value={form.flag_unrealistic_deadlines} onChange={v => set('flag_unrealistic_deadlines', v)} />
              <FlagRow label="Were you blamed for delays outside your control?" value={form.flag_blamed_for_delays} onChange={v => set('flag_blamed_for_delays', v)} />
              <FlagRow label="Were there major changes after the project started?" value={form.flag_major_changes_after_start} onChange={v => set('flag_major_changes_after_start', v)} />
              <FlagRow label="Did financial issues impact the project?" value={form.flag_financial_issues_impacted} onChange={v => set('flag_financial_issues_impacted', v)} />
              <FlagRow label="Did site restrictions impact the project?" value={form.flag_site_restrictions_impacted} onChange={v => set('flag_site_restrictions_impacted', v)} />
              <FlagRow label="Were there safety or access challenges?" value={form.flag_safety_or_access_challenges} onChange={v => set('flag_safety_or_access_challenges', v)} />
              {redFlagsS6.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Red Flags</p>
                  <PillSelect
                    options={redFlagsS6.map(f => ({ id: f.id, label: f.label }))}
                    selected={form.selected_red_flags_s6}
                    onToggle={id => togglePill('selected_red_flags_s6', id as number)}
                  />
                </div>
              )}
            </SubBlock>
          </FieldGroup>
        </SectionCard>
        </div>

        {/* ── Section 7: Your Review ──────────────────────────────────────────── */}
        <SectionCard
          title="Your Review"
          open={openSections.s7}
          onToggle={() => toggleSection('s7')}
        >
          <FieldGroup>
            <div>
              <FieldLabel>Review Title (optional)</FieldLabel>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Summarize your experience…"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <FieldLabel>Review (optional)</FieldLabel>
              <textarea
                value={form.body}
                onChange={e => set('body', e.target.value)}
                placeholder="Describe your experience in detail…"
                rows={5}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <FieldLabel>One thing to watch out for (optional)</FieldLabel>
              <input
                type="text"
                value={form.watch_out_for}
                onChange={e => {
                  if (e.target.value.length <= 150) set('watch_out_for', e.target.value)
                }}
                placeholder="Max 150 characters"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.watch_out_for.length}/150</p>
            </div>

            <div>
              <FieldLabel>What worked well (optional)</FieldLabel>
              <input
                type="text"
                value={form.what_worked_well}
                onChange={e => {
                  if (e.target.value.length <= 150) set('what_worked_well', e.target.value)
                }}
                placeholder="Max 150 characters"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.what_worked_well.length}/150</p>
            </div>
          </FieldGroup>
        </SectionCard>

      </div>

      {/* ── Sticky bottom bar: validation errors + action buttons ─────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-2xl mx-auto">
        {validationErrors.length > 0 && !errorBarDismissed && (
          <div
            className="bg-red-50 border-t border-l border-r border-red-200 px-4 py-3 flex items-start gap-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-1">
              {validationErrors.map((e, i) => (
                <p key={i} className="text-sm text-red-700">{e}</p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setErrorBarDismissed(true)}
              className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors mt-0.5"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="bg-white border-t border-gray-200 px-4 py-4 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || submitting}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || submitting}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
