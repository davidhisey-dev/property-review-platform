'use client'

import { useState, useCallback, useRef } from 'react'
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

const DEFAULT_VIEW = {
  longitude: -122.3321,
  latitude: 47.6062,
  zoom: 10,
}

type Property = {
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

type Props = {
  onPropertySelect?: (property: Property) => void
  height?: string
}

export default function PropertyMap({
  onPropertySelect,
  height = '500px',
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const [viewState, setViewState] = useState(DEFAULT_VIEW)
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const handleMarkerClick = useCallback((property: Property) => {
    setSelectedProperty(property)
    if (property.longitude && property.latitude) {
      mapRef.current?.flyTo({
        center: [property.longitude, property.latitude],
        zoom: 16,
        duration: 800,
      })
    }
  }, [])

  const handleSelectProperty = useCallback(async () => {
  if (!selectedProperty) return

  try {
    const res = await fetch('/api/property/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedProperty),
    })

    const data = await res.json()

    if (data.id && onPropertySelect) {
      onPropertySelect({ ...selectedProperty, id: data.id })
    }
  } catch {
    // If caching fails still proceed with property data
    if (onPropertySelect) {
      onPropertySelect(selectedProperty)
    }
  }
}, [selectedProperty, onPropertySelect])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchError('')
    setSelectedProperty(null)
    setProperties([])

    try {
      // Step 1 — Geocode the address with Mapbox to get coordinates
      const query = encodeURIComponent(`${searchQuery}, King County, Washington`)
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=US&proximity=-122.3321,47.6062&types=address`

      const geocodeRes = await fetch(geocodeUrl)
      const geocodeData = await geocodeRes.json()

      if (!geocodeData.features || geocodeData.features.length === 0) {
        setSearchError('Address not found. Please try a more specific address.')
        setSearching(false)
        return
      }

      const [longitude, latitude] = geocodeData.features[0].center

      // Fly map to the geocoded location immediately
      mapRef.current?.flyTo({
        center: [longitude, latitude],
        zoom: 16,
        duration: 1000,
      })

      // Step 2 — Query King County API with the address text
      // Use the place_name from Mapbox which gives us a clean address
      const placeName = geocodeData.features[0].place_name
      const kcRes = await fetch(
        `/api/property/search?address=${encodeURIComponent(searchQuery)}`
      )
      const kcData = await kcRes.json()

      if (kcRes.status === 404 || kcData.error) {
        setSearchError('No King County parcel found for this address.')
        setSearching(false)
        return
      }

      // Normalize to array whether single or multiple results
      const results: Property[] = kcData.property
        ? [kcData.property]
        : kcData.properties || []

      // Filter to only properties with coordinates
      const withCoords = results.filter(
        (p) => p.latitude && p.longitude
      )

      setProperties(withCoords)

      // If only one result auto-select it
      if (withCoords.length === 1) {
        setSelectedProperty(withCoords[0])
        mapRef.current?.flyTo({
          center: [withCoords[0].longitude!, withCoords[0].latitude!],
          zoom: 17,
          duration: 800,
        })
      } else if (withCoords.length > 1) {
        // Fit map to show all markers
        const lngs = withCoords.map((p) => p.longitude!)
        const lats = withCoords.map((p) => p.latitude!)
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)

        mapRef.current?.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 80, duration: 1000, maxZoom: 17 }
        )
      }

    } catch {
      setSearchError('Search failed. Please try again.')
    }

    setSearching(false)
  }, [searchQuery])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const formatCurrency = (val: number | null) =>
    val ? `$${val.toLocaleString()}` : 'N/A'

  return (
    <div style={{ position: 'relative', width: '100%', height }}>

      {/* Search Bar */}
      <div style={{
        position: 'absolute',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        width: '90%',
        maxWidth: '500px',
        display: 'flex',
        gap: '0.5rem',
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))',
      }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by address..."
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '1rem',
            backgroundColor: 'white',
            WebkitAppearance: 'none',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          style={{
            padding: '0.75rem 1.25rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: searching ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            minHeight: '44px',
            whiteSpace: 'nowrap',
          }}
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {/* Search Error */}
      {searchError && (
        <div style={{
          position: 'absolute',
          top: '4.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          fontSize: '0.875rem',
          whiteSpace: 'nowrap',
        }}>
          {searchError}
        </div>
      )}

      {/* Results count */}
      {properties.length > 1 && (
        <div style={{
          position: 'absolute',
          top: '4.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          color: '#374151',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          fontSize: '0.875rem',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          {properties.length} parcels found — click a marker to view
        </div>
      )}

      {/* Map */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="bottom-right" />
        <GeolocateControl
          position="bottom-right"
          trackUserLocation={false}
          showUserHeading={false}
        />

        {/* Property Markers */}
        {properties.map((property) => (
          <Marker
            key={property.parcel_number}
            longitude={property.longitude!}
            latitude={property.latitude!}
            anchor="bottom"
            onClick={() => handleMarkerClick(property)}
          >
            <div style={{
              width: '28px',
              height: '28px',
              backgroundColor:
                selectedProperty?.parcel_number === property.parcel_number
                  ? '#1d4ed8'
                  : '#2563eb',
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              border: '2px solid white',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }} />
          </Marker>
        ))}

        {/* Selected Property Popup */}
        {selectedProperty && selectedProperty.longitude && selectedProperty.latitude && (
          <Popup
            longitude={selectedProperty.longitude}
            latitude={selectedProperty.latitude}
            anchor="top"
            onClose={() => setSelectedProperty(null)}
            closeOnClick={false}
          >
            <div style={{ padding: '0.5rem', minWidth: '220px' }}>
              <p style={{
                fontWeight: '600',
                margin: '0 0 0.5rem',
                fontSize: '0.875rem',
                lineHeight: '1.3',
              }}>
                {selectedProperty.address_full}
              </p>
              <p style={{
                color: '#6b7280',
                margin: '0 0 0.25rem',
                fontSize: '0.8rem',
              }}>
                {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}
              </p>
              <p style={{
                color: '#6b7280',
                margin: '0 0 0.25rem',
                fontSize: '0.8rem',
              }}>
                {selectedProperty.present_use}
              </p>
              <p style={{
                color: '#6b7280',
                margin: '0 0 0.25rem',
                fontSize: '0.8rem',
              }}>
                Lot: {selectedProperty.square_feet_lot?.toLocaleString()} sq ft
                {selectedProperty.acreage
                  ? ` (${selectedProperty.acreage.toFixed(2)} acres)`
                  : ''}
              </p>
              <p style={{
                color: '#374151',
                margin: '0 0 0.75rem',
                fontSize: '0.8rem',
                fontWeight: '500',
              }}>
                Assessed: {formatCurrency(selectedProperty.appraised_total_value)}
              </p>
              <button
                onClick={handleSelectProperty}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  minHeight: '44px',
                  fontWeight: '500',
                }}
              >
                View Property
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}