import { NextResponse } from 'next/server'

const KC_PARCEL_ADDRESS_URL = 'https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/property__parcel_address_area/MapServer/1722/query'

type KCFeature = {
  attributes: Record<string, string | number | null>
}

function mapFeature(a: Record<string, string | number | null>) {
  return {
    parcel_number:               a.PIN || '',
    address_full:                a.ADDR_FULL || '',
    city:                        a.CTYNAME || '',
    state:                       'WA',
    zip_code:                    a.ZIP5 || '',
    property_type:               a.PROPTYPE || '',
    present_use: (a.PREUSE_DESC as string)?.trim() || '',
    acreage:                     a.KCA_ACRES || null,
    square_feet_lot:             a.LOTSQFT || null,
    appraised_land_value:        a.APPRLNDVAL || null,
    appraised_improvement_value: a.APPR_IMPR || null,
    appraised_total_value:       (Number(a.APPRLNDVAL) || 0) + (Number(a.APPR_IMPR) || 0),
    tax_year:                    a.KCTP_TAXYR || null,
    owner_name:                  a.KCTP_NAME || null,
    owner_mailing_address:       a.KCTP_ADDR || null,
    latitude:                    a.LAT || null,
    longitude:                   a.LON || null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const pin = searchParams.get('pin')

  if (!address && !pin) {
    return NextResponse.json(
      { error: 'Address or PIN required' },
      { status: 400 }
    )
  }

  try {
    let whereClause = ''

    if (pin) {
      whereClause = `PIN = '${pin}'`
    } else {
      const cleanAddress = address!
        .toUpperCase()
        .replace(/,.*$/, '')
        .trim()
      whereClause = `ADDR_FULL LIKE '%${cleanAddress}%'`
    }

    // Build query string manually to control % encoding in LIKE clause
    const outFields = 'PIN,ADDR_FULL,CTYNAME,ZIP5,LAT,LON,APPRLNDVAL,APPR_IMPR,KCA_ACRES,LOTSQFT,PROPTYPE,PREUSE_DESC,KCTP_TAXYR'
    const queryString = [
      `where=${encodeURIComponent(whereClause)}`,
      `outFields=${outFields}`,
      `returnGeometry=false`,
      `resultRecordCount=10`,
      `f=json`,
    ].join('&')

    const res = await fetch(`${KC_PARCEL_ADDRESS_URL}?${queryString}`)
    const data = await res.json()

    console.log('KC Response:', JSON.stringify(data, null, 2))

    if (data.error) {
      console.error('KC API Error:', data.error)
      return NextResponse.json(
        { error: 'King County API error', details: data.error },
        { status: 500 }
      )
    }

    if (!data.features || data.features.length === 0) {
      return NextResponse.json(
        { error: 'No parcel found' },
        { status: 404 }
      )
    }

    if (data.features.length === 1) {
      const property = mapFeature(data.features[0].attributes)
      return NextResponse.json({ property })
    }

    const properties = data.features.map((f: KCFeature) => mapFeature(f.attributes))
    return NextResponse.json({ properties })

  } catch (error) {
    console.error('King County API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch property data' },
      { status: 500 }
    )
  }
}