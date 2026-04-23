'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import DashNav, { NAV_H } from '@/components/DashNav'

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
}

type Review = {
  id: string
  user_id: string
  overall_rating: number
  ease_of_interaction: number
  payment_timeliness: number
  paid_on_time: boolean
  no_call_no_show: boolean
  change_order_count: number
  job_size: string
  job_value: number | null
  job_description: string | null
  job_completed_at: string | null
  title: string | null
  body: string | null
  created_at: string
  updated_at: string
  users: {
    display_name: string
    company_name: string
  }
  review_payment_tactics: {
    payment_tactics: { label: string }
  }[]
  review_red_flags: {
    red_flags: { label: string }
  }[]
}

const INTERACTION_LABELS: Record<number, string> = {
  1: 'Extremely Difficult',
  2: 'Difficult',
  3: 'Neutral',
  4: 'Easy',
  5: 'Very Easy',
}

const PAYMENT_LABELS: Record<number, string> = {
  1: 'Very Poor',
  2: 'Poor',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
}

function StarRating({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            color: star <= value ? '#f59e0b' : '#d1d5db',
            fontSize: '1.1rem',
          }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

function formatCurrency(val: number | null) {
  if (!val) return 'N/A'
  return `$${val.toLocaleString()}`
}

function formatDate(val: string | null) {
  if (!val) return 'N/A'
  return new Date(val).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PropertyDetailPage() {
  const { profile: navProfile } = useProfile()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  type UserHistoryItem = { id: string; status: string; updated_at: string }

  const [property, setProperty] = useState<Property | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [userHistory, setUserHistory] = useState<UserHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

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

      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (propertyError || !propertyData) {
        router.push('/dashboard')
        return
      }

      console.log('[Property page] id from URL:', id, '| parcel_number:', propertyData.parcel_number)
      setProperty(propertyData)

      // DIAGNOSTIC — temporary await to surface errors
      const { data: rvData, error: rvError } = await supabase
        .from('recently_viewed')
        .upsert(
          { user_id: user.id, property_id: id, last_viewed_at: new Date().toISOString() },
          { onConflict: 'user_id,property_id' }
        )
      console.log('[recently_viewed upsert] user_id:', user.id, 'property_id:', id, 'data:', rvData, 'error:', rvError)

      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .select(`
          id, user_id, property_id, status, overall_rating, ease_of_interaction, payment_timeliness,
          paid_on_time, no_call_no_show, change_order_count,
          job_size, job_value, job_description, job_completed_at,
          title, body, created_at, updated_at,
          users!reviews_user_id_fkey ( display_name, company_name ),
          review_payment_tactics ( payment_tactics ( label ) ),
          review_red_flags ( red_flags ( label ) )
        `)
        .eq('property_id', id)
        .eq('status', 'submitted')
        .order('updated_at', { ascending: false })

      if (reviewData) {
        setReviews(reviewData as unknown as Review[])
      }

      // Separate lightweight query for this contractor's own history
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
  }, [id, router, supabase])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: NAV_H }}>
        <DashNav isAdmin={navProfile?.is_admin ?? false} displayName={navProfile?.display_name ?? ''} />
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Loading property...
        </div>
      </div>
    )
  }

  if (!property) return null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', paddingTop: NAV_H }}>
      <DashNav isAdmin={navProfile?.is_admin ?? false} displayName={navProfile?.display_name ?? ''} />


      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem' }}>

{/* Back button */}
        <button
          onClick={() => {
            const dashboardUrl = sessionStorage.getItem('dashboardUrl')
            if (dashboardUrl) {
              router.push(dashboardUrl)
            } else {
              router.push('/dashboard')
            }
          }}
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
          ← Back to Map
        </button>

        {/* Property Header */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <h1 style={{
            margin: '0 0 0.25rem',
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#111827',
          }}>
            {property.address_full}
          </h1>
          <p style={{ margin: '0 0 1.5rem', color: '#6b7280', fontSize: '0.95rem' }}>
            {property.city}, {property.state} {property.zip_code}
            {property.is_unincorporated && (
              <span style={{
                marginLeft: '0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                padding: '0.1rem 0.5rem',
                borderRadius: '9999px',
              }}>
                Unincorporated
              </span>
            )}
          </p>

          {/* Property Details Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}>
            {[
              { label: 'Present Use', value: property.present_use || 'N/A' },
              { label: 'Property Type', value: property.property_type || 'N/A' },
              { label: 'Lot Size', value: property.square_feet_lot ? `${property.square_feet_lot.toLocaleString()} sq ft` : 'N/A' },
              { label: 'Acreage', value: property.acreage ? `${property.acreage.toFixed(3)} acres` : 'N/A' },
              { label: 'Assessed Value', value: formatCurrency(property.appraised_total_value) },
              { label: 'Land Value', value: formatCurrency(property.appraised_land_value) },
              { label: 'Improvement Value', value: formatCurrency(property.appraised_improvement_value) },
              { label: 'Tax Year', value: property.tax_year?.toString() || 'N/A' },
              { label: 'Last Sale Price', value: formatCurrency(property.last_sale_price) },
              { label: 'Last Sale Date', value: formatDate(property.last_sale_date) },
              { label: 'Parcel Number', value: property.parcel_number },
            ].map((item) => (
              <div key={item.label}>
                <p style={{
                  margin: '0 0 0.2rem',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {item.label}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: '#111827',
                  fontWeight: '500',
                }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Contractor History Banner */}
        {(() => {
          const submittedHistory = userHistory.filter(r => r.status === 'submitted')
          const draft = userHistory.find(r => r.status === 'draft')
          if (submittedHistory.length === 0 && !draft) return null
          return (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '1.25rem 1.5rem',
              marginBottom: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <p style={{
                margin: '0 0 1rem',
                fontSize: '0.75rem',
                fontWeight: '700',
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Your History
              </p>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', color: '#374151', lineHeight: '1.6' }}>
                My Reviews for this property:{' '}
                <span style={{ fontWeight: '500' }}>{submittedHistory.length}</span>
              </p>
              {submittedHistory.length > 0 && (
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', color: '#374151', lineHeight: '1.6' }}>
                  Last Review:{' '}
                  <span style={{ fontWeight: '500' }}>{formatDate(submittedHistory[0].updated_at)}</span>
                </p>
              )}
              {draft && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#92400e', lineHeight: '1.6' }}>
                  ⚠️ You have a draft in progress —{' '}
                  <button
                    onClick={() => router.push(`/property/${id}/review?draftId=${draft.id}`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#d97706',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      textDecoration: 'underline',
                    }}
                  >
                    Resume draft
                  </button>
                </p>
              )}
            </div>
          )
        })()}

        {/* Reviews Section Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
            Contractor Reviews
            {reviews.length > 0 && (
              <span style={{
                marginLeft: '0.5rem',
                fontSize: '0.875rem',
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                padding: '0.1rem 0.6rem',
                borderRadius: '9999px',
                fontWeight: '500',
              }}>
                {reviews.length}
              </span>
            )}
          </h2>

          <button
            onClick={() => router.push(`/property/${id}/review`)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              minHeight: '44px',
            }}
          >
            + Leave a Review
          </button>
        </div>

        {/* No Reviews State */}
        {reviews.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            padding: '2rem',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
              No reviews yet for this property.
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              Be the first contractor to leave a review.
            </p>
          </div>
        )}

        {/* Review Cards */}
        {reviews.map((review) => (
          <div
            key={review.id}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '1.5rem',
              marginBottom: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {/* Review Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1rem',
            }}>
              <div>
                <p style={{ margin: '0 0 0.1rem', fontWeight: '600', fontSize: '0.95rem' }}>
                  {review.users?.display_name}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
                  {review.users?.company_name}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StarRating value={review.overall_rating} />
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Submitted {formatDate(review.updated_at)}
                </p>
              </div>
            </div>

            {/* Review Title and Body */}
            {review.title && (
              <p style={{ margin: '0 0 0.5rem', fontWeight: '600', fontSize: '0.95rem' }}>
                {review.title}
              </p>
            )}
            {review.body && (
              <p style={{ margin: '0 0 1rem', color: '#374151', lineHeight: '1.6', fontSize: '0.9rem' }}>
                {review.body}
              </p>
            )}

            {/* Ratings Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '0.75rem',
            }}>
              <div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Ease of Interaction
                </p>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500' }}>
                  {INTERACTION_LABELS[review.ease_of_interaction] || 'N/A'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Payment Timeliness
                </p>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500' }}>
                  {PAYMENT_LABELS[review.payment_timeliness] || 'N/A'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Paid on Time
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: review.paid_on_time ? '#16a34a' : '#dc2626',
                }}>
                  {review.paid_on_time ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Job Size
                </p>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500' }}>
                  {review.job_size || 'N/A'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Change Orders
                </p>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500' }}>
                  {review.change_order_count}
                </p>
              </div>
              {review.no_call_no_show && (
                <div>
                  <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                    No Call No Show
                  </p>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: '#dc2626' }}>
                    Yes
                  </p>
                </div>
              )}
            </div>

            {/* Payment Tactics */}
            {review.review_payment_tactics?.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                  PAYMENT TACTICS USED
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {review.review_payment_tactics.map((pt, i) => (
                    <span key={i} style={{
                      backgroundColor: '#fef2f2',
                      color: '#b91c1c',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                    }}>
                      {pt.payment_tactics?.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Red Flags */}
            {review.review_red_flags?.length > 0 && (
              <div>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                  RED FLAGS
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {review.review_red_flags.map((rf, i) => (
                    <span key={i} style={{
                      backgroundColor: '#fff7ed',
                      color: '#c2410c',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                    }}>
                      {rf.red_flags?.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}