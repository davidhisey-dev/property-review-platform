'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import DashNav, { NAV_H } from '@/components/DashNav'

type BusinessType = {
  id: number
  label: string
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
]

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])

  const [form, setForm] = useState({
    display_name: '',
    company_name: '',
    business_type_id: '',
    license_number: '',
    license_state: '',
    license_classification: '',
    insurance_provider: '',
    insurance_policy: '',
    insurance_expiry: '',
    language_preference: '',
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Load existing profile (for reapply pre-fill)
      const [{ data: profile }, { data: btData }] = await Promise.all([
        supabase
          .from('users')
          .select('registration_status, display_name, company_name, business_type_id, license_number, license_state, license_classification, insurance_provider, insurance_policy, insurance_expiry, language_preference')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('business_types')
          .select('id, label')
          .eq('is_active', true)
          .order('label', { ascending: true }),
      ])

      if (btData) setBusinessTypes(btData)

      if (profile) {
        // Already approved → go to dashboard
        if (profile.registration_status === 'approved') {
          router.push('/dashboard')
          return
        }
        // Already pending → go to pending page
        if (profile.registration_status === 'pending') {
          router.push('/register/pending')
          return
        }
        // Rejected — pre-fill form so they can reapply
        setForm({
          display_name: profile.display_name ?? '',
          company_name: profile.company_name ?? '',
          business_type_id: profile.business_type_id ? String(profile.business_type_id) : '',
          license_number: profile.license_number ?? '',
          license_state: profile.license_state ?? '',
          license_classification: profile.license_classification ?? '',
          insurance_provider: profile.insurance_provider ?? '',
          insurance_policy: profile.insurance_policy ?? '',
          insurance_expiry: profile.insurance_expiry ?? '',
          language_preference: profile.language_preference ?? '',
        })
      }

      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    if (
      !form.display_name ||
      !form.company_name ||
      !form.business_type_id ||
      !form.license_number ||
      !form.license_state ||
      !form.insurance_provider ||
      !form.insurance_policy ||
      !form.insurance_expiry
    ) {
      setError('Please fill in all required fields.')
      setSubmitting(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be signed in to register.')
      setSubmitting(false)
      return
    }

    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        display_name: form.display_name,
        company_name: form.company_name,
        business_type_id: parseInt(form.business_type_id),
        license_number: form.license_number,
        license_state: form.license_state,
        license_classification: form.license_classification || null,
        license_status: 'pending',
        insurance_provider: form.insurance_provider,
        insurance_policy: form.insurance_policy,
        insurance_expiry: form.insurance_expiry,
        language_preference: form.language_preference || null,
        registration_status: 'pending',
        is_active: false,
        is_admin: false,
      })

    if (upsertError) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    await fetch('/api/email/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, name: form.display_name }),
    })

    router.push('/register/pending')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50" style={{ paddingTop: NAV_H }}>
      <DashNav isAdmin={false} displayName="" hideNav />

      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="card">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Contractor Registration</h1>
          <p className="text-neutral-500 mb-8 text-sm">
            Complete your profile to apply for platform access. All fields marked * are required.
          </p>

          {error && (
            <div className="alert-error mb-6">{error}</div>
          )}

          <div className="form-group">
            <label>Full Name *</label>
            <input
              name="display_name"
              value={form.display_name}
              onChange={handleChange}
              placeholder="Your full name"
            />
          </div>

          <div className="form-group">
            <label>Company Name *</label>
            <input
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              placeholder="Your company name"
            />
          </div>

          <div className="form-group">
            <label>Business Type *</label>
            <select
              name="business_type_id"
              value={form.business_type_id}
              onChange={handleChange}
            >
              <option value="">Select a business type</option>
              {businessTypes.map((bt) => (
                <option key={bt.id} value={bt.id}>{bt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>License Number *</label>
            <input
              name="license_number"
              value={form.license_number}
              onChange={handleChange}
              placeholder="Your contractor license number"
            />
          </div>

          <div className="form-group">
            <label>License State *</label>
            <select
              name="license_state"
              value={form.license_state}
              onChange={handleChange}
            >
              <option value="">Select a state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>License Classification</label>
            <input
              name="license_classification"
              value={form.license_classification}
              onChange={handleChange}
              placeholder="e.g. General Building, Electrical, Plumbing"
            />
          </div>

          <div className="form-group">
            <label>Insurance Provider *</label>
            <input
              name="insurance_provider"
              value={form.insurance_provider}
              onChange={handleChange}
              placeholder="Name of your insurance provider"
            />
          </div>

          <div className="form-group">
            <label>Insurance Policy Number *</label>
            <input
              name="insurance_policy"
              value={form.insurance_policy}
              onChange={handleChange}
              placeholder="Your policy number"
            />
          </div>

          <div className="form-group">
            <label>Insurance Expiry Date *</label>
            <input
              name="insurance_expiry"
              type="date"
              value={form.insurance_expiry}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Language Preference</label>
            <select
              name="language_preference"
              value={form.language_preference}
              onChange={handleChange}
            >
              <option value="">Select a language (optional)</option>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary w-full mt-4"
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  )
}
