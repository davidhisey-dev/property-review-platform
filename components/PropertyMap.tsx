'use client'

import { useState, useCallback, useRef } from 'react'
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Default center — King County, WA
const DEFAULT_VIEW = {
  longitude: -122.3321,
  latitude: 47.6062,
  zoom: 10,
}

type Property = {
  id: string
  parcel_number: string
  address_full: string
  latitude: number
  longitude: number
  appraised_total_value?: number
  owner_name?: string
}

type Props = {
  properties?: Property[]
  onPropertySelect?: (property: Property) => void
  height?: string
}

export default function PropertyMap({
  properties = [],
  onPropertySelect,
  height = '500px',
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const [viewState, setViewState] = useState(DEFAULT_VIEW)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const handleMarkerClick = useCallback((property: Property) => {
    setSelectedProperty(property)
    mapRef.current?.flyTo({
      center: [property.longitude, property.latitude],
      zoom: 16,
      duration: 800,
    })
  }, [])

  const handleSelectProperty = useCallback(() => {
    if (selectedProperty && onPropertySelect) {
      onPropertySelect(selectedProperty)
    }
  }, [selectedProperty, onPropertySelect])

  const handleAddressSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchError('')

    try {
      // Mapbox geocoding API — restricts search to Washington State
      const query = encodeURIComponent(`${searchQuery}, Washington State`)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=US&proximity=-122.3321,47.6062&types=address`

      const res = await fetch(url)
      const data = await res.json()

      if (!data.features || data.features.length === 0) {
        setSearchError('No address found. Please try a more specific address.')
        setSearching(false)
        return
      }

      const [longitude, latitude] = data.features[0].center

      mapRef.current?.flyTo({
        center: [longitude, latitude],
        zoom: 17,
        duration: 1000,
      })

    } catch {
      setSearchError('Search failed. Please try again.')
    }

    setSearching(false)
  }, [searchQuery])

 const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddressSearch()
  }

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
          }}
        />
        <button
          onClick={handleAddressSearch}
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

      {/* Map */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {/* Navigation controls — zoom in/out */}
        <NavigationControl position="bottom-right" />

        {/* Geolocation — find my location button */}
        <GeolocateControl
          position="bottom-right"
          trackUserLocation={false}
          showUserHeading={false}
        />

        {/* Property Markers */}
        {properties.map((property) => (
          <Marker
            key={property.id}
            longitude={property.longitude}
            latitude={property.latitude}
            anchor="bottom"
            onClick={() => handleMarkerClick(property)}
          >
            <div style={{
              width: '28px',
              height: '28px',
              backgroundColor: selectedProperty?.id === property.id
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
        {selectedProperty && (
          <Popup
            longitude={selectedProperty.longitude}
            latitude={selectedProperty.latitude}
            anchor="top"
            onClose={() => setSelectedProperty(null)}
            closeOnClick={false}
          >
            <div style={{ padding: '0.5rem', minWidth: '200px' }}>
              <p style={{
                fontWeight: '600',
                margin: '0 0 0.25rem',
                fontSize: '0.875rem',
              }}>
                {selectedProperty.address_full}
              </p>
              {selectedProperty.owner_name && (
                <p style={{
                  color: '#6b7280',
                  margin: '0 0 0.25rem',
                  fontSize: '0.8rem',
                }}>
                  Owner: {selectedProperty.owner_name}
                </p>
              )}
              {selectedProperty.appraised_total_value && (
                <p style={{
                  color: '#6b7280',
                  margin: '0 0 0.75rem',
                  fontSize: '0.8rem',
                }}>
                  Value: ${selectedProperty.appraised_total_value.toLocaleString()}
                </p>
              )}
              <button
                onClick={handleSelectProperty}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  minHeight: '44px',
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