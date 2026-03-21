import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { parcel_numbers } = await request.json()

    if (!parcel_numbers || !Array.isArray(parcel_numbers)) {
      return NextResponse.json({ error: 'parcel_numbers array required' }, { status: 400 })
    }

    // Get property IDs for these parcel numbers
    const { data: properties } = await supabase
      .from('properties')
      .select('id, parcel_number')
      .in('parcel_number', parcel_numbers)


    if (!properties || properties.length === 0) {
      return NextResponse.json({ counts: {} })
    }

    // Get review counts for these properties
    const propertyIds = (properties ?? []).map((p) => p.id)

    const { data: reviews } = await supabase
      .from('reviews')
      .select('property_id')
      .in('property_id', propertyIds)
      .eq('is_published', true)
      .eq('is_removed', false)
      .eq('status', 'published')



    // Build a map of parcel_number -> count
    const propertyIdToParcel: Record<string, string> = {}
    properties.forEach((p) => {
      propertyIdToParcel[p.id] = p.parcel_number
    })

    const counts: Record<string, number> = {}
    reviews?.forEach((r) => {
      const parcel = propertyIdToParcel[r.property_id]
      if (parcel) {
        counts[parcel] = (counts[parcel] || 0) + 1
      }
    })

    return NextResponse.json({ counts })

  } catch (error) {
    console.error('Review counts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}