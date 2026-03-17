'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type BusinessType = {
  id: number
  label: string
}

type Language = {
  id: number
  code: string
  label: string
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
  const [languages, setLanguages] = useState<Language[]>([])

  const [form, setForm] = useState({
    display_name: '',
    company_name: '',
    business_type_id: '',
    license_number: '',
    insurance_provider: '',
    insurance_policy: '',
    insurance_expiry: '',
    language_preference: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: btData }, { data: langData }] = await Promise.all([
        supabase
          .from('business_types')
          .select('id, label')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('languages')
          .select('id, code, label')
          .eq('is_active', true)
          .order('sort_order'),
      ])
      if (btData) setBusinessTypes(btData)
      if (langData) setLanguages(langData)
    }
    fetchData()
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    if (
      !form.display_name ||
      !form.company_name ||
      !form.business_type_id ||
      !form.license_number ||
      !form.insurance_provider ||
      !form.insurance_policy ||
      !form.insurance_expiry ||
      !form.language_preference
    ) {
      setError('Please fill in all required fields.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in to register.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        display_name: form.display_name,
        company_name: form.company_name,
        business_type_id: parseInt(form.business_type_id),
        license_number: form.license_number,
        license_status: 'pending',
        insurance_provider: form.insurance_provider,
        insurance_policy: form.insurance_policy,
        insurance_expiry: form.insurance_expiry,
        language_preference: form.language_preference,
        is_active: false,
        is_admin: false,
      })

    if (insertError) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    await fetch('/api/email/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        name: form.display_name,
      }),
    })

    router.push('/pending')
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="card">
          <h1>Contractor Registration</h1>
          <p className="text-neutral-500 mb-8">
            Please complete your profile to apply for access to the platform.
            All fields are required.
          </p>

          {error && (
            <div className="alert-error mb-6">{error}</div>
          )}

          <div className="form-group">
            <label>Full Name</label>
            <input
              name="display_name"
              value={form.display_name}
              onChange={handleChange}
              placeholder="Your full name"
            />
          </div>

          <div className="form-group">
            <label>Company Name</label>
            <input
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              placeholder="Your company name"
            />
          </div>

          <div className="form-group">
            <label>Business Type</label>
            <select
              name="business_type_id"
              value={form.business_type_id}
              onChange={handleChange}
            >
              <option value="">Select a business type</option>
              {businessTypes.map((bt) => (
                <option key={bt.id} value={bt.id}>
                  {bt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>State License Number</label>
            <input
              name="license_number"
              value={form.license_number}
              onChange={handleChange}
              placeholder="Your WA state license number"
            />
          </div>

          <div className="form-group">
            <label>Insurance Provider</label>
            <input
              name="insurance_provider"
              value={form.insurance_provider}
              onChange={handleChange}
              placeholder="Name of your insurance provider"
            />
          </div>

          <div className="form-group">
            <label>Insurance Policy Number</label>
            <input
              name="insurance_policy"
              value={form.insurance_policy}
              onChange={handleChange}
              placeholder="Your policy number"
            />
          </div>

          <div className="form-group">
            <label>Insurance Expiry Date</label>
            <input
              name="insurance_expiry"
              type="date"
              value={form.insurance_expiry}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Preferred Language</label>
            <select
              name="language_preference"
              value={form.language_preference}
              onChange={handleChange}
            >
              <option value="">Select a language</option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary w-full mt-4"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  )
}