'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppHeader, { NAV_H } from '@/components/AppHeader'
import { useProfile } from '@/lib/useProfile'

type BusinessType = {
  id: number
  label: string
}

type Profile = {
  id: string
  display_name: string
  email: string
  company_name: string
  business_type_id: number | null
  license_number: string
  license_status: string
  license_verified_at: string | null
  insurance_provider: string
  insurance_policy: string
  insurance_expiry: string
  language_preference: string
  is_active: boolean
  created_at: string
}

type FormState = {
  display_name: string
  company_name: string
  business_type_id: string
  license_number: string
  insurance_provider: string
  insurance_policy: string
  insurance_expiry: string
  language_preference: string
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      padding: '1.5rem',
      marginBottom: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <h2 style={{
        margin: '0 0 1.25rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#111827',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #f3f4f6',
      }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function FieldGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#374151',
        marginBottom: '0.4rem',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <div style={{
      padding: '0.5rem 0.75rem',
      backgroundColor: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '0.95rem',
      color: '#6b7280',
    }}>
      {value}
    </div>
  )
}

function getLicenseStatusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pending Review', color: '#d97706' },
    verified: { label: 'Verified',       color: '#16a34a' },
    rejected: { label: 'Rejected',       color: '#dc2626' },
  }
  return map[status] || { label: status, color: '#6b7280' }
}

function formatDate(val: string | null) {
  if (!val) return 'Not verified'
  return new Date(val).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function AccountPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile: navProfile } = useProfile()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')
  const originalLicenseRef = useRef('')

  const [form, setForm] = useState<FormState>({
    display_name: '',
    company_name: '',
    business_type_id: '',
    license_number: '',
    insurance_provider: '',
    insurance_policy: '',
    insurance_expiry: '',
    language_preference: 'en',
  })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profileData) { router.push('/register'); return }
      if (!profileData.is_active) { router.push('/pending'); return }

      setProfile(profileData)
      originalLicenseRef.current = profileData.license_number || ''

      setForm({
        display_name:        profileData.display_name || '',
        company_name:        profileData.company_name || '',
        business_type_id:    profileData.business_type_id?.toString() || '',
        license_number:      profileData.license_number || '',
        insurance_provider:  profileData.insurance_provider || '',
        insurance_policy:    profileData.insurance_policy || '',
        insurance_expiry:    profileData.insurance_expiry
                               ? profileData.insurance_expiry.split('T')[0]
                               : '',
        language_preference: profileData.language_preference || 'en',
      })

      const { data: btData } = await supabase
        .from('business_types')
        .select('id, label')
        .eq('is_active', true)
        .order('sort_order')

      if (btData) setBusinessTypes(btData)
      setLoading(false)
    }

    load()
  }, [router, supabase])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSave = async () => {
    setError('')
    setSaveSuccess(false)

    if (!form.display_name.trim()) {
      setError('Full name is required.')
      return
    }
    if (!form.company_name.trim()) {
      setError('Company name is required.')
      return
    }
    if (!form.license_number.trim()) {
      setError('License number is required.')
      return
    }
    if (!form.insurance_provider.trim()) {
      setError('Insurance provider is required.')
      return
    }
    if (!form.insurance_expiry) {
      setError('Insurance expiry date is required.')
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const licenseChanged = form.license_number.trim() !== originalLicenseRef.current

    const { error: updateError } = await supabase
      .from('users')
      .update({
        display_name:        form.display_name.trim(),
        company_name:        form.company_name.trim(),
        business_type_id:    form.business_type_id
                               ? parseInt(form.business_type_id)
                               : null,
        license_number:      form.license_number.trim(),
        insurance_provider:  form.insurance_provider.trim(),
        insurance_policy:    form.insurance_policy.trim() || null,
        insurance_expiry:    form.insurance_expiry,
        language_preference: form.language_preference,
        updated_at:          new Date().toISOString(),
        ...(licenseChanged && {
          license_status:      'pending',
          license_verified_at: null,
        }),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error(updateError)
      setError('Failed to save changes. Please try again.')
      setSaving(false)
      return
    }

    // Update ref to new license number after successful save
    if (licenseChanged) {
      originalLicenseRef.current = form.license_number.trim()
    }

    // Update local profile state
    if (profile) {
      setProfile({
        ...profile,
        ...form,
        business_type_id: form.business_type_id
          ? parseInt(form.business_type_id)
          : null,
        ...(licenseChanged && {
          license_status:      'pending',
          license_verified_at: null,
        }),
      })
    }

    setSaveSuccess(true)
    setSaving(false)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', paddingTop: NAV_H }}>
        <AppHeader isAdmin={navProfile?.is_admin || false} displayName={navProfile?.display_name || ''} />
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Loading...
        </div>
      </div>
    )
  }

  if (!profile) return null

  const licenseStatus = getLicenseStatusLabel(profile.license_status)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', paddingTop: NAV_H }}>
      <AppHeader isAdmin={navProfile?.is_admin || false} displayName={navProfile?.display_name || ''} />

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem 1rem' }}>

        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: '700' }}>
          My Account
        </h1>

        {/* Account Status */}
        <SectionCard title="Account Status">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>
                {profile.email}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Account Status
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#16a34a', fontWeight: '500' }}>
                Active
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                License Status
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500', color: licenseStatus.color }}>
                {licenseStatus.label}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                License Verified
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>
                {formatDate(profile.license_verified_at)}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Member Since
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>
                {formatDate(profile.created_at)}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Personal Info */}
        <SectionCard title="Personal Information">
          <FieldGroup label="Full Name">
            <input
              type="text"
              name="display_name"
              value={form.display_name}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </FieldGroup>

          <FieldGroup label="Email">
            <ReadOnlyField value={profile.email} />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
              Email is managed through your Google account and cannot be changed here.
            </p>
          </FieldGroup>

          <FieldGroup label="Preferred Language">
            <select
              name="language_preference"
              value={form.language_preference}
              onChange={handleChange}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                backgroundColor: 'white',
              }}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </FieldGroup>
        </SectionCard>

        {/* Business Info */}
        <SectionCard title="Business Information">
          <FieldGroup label="Company Name">
            <input
              type="text"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </FieldGroup>

          <FieldGroup label="Business Type">
            <select
              name="business_type_id"
              value={form.business_type_id}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                backgroundColor: 'white',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Select a business type</option>
              {businessTypes.map((bt) => (
                <option key={bt.id} value={bt.id}>
                  {bt.label}
                </option>
              ))}
            </select>
          </FieldGroup>
        </SectionCard>

        {/* License Info */}
        <SectionCard title="License Information">
          <FieldGroup label="State License Number">
            <input
              type="text"
              name="license_number"
              value={form.license_number}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </FieldGroup>
          <p style={{ margin: '-0.5rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            If you update your license number your verification status will be reset for admin review.
          </p>
        </SectionCard>

        {/* Insurance Info */}
        <SectionCard title="Insurance Information">
          <FieldGroup label="Insurance Provider">
            <input
              type="text"
              name="insurance_provider"
              value={form.insurance_provider}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </FieldGroup>

          <FieldGroup label="Policy Number (optional)">
            <input
              type="text"
              name="insurance_policy"
              value={form.insurance_policy}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </FieldGroup>

          <FieldGroup label="Insurance Expiry Date">
            <input
              type="date"
              name="insurance_expiry"
              value={form.insurance_expiry}
              onChange={handleChange}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </FieldGroup>
        </SectionCard>

        {/* Error and Success */}
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

        {saveSuccess && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            ✓ Changes saved successfully.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: saving ? '#93c5fd' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            minHeight: '44px',
            marginBottom: '2rem',
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

      </div>
    </div>
  )
}