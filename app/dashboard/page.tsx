'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import PropertyMap from '@/components/PropertyMap'
import NavBar from '@/components/NavBar'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/register'); return }
      if (!profile.is_active) { router.push('/pending'); return }
    }
    check()
  }, [router, supabase])

  type MapProperty = {
  id?: string
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
  owner_name: string | null
  latitude: number | null
  longitude: number | null
}

const handlePropertySelect = useCallback(async (property: MapProperty) => {
    if (property.id) {
      sessionStorage.setItem('dashboardUrl', window.location.href)
      router.push(`/property/${property.id}`)
    }
  }, [router])

  const handleSearchChange = useCallback((
    query: string,
    lat: number,
    lng: number,
    zoom: number
  ) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (lat) params.set('lat', lat.toString())
    if (lng) params.set('lng', lng.toString())
    if (zoom) params.set('zoom', zoom.toString())
    router.replace(`/dashboard?${params.toString()}`, { scroll: false })
  }, [router])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <div style={{ flex: 1 }}>
        <PropertyMap
          height="100%"
          initialQuery={searchParams.get('q') || ''}
          initialLat={searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined}
          initialLng={searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined}
          initialZoom={searchParams.get('zoom') ? parseFloat(searchParams.get('zoom')!) : undefined}
          onPropertySelect={handlePropertySelect}
          onSearchChange={handleSearchChange}
        />
      </div>
    </div>
  )
}