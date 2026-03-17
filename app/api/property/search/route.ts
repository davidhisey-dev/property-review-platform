import { NextResponse } from 'next/server'

const KC_PARCEL_ADDRESS_URL = 'https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/property__parcel_address_area/MapServer/1722/query'
const KC_SALES_URL = 'https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/3/query'

type KCFeature = {
  attributes: Record<string, string | number | null>
}

function mapFeature(
  a: Record<string, string | number | null>,
  sale?: Record<string, string | number | null> | null
) {
  return {
    parcel_number:               a.PIN || '',
    address_full:                a.ADDR_FULL || '',
    city: (a.CTYNAME as string) || (a.POSTALCTYNAME as string) || '',
      is_unincorporated: !a.CTYNAME && !!a.POSTALCTYNAME,
    state:                       'WA',
    zip_code:                    a.ZIP5 || '',
    property_type:               a.PROPTYPE || '',
    present_use:                 (a.PREUSE_DESC as string)?.trim() || '',
    acreage:                     a.KCA_ACRES || null,
    square_feet_lot:             a.LOTSQFT || null,
    appraised_land_value:        a.APPRLNDVAL || null,
    appraised_improvement_value: a.APPR_IMPR || null,
    appraised_total_value:       (Number(a.APPRLNDVAL) || 0) + (Number(a.APPR_IMPR) || 0),
    tax_year:                    a.KCTP_TAXYR || null,
    owner_name:                  null,
    owner_mailing_address:       null,
    // Sales data
    last_sale_price:             sale?.SalePrice || null,
    last_sale_date:              sale?.SaleDate
                                   ? new Date(Number(sale.SaleDate)).toISOString().split('T')[0]
                                   : null,
    last_sale_seller:            sale?.Sellername || null,
    last_sale_buyer:             sale?.buyername || null,
    latitude:                    a.LAT || null,
    longitude:                   a.LON || null,
  }
}

async function fetchSalesData(pin: string) {
  try {
    const whereClause = `PIN = '${pin}'`
    const queryString = [
      `where=${encodeURIComponent(whereClause)}`,
      `outFields=PIN,SaleDate,SalePrice,Sellername,buyername`,
      `returnGeometry=false`,
      `orderByFields=SaleDate DESC`,
      `resultRecordCount=1`,
      `f=json`,
    ].join('&')

    const res = await fetch(`${KC_SALES_URL}?${queryString}`)
    const data = await res.json()

    if (data.features && data.features.length > 0) {
      return data.features[0].attributes
    }
    return null
  } catch {
    // Sales data is supplemental — don't fail if it errors
    console.log('Could not fetch sales data for PIN:', pin)
    return null
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

    const outFields = 'PIN,ADDR_FULL,CTYNAME,POSTALCTYNAME,ZIP5,LAT,LON,APPRLNDVAL,APPR_IMPR,KCA_ACRES,LOTSQFT,PROPTYPE,PREUSE_DESC,KCTP_TAXYR'
    const queryString = [
      `where=${encodeURIComponent(whereClause)}`,
      `outFields=${outFields}`,
      `returnGeometry=false`,
      `resultRecordCount=10`,
      `f=json`,
    ].join('&')

    const res = await fetch(`${KC_PARCEL_ADDRESS_URL}?${queryString}`)
    const data = await res.json()

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
      const attrs = data.features[0].attributes
      const sale = await fetchSalesData(attrs.PIN as string)
      const property = mapFeature(attrs, sale)
      return NextResponse.json({ property })
    }

    // Multiple results — fetch sales data for all in parallel
    const properties = await Promise.all(
      data.features.map(async (f: KCFeature) => {
        const sale = await fetchSalesData(f.attributes.PIN as string)
        return mapFeature(f.attributes, sale)
      })
    )

    return NextResponse.json({ properties })

  } catch (error) {
    console.error('King County API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch property data' },
      { status: 500 }
    )
  }
}