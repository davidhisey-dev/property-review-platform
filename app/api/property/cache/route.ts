import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type PropertyInput = {
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
  owner_name: string | null
  owner_mailing_address: string | null
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
  new_construction: boolean
  tax_account_number: string | null
  plat_name: string | null
  plat_lot: string | null
  plat_block: string | null
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify contractor is active and verified
    const { data: profile } = await supabase
      .from('users')
      .select('is_active, license_status')
      .eq('id', user.id)
      .single()

    if (!profile?.is_active || profile?.license_status !== 'verified') {
      return NextResponse.json(
        { error: 'Account not active' },
        { status: 403 }
      )
    }

    const property: PropertyInput = await request.json()

    if (!property.parcel_number) {
      return NextResponse.json(
        { error: 'Parcel number required' },
        { status: 400 }
      )
    }

    // Check if property already exists
    const { data: existing } = await supabase
      .from('properties')
      .select('id, parcel_number, kc_data_last_synced')
      .eq('parcel_number', property.parcel_number)
      .single()

    if (existing) {
      const lastSynced = existing.kc_data_last_synced
        ? new Date(existing.kc_data_last_synced)
        : null
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      if (lastSynced && lastSynced > sixMonthsAgo) {
        // Data is fresh — return existing record
        return NextResponse.json({ id: existing.id, cached: true })
      }

      // Data is stale — update it
      const { data: updated, error: updateError } = await supabase
        .from('properties')
        .update({
          address_full:                property.address_full,
          city:                        property.city,
          state:                       property.state,
          zip_code:                    property.zip_code,
          property_type:               property.property_type,
          acreage:                     property.acreage,
          square_feet_lot:             property.square_feet_lot,
          appraised_land_value:        property.appraised_land_value,
          appraised_improvement_value: property.appraised_improvement_value,
          appraised_total_value:       property.appraised_total_value,
          tax_year:                    property.tax_year,
          last_sale_price:             property.last_sale_price,
          last_sale_date:              property.last_sale_date,
          last_sale_seller:            property.last_sale_seller,
          last_sale_buyer:             property.last_sale_buyer,
          is_unincorporated:           property.is_unincorporated,
          latitude:                    property.latitude,
          longitude:                   property.longitude,
          legal_desc:                  property.legal_desc,
          zoning:                      property.zoning,
          levy_code:                   property.levy_code,
          levy_jurisdiction:           property.levy_jurisdiction,
          taxable_land_value:          property.taxable_land_value,
          taxable_improvement_value:   property.taxable_improvement_value,
          tax_val_reason:              property.tax_val_reason,
          new_construction:            property.new_construction,
          tax_account_number:          property.tax_account_number,
          plat_name:                   property.plat_name,
          plat_lot:                    property.plat_lot,
          plat_block:                  property.plat_block,
          kc_data_last_synced:         new Date().toISOString(),
          updated_at:                  new Date().toISOString(),
        })
        .eq('parcel_number', property.parcel_number)
        .select('id')
        .single()

      if (updateError) {
        console.error('Property update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update property' },
          { status: 500 }
        )
      }

      return NextResponse.json({ id: updated.id, cached: false, updated: true })
    }

    // Property doesn't exist — insert it
    const { data: inserted, error: insertError } = await supabase
      .from('properties')
      .insert({
        parcel_number:               property.parcel_number,
        address_full:                property.address_full,
        city:                        property.city,
        state:                       property.state,
        zip_code:                    property.zip_code,
        property_type:               property.property_type,
        acreage:                     property.acreage,
        square_feet_lot:             property.square_feet_lot,
        appraised_land_value:        property.appraised_land_value,
        appraised_improvement_value: property.appraised_improvement_value,
        appraised_total_value:       property.appraised_total_value,
        tax_year:                    property.tax_year,
        last_sale_price:             property.last_sale_price,
        last_sale_date:              property.last_sale_date,
        last_sale_seller:            property.last_sale_seller,
        last_sale_buyer:             property.last_sale_buyer,
        owner_name:                  property.owner_name,
        owner_mailing_address:       property.owner_mailing_address,
        is_unincorporated:           property.is_unincorporated,
        latitude:                    property.latitude,
        longitude:                   property.longitude,
        legal_desc:                  property.legal_desc,
        zoning:                      property.zoning,
        levy_code:                   property.levy_code,
        levy_jurisdiction:           property.levy_jurisdiction,
        taxable_land_value:          property.taxable_land_value,
        taxable_improvement_value:   property.taxable_improvement_value,
        tax_val_reason:              property.tax_val_reason,
        new_construction:            property.new_construction,
        tax_account_number:          property.tax_account_number,
        plat_name:                   property.plat_name,
        plat_lot:                    property.plat_lot,
        plat_block:                  property.plat_block,
        kc_data_last_synced:         new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Property insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to cache property' },
        { status: 500 }
      )
    }

    return NextResponse.json({ id: inserted.id, cached: false })

  } catch (error) {
    console.error('Cache error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}