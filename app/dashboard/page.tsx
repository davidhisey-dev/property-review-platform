'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppHeader, { NAV_H } from '@/components/AppHeader'

// ─── Pin color constants ──────────────────────────────────────────────────────
const DRAFT_PIN_COLOR  = '#F59E0B'
const EXPLORE_PIN_COLOR = '#6B7280'
// Aggregate pin colors by avg rating
const AGG_PIN_GREEN = '#16A34A'  // avg >= 4.0
const AGG_PIN_GRAY  = '#6B7280'  // avg 3.0–3.9
const AGG_PIN_RED   = '#DC2626'  // avg < 3.0

// ─── Layout constants ─────────────────────────────────────────────────────────
const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const DEFAULT_VIEW = { longitude: -122.3321, latitude: 47.6062, zoom: 10 }
const COLLAPSED_H    = 64   // px visible when panel is collapsed
const DRAG_H         = 28   // drag handle height (py-3 = 24 + h-1 bar = 4)
const PANEL_HEADER_H = 64   // drag handle (28) + My Reviews label row (36)

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewPin = {
  reviewId: string
  propertyId: string
  address: string
  latitude: number
  longitude: number
  status: 'draft' | 'submitted'
  jobSize: string | null
  overallRating: number | null
  primaryContactName: string | null
  lastEditedAt: string | null
  updatedAt: string
  createdAt: string
  reviewCount: number | null
}

type ExploreResult = {
  address: string
  latitude: number
  longitude: number
  propertyId: string | null
  loading: boolean
  reviewCount?: number | null
}

type GeocodeSuggestion = {
  place_name: string
  center: [number, number]
  text: string
}

type MismatchResult = {
  kcAddress: string
  propertyId: string | null
  lat: number
  lng: number
}

type AggregatePin = {
  propertyId: string
  address: string
  latitude: number
  longitude: number
  reviewCount: number
  avgRating: number | null
}

// ─── Panel offset helpers ─────────────────────────────────────────────────────

// Used only to compute the maximum-open clamp during dragging
function maxOpenOffset(wh: number): number {
  return Math.max(NAV_H + 4, Math.floor(wh * 0.08))
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Address normalization ────────────────────────────────────────────────────

function normalizeAddress(address: string): string {
  let s = address.toUpperCase().trim()
  // Protect ordinal suffixes before running replacements
  s = s.replace(/\b(\d+)(ST|ND|RD|TH)\b/gi, '$1__ORD__$2')
  const replacements: [RegExp, string][] = [
    // Compound directionals before simple ones; (?<!\d) prevents matching inside ordinals
    [/(?<!\d)\bNORTHEAST\b/g, 'NE'], [/(?<!\d)\bNORTHWEST\b/g, 'NW'],
    [/(?<!\d)\bSOUTHEAST\b/g, 'SE'], [/(?<!\d)\bSOUTHWEST\b/g, 'SW'],
    [/(?<!\d)\bNORTH\b/g, 'N'],  [/(?<!\d)\bSOUTH\b/g, 'S'],
    [/(?<!\d)\bEAST\b/g,  'E'],  [/(?<!\d)\bWEST\b/g,  'W'],
    // Street suffixes — (?<!\d) prevents matching ordinals like 423RD, 1ST, 2ND, 3RD
    [/(?<!\d)\bAVENUE\b/g,     'AVE'],  [/(?<!\d)\bBOULEVARD\b/g, 'BLVD'], [/(?<!\d)\bCIRCLE\b/g,    'CIR'],
    [/(?<!\d)\bCOURT\b/g,      'CT'],   [/(?<!\d)\bCOVE\b/g,      'CV'],   [/(?<!\d)\bCROSSING\b/g,  'XING'],
    [/(?<!\d)\bDRIVE\b/g,      'DR'],   [/(?<!\d)\bEXPRESSWAY\b/g,'EXPY'], [/(?<!\d)\bFREEWAY\b/g,   'FWY'],
    [/(?<!\d)\bHIGHWAY\b/g,    'HWY'],  [/(?<!\d)\bLANE\b/g,      'LN'],   [/(?<!\d)\bPARKWAY\b/g,   'PKWY'],
    [/(?<!\d)\bPLACE\b/g,      'PL'],   [/(?<!\d)\bPLAZA\b/g,     'PLZ'],  [/(?<!\d)\bPOINT\b/g,     'PT'],
    [/(?<!\d)\bROAD\b/g,       'RD'],   [/(?<!\d)\bROUTE\b/g,     'RTE'],  [/(?<!\d)\bSQUARE\b/g,    'SQ'],
    [/(?<!\d)\bSTREET\b/g,     'ST'],   [/(?<!\d)\bTERRACE\b/g,   'TER'],  [/(?<!\d)\bTRAIL\b/g,     'TRL'],
  ]
  for (const [re, abbr] of replacements) {
    s = s.replace(re, abbr)
  }
  // Restore ordinal suffixes
  s = s.replace(/(\d+)__ORD__(ST|ND|RD|TH)\b/gi, '$1$2')
  return s.replace(/\s+/g, ' ').trim()
}


// ─── Distance helper (approximate, King County area) ─────────────────────────

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111
  const dLng = (lng2 - lng1) * 85   // cos(47°) ≈ 0.68; 111 * 0.68 ≈ 75, use 85 for slack
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

// ─── Small shared components ──────────────────────────────────────────────────

// empty=true → all gray empty stars (draft); empty=false → amber filled stars (submitted)
function Stars({ rating, empty = false }: { rating: number | null; empty?: boolean }) {
  const filled = empty ? 0 : Math.min(5, Math.max(0, rating ?? 0))
  const color = empty ? '#9CA3AF' : '#F59E0B'
  return (
    <span style={{ fontSize: 12, color, letterSpacing: '0.05em', flexShrink: 0 }}
          aria-label={empty ? 'Not yet rated' : `${filled} out of 5 stars`}>
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  )
}

// Teardrop pin with pencil icon — draft reviews
function DraftMapPin({ selected }: { selected: boolean }) {
  const sz = selected ? 32 : 28
  return (
    <div style={{
      width: sz, height: sz,
      backgroundColor: DRAFT_PIN_COLOR,
      borderRadius: '50% 50% 50% 0',
      transform: 'rotate(-45deg)',
      border: `${selected ? 3 : 2}px solid white`,
      boxShadow: selected
        ? `0 0 0 2px ${DRAFT_PIN_COLOR}, 0 2px 8px rgba(0,0,0,0.4)`
        : '0 2px 6px rgba(0,0,0,0.35)',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s ease',
    }}>
      <div style={{ transform: 'rotate(45deg)', lineHeight: 0 }}>
        <svg viewBox="0 0 24 24" fill="white" width="12" height="12">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </div>
    </div>
  )
}

// Teardrop pin — search result
function ExplorePin() {
  return (
    <div style={{
      width: 24, height: 24,
      backgroundColor: EXPLORE_PIN_COLOR,
      borderRadius: '50% 50% 50% 0',
      transform: 'rotate(-45deg)',
      border: '2px solid white',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      cursor: 'pointer',
    }} />
  )
}

// Teardrop pin — aggregate community reviews (no icon)
function AggregateMapPin({ color }: { color: string }) {
  return (
    <div style={{
      width: 22, height: 22,
      backgroundColor: color,
      borderRadius: '50% 50% 50% 0',
      transform: 'rotate(-45deg)',
      border: '2px solid white',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      cursor: 'pointer',
    }} />
  )
}

function aggPinColor(avgRating: number | null): string {
  if (avgRating == null)    return AGG_PIN_GRAY
  if (avgRating >= 4.0)     return AGG_PIN_GREEN
  if (avgRating >= 3.0)     return AGG_PIN_GRAY
  return AGG_PIN_RED
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const mapRef = useRef<MapRef>(null)
  const wh = useRef(800)
  const dragRef = useRef<{ startY: number; startOffset: number; moved: boolean } | null>(null)

  const fetchedRef = useRef(false)
  const aggregateFetchedRef = useRef(false)
  const selectedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [reviews, setReviews] = useState<ReviewPin[]>([])
  const [selectedPin, setSelectedPin] = useState<ReviewPin | null>(null)
  const [exploreResult, setExploreResult] = useState<ExploreResult | null>(null)
  const [aggregatePins, setAggregatePins] = useState<AggregatePin[]>([])
  const [selectedAggPin, setSelectedAggPin] = useState<AggregatePin | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(true)
  const [openOffset, setOpenOffset] = useState<number | null>(null) // null = use 30vh default
  const [liveOffset, setLiveOffset] = useState<number | null>(null)
  // Search state (was ExploreTab, now lifted to top level)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [mismatch, setMismatch] = useState<MismatchResult | null>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [pendingLookup, setPendingLookup] = useState<{ address: string; lat: number; lng: number } | null>(null)

  // ─── Window height ─────────────────────────────────────────────────────────
  useEffect(() => {
    wh.current = window.innerHeight
    if (window.innerWidth >= 768) {
      setOpenOffset(Math.floor(window.innerHeight * 0.5))
      setPanelCollapsed(false)
    }
    const onResize = () => { wh.current = window.innerHeight }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ─── Auth guard + My Reviews fetch ────────────────────────────────────────
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('is_active, is_admin, display_name')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/register'); return }
      if (!profile.is_active) { router.push('/pending'); return }

      setIsAdmin(profile.is_admin ?? false)
      setDisplayName(profile.display_name ?? '')

      const { data } = await supabase
        .from('reviews')
        .select(`
          id,
          property_id,
          status,
          job_size,
          overall_rating,
          primary_contact_name,
          last_edited_at,
          updated_at,
          created_at,
          properties!inner(address_full, latitude, longitude)
        `)
        .eq('user_id', user.id)
        .in('status', ['draft', 'submitted'])
        .order('last_edited_at', { ascending: false, nullsFirst: false })


      if (data) {
        const seenIds = new Set<string>()
        const pins: ReviewPin[] = (data as any[])
          .filter(r => { if (seenIds.has(r.id)) return false; seenIds.add(r.id); return true })
          .filter(r => r.properties?.latitude && r.properties?.longitude)
          .map(r => ({
            reviewId: r.id,
            propertyId: r.property_id,
            address: r.properties.address_full,
            latitude: Number(r.properties.latitude),
            longitude: Number(r.properties.longitude),
            status: r.status as 'draft' | 'submitted',
            jobSize: r.job_size,
            overallRating: r.overall_rating,
            primaryContactName: r.primary_contact_name ?? null,
            lastEditedAt: r.last_edited_at,
            updatedAt: r.updated_at,
            createdAt: r.created_at,
            reviewCount: null,
          }))

        const propertyIds = [...new Set(pins.map(p => p.propertyId))]
        if (propertyIds.length > 0) {
          const { data: ppData } = await supabase
            .from('property_profiles')
            .select('property_id, review_count')
            .in('property_id', propertyIds)
          if (ppData) {
            const countMap: Record<string, number> = {}
            ppData.forEach((pp: any) => { countMap[pp.property_id] = pp.review_count ?? 0 })
            pins.forEach(p => { p.reviewCount = countMap[p.propertyId] ?? null })
          }
        }

        setReviews(pins)
      }

      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Aggregate pins fetch (on mount) ──────────────────────────────────────
  useEffect(() => {
    if (aggregateFetchedRef.current) return
    aggregateFetchedRef.current = true
    const fetchAgg = async () => {
      const { data } = await supabase
        .from('property_profiles')
        .select('property_id, review_count, avg_overall_rating, properties!inner(address_full, latitude, longitude)')
        .gt('review_count', 0)
        .limit(500)
      if (!data) return
      const pins: AggregatePin[] = (data as any[])
        .filter(r => r.properties?.latitude && r.properties?.longitude)
        .map(r => ({
          propertyId: r.property_id,
          address: r.properties.address_full,
          latitude: Number(r.properties.latitude),
          longitude: Number(r.properties.longitude),
          reviewCount: r.review_count,
          avgRating: r.avg_overall_rating != null ? Number(r.avg_overall_rating) : null,
        }))
      setAggregatePins(pins)
    }
    fetchAgg()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Background KC lookup after URL-param navigation ─────────────────────
  useEffect(() => {
    if (!pendingLookup) return
    const { address, lat, lng } = pendingLookup
    const run = async () => {
      try {
        const normalizedAddr = normalizeAddress(address)
        const searchRes = await fetch(`/api/property/search?address=${encodeURIComponent(normalizedAddr)}`)
        const searchData = searchRes.ok ? await searchRes.json() : null
        const property = searchData?.property ?? searchData?.properties?.[0]

        if (!property) {
          setExploreResult(prev => prev ? { ...prev, loading: false } : null)
          setPendingLookup(null)
          return
        }

        const cacheRes = await fetch('/api/property/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(property),
        })
        const cacheData = cacheRes.ok ? await cacheRes.json() : {}
        const propertyId: string | null = cacheData.id ?? null

        let reviewCount: number | null = null
        if (propertyId) {
          const { data: pp } = await supabase
            .from('property_profiles')
            .select('review_count')
            .eq('property_id', propertyId)
            .single()
          reviewCount = pp?.review_count ?? 0
        }

        const kcLat = property.latitude ? Number(property.latitude) : lat
        const kcLng = property.longitude ? Number(property.longitude) : lng
        const kcAddress = property.address_full || address

        setExploreResult({ address: kcAddress, latitude: kcLat, longitude: kcLng, propertyId, loading: false, reviewCount })

        if (Math.abs(kcLat - lat) > 0.001 || Math.abs(kcLng - lng) > 0.001) {
          mapRef.current?.fitBounds(
            [[kcLng - 0.01, kcLat - 0.01], [kcLng + 0.01, kcLat + 0.01]],
            { padding: 50, duration: 800 }
          )
        }
      } catch {
        setExploreResult(prev => prev ? { ...prev, loading: false } : null)
      }
      setPendingLookup(null)
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLookup])

  // ─── Panel drag ────────────────────────────────────────────────────────────

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const curOff = panelCollapsed
      ? wh.current - COLLAPSED_H
      : (openOffset ?? Math.floor(wh.current * 0.3))
    dragRef.current = { startY: e.clientY, startOffset: curOff, moved: false }
  }, [panelCollapsed, openOffset])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const delta = e.clientY - dragRef.current.startY
    if (Math.abs(delta) > 4) dragRef.current.moved = true
    if (!dragRef.current.moved) return
    const offset = Math.max(
      maxOpenOffset(wh.current),
      Math.min(wh.current - COLLAPSED_H, dragRef.current.startOffset + delta),
    )
    setLiveOffset(offset)
  }, [])

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { startY, startOffset, moved } = dragRef.current
    dragRef.current = null
    if (!moved) {
      // Tap: toggle collapsed ↔ 30vh open
      if (panelCollapsed) {
        setOpenOffset(Math.floor(wh.current * 0.3))
        setPanelCollapsed(false)
      } else {
        setPanelCollapsed(true)
      }
      setLiveOffset(null)
      return
    }
    const finalOffset = Math.max(
      maxOpenOffset(wh.current),
      Math.min(wh.current - COLLAPSED_H, startOffset + (e.clientY - startY)),
    )
    // Collapse if panel top released below 80% of viewport height
    if (finalOffset > wh.current * 0.8) {
      setPanelCollapsed(true)
    } else {
      setOpenOffset(finalOffset)
      setPanelCollapsed(false)
    }
    setLiveOffset(null)
  }, [panelCollapsed])

  // ─── Draft pin click — no panel collapse per spec ─────────────────────────

  const handlePinClick = useCallback((pin: ReviewPin) => {
    setSelectedAggPin(null)
    setSelectedPin(pin)
  }, [])

  // ─── Search / geocoding ────────────────────────────────────────────────────

  const runGeocoding = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams({
        access_token: token,
        types: 'address',
        country: 'US',
        bbox: '-122.5434,47.1842,-121.3046,47.7776',
        proximity: '-122.0651,47.4502',
        autocomplete: 'true',
        fuzzy_match: 'false',
        limit: '10',
      })
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.features) {
        const houseNum = q.match(/^\d+/)?.[0]
        const filtered = (data.features as GeocodeSuggestion[]).filter(f => {
          if (houseNum && !f.place_name.startsWith(houseNum)) return false
          const streetPart = f.place_name.split(',')[0]
          if (!streetPart.includes(' ')) return false
          return true
        })
        setSuggestions(filtered)
      }
    } catch {
      // Suggestions are supplemental — don't show an error
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearchNow = useCallback(() => {
    if (selectedRef.current) return
    if (query.trim().length < 2) return
    runGeocoding(query)
  }, [query, runGeocoding])

  // Debounced geocoding — 2+ char minimum, no pattern gate
  useEffect(() => {
    if (selectedRef.current) return
    if (query.trim().length < 2) { setSuggestions([]); return }
    const timer = setTimeout(() => runGeocoding(query), 300)
    return () => clearTimeout(timer)
  }, [query, runGeocoding])

  const handleSelect = async (suggestion: GeocodeSuggestion) => {
    const mapboxLng = suggestion.center[0]
    const mapboxLat = suggestion.center[1]
    const shortAddress = suggestion.place_name.split(',')[0]
    const normalizedQuery = normalizeAddress(query)

    selectedRef.current = true
    setSuggestions([])
    setQuery(shortAddress)
    setSearchError('')
    setMismatch(null)
    setSearching(true)


    try {
      const searchRes = await fetch(
        `/api/property/search?address=${encodeURIComponent(normalizedQuery)}`
      )
      const searchData = searchRes.ok ? await searchRes.json() : null
      const property = searchData?.property ?? searchData?.properties?.[0]

      // Case 1 — no parcel found
      if (!searchRes.ok || !searchData || !property) {
        setSearchError('No parcel found for this address. Try searching for a nearby address or a different street number.')
        setSearching(false)
        return
      }

      const kcLat = property.latitude ? Number(property.latitude) : mapboxLat
      const kcLng = property.longitude ? Number(property.longitude) : mapboxLng
      const kcAddress = property.address_full || shortAddress

      // Case 2 — house number mismatch (>20%) flags wrong parcel
      const searchedNum = parseInt(normalizeAddress(shortAddress).match(/^\d+/)?.[0] ?? '0', 10)
      const kcNum = parseInt(normalizeAddress(kcAddress).match(/^\d+/)?.[0] ?? '0', 10)
      const isMismatch = searchedNum > 0 && kcNum > 0 &&
        Math.abs(searchedNum - kcNum) / Math.max(searchedNum, kcNum) > 0.2

      if (isMismatch) {
        const cacheRes = await fetch('/api/property/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(property),
        })
        const cacheData = cacheRes.ok ? await cacheRes.json() : {}
        setMismatch({ kcAddress, propertyId: cacheData.id ?? null, lat: kcLat, lng: kcLng })
        setSearching(false)
        return
      }

      // Case 3 — confirmed parcel
      const cacheRes = await fetch('/api/property/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property),
      })
      const cacheData = cacheRes.ok ? await cacheRes.json() : {}

      let reviewCount: number | null = null
      if (cacheData.id) {
        const { data: pp } = await supabase
          .from('property_profiles')
          .select('review_count')
          .eq('property_id', cacheData.id)
          .single()
        reviewCount = pp?.review_count ?? 0
      }

      setExploreResult({
        address: kcAddress,
        latitude: kcLat,
        longitude: kcLng,
        propertyId: cacheData.id ?? null,
        loading: false,
        reviewCount,
      })
      setTimeout(() => {
        mapRef.current?.fitBounds(
          [[kcLng - 0.01, kcLat - 0.01], [kcLng + 0.01, kcLat + 0.01]],
          { padding: 50, duration: 800 }
        )
      }, 300)
    } catch (err) {
      console.error('[Search KC error]', err)
      setSearchError('Search failed. Please try again.')
    }

    setSearching(false)
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const drafts = reviews.filter(r => r.status === 'draft')
  const submitted = reviews.filter(r => r.status === 'submitted')
  const currentOpenOffset = openOffset ?? Math.floor(wh.current * 0.3)
  const currentOffset = liveOffset !== null
    ? liveOffset
    : panelCollapsed ? wh.current - COLLAPSED_H : currentOpenOffset
  const isAnimating = liveOffset === null
  const panelIsUp = !panelCollapsed
  const searchActive = exploreResult !== null

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-gray-200">

      {/* ── AppHeader (search embedded in header) ── */}
      <AppHeader
        isAdmin={isAdmin}
        displayName={displayName}
        showSearch
        query={query}
        searching={searching}
        onQueryChange={value => {
          selectedRef.current = false
          setQuery(value)
          setSearchError('')
          setMismatch(null)
          if (!value.trim()) setExploreResult(null)
        }}
        onClear={() => {
          selectedRef.current = false
          setQuery('')
          setSuggestions([])
          setSearchError('')
          setMismatch(null)
          setExploreResult(null)
        }}
        onSearchNow={handleSearchNow}
        onSearchFocus={() => setInputFocused(true)}
        onSearchBlur={() => setInputFocused(false)}
      />

      {/* ── Search feedback — suggestions / helper / error / mismatch ── */}

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <div style={{
          position: 'fixed',
          top: NAV_H + 4,
          left: 12,
          right: 12,
          zIndex: 200,
          backgroundColor: 'white',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => {
            const parts = s.place_name.split(', ')
            const primary = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0]
            const stateZipRaw = parts.find(p => /[A-Z][a-z]+ \d{5}/.test(p)) ?? ''
            const secondary = stateZipRaw.replace(
              /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s(\d{5})$/,
              (_, state: string, zip: string) => {
                const abbrev: Record<string, string> = {
                  Washington: 'WA', Oregon: 'OR', Idaho: 'ID', Montana: 'MT', California: 'CA',
                }
                return `${abbrev[state] ?? state} ${zip}`
              }
            )
            return (
              <button
                key={i}
                onClick={() => handleSelect(s)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '12px 16px',
                  borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                  backgroundColor: 'transparent', cursor: 'pointer',
                  minHeight: 48, display: 'block',
                  border: i < suggestions.length - 1 ? '0 0 1px 0 solid #f3f4f6' : 'none',
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1f2937' }}>{primary}</div>
                {secondary && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{secondary}</div>}
              </button>
            )
          })}
        </div>
      )}

      {/* Helper text — only when no suggestions and query is short */}
      {inputFocused && suggestions.length === 0 && !searchError && !mismatch && query.trim().length > 0 && query.trim().length < 3 && (
        <p style={{
          position: 'fixed',
          top: NAV_H + 8,
          left: 16, right: 16,
          zIndex: 200,
          fontSize: '0.75rem',
          color: '#9ca3af',
          margin: 0,
        }}>
          Type a house number and street name to search
        </p>
      )}

      {/* Error message */}
      {searchError && !searching && (
        <div style={{
          position: 'fixed',
          top: NAV_H + 8,
          left: 12, right: 12,
          zIndex: 200,
          backgroundColor: 'white',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          padding: '12px 16px',
        }}>
          <p style={{ fontSize: '0.875rem', color: '#ef4444', margin: 0 }}>{searchError}</p>
        </div>
      )}

      {/* Mismatch card */}
      {mismatch && !searching && (
        <div style={{
          position: 'fixed',
          top: NAV_H + 8,
          left: 12, right: 12,
          zIndex: 200,
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          padding: '12px 16px',
        }}>
          <p style={{ fontSize: '0.875rem', color: '#1f2937', lineHeight: 1.5, marginBottom: 12, marginTop: 0 }}>
            Exact address not found. Nearest parcel is{' '}
            <span style={{ fontWeight: 600 }}>{mismatch.kcAddress}</span> — is this the property you are looking for?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {mismatch.propertyId && (
              <button
                onClick={() => router.push(`/property/${mismatch.propertyId!}`)}
                style={{
                  flex: 1, padding: '8px 12px',
                  backgroundColor: '#2563eb', color: 'white',
                  fontSize: '0.75rem', fontWeight: 500,
                  borderRadius: 6, cursor: 'pointer', border: 'none',
                  minHeight: 36,
                }}
              >
                Yes, view this property
              </button>
            )}
            <button
              onClick={() => { setMismatch(null); selectedRef.current = false }}
              style={{
                flex: mismatch.propertyId ? 1 : undefined,
                width: mismatch.propertyId ? undefined : '100%',
                padding: '8px 12px',
                backgroundColor: 'white', color: '#4b5563',
                fontSize: '0.75rem', fontWeight: 500,
                borderRadius: 6, cursor: 'pointer',
                border: '1px solid #e5e7eb',
                minHeight: 36,
              }}
            >
              No, search again
            </button>
          </div>
        </div>
      )}

      {/* ── Map ── */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <Map
          ref={mapRef}
          initialViewState={DEFAULT_VIEW}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={token}
          onClick={() => { setSelectedPin(null); setSelectedAggPin(null) }}
          onLoad={() => {
            // Read URL params while they're still present (before router.replace clears them)
            const urlParams = new URLSearchParams(window.location.search)
            const urlSearch = urlParams.get('search')
            const urlLat = urlParams.get('lat')
            const urlLng = urlParams.get('lng')
            if (!urlSearch || !urlLat || !urlLng) return

            const lat = parseFloat(urlLat)
            const lng = parseFloat(urlLng)

            // Show pin immediately with loading state — KC lookup happens in background
            setExploreResult({ address: urlSearch, latitude: lat, longitude: lng, propertyId: null, loading: true })
            setPendingLookup({ address: urlSearch, lat, lng })
            setTimeout(() => {
              mapRef.current?.fitBounds(
                [[lng - 0.01, lat - 0.01], [lng + 0.01, lat + 0.01]],
                { padding: 50, duration: 800 }
              )
            }, 300)

            // Clear params so back navigation returns to the property page cleanly
            router.replace('/dashboard')
          }}
        >
          <NavigationControl position="bottom-right" />
          <GeolocateControl
            position="bottom-right"
            trackUserLocation={false}
            showUserHeading={false}
          />

          {/* ── Draft pins — always visible, always 100% opacity ── */}
          {drafts.map(pin => (
            <Marker
              key={pin.reviewId}
              longitude={pin.longitude}
              latitude={pin.latitude}
              anchor="bottom"
              onClick={e => { e.originalEvent.stopPropagation(); handlePinClick(pin) }}
            >
              <DraftMapPin selected={selectedPin?.reviewId === pin.reviewId} />
            </Marker>
          ))}

          {/* Draft pin popup — does not collapse the panel */}
          {selectedPin && (
            <Popup
              longitude={selectedPin.longitude}
              latitude={selectedPin.latitude}
              anchor="bottom"
              offset={12}
              onClose={() => setSelectedPin(null)}
              closeOnClick={false}
            >
              <div className="p-2 min-w-[180px]">
                <p className="font-semibold text-gray-900 text-sm leading-snug mb-1">
                  {selectedPin.address}
                </p>
                <p className="text-xs text-amber-600 font-medium mb-2.5">Draft in progress</p>
                <button
                  onClick={() => router.push(`/property/${selectedPin.propertyId}/review?draftId=${selectedPin.reviewId}`)}
                  className="w-full py-1.5 px-3 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Resume
                </button>
              </div>
            </Popup>
          )}

          {/* ── Aggregate pins — opacity driven by search/panel state ── */}
          {aggregatePins.map(pin => {
            let opacity = 1
            if (searchActive && exploreResult) {
              opacity = distKm(pin.latitude, pin.longitude, exploreResult.latitude, exploreResult.longitude) <= 1
                ? 1 : 0.6
            } else if (panelIsUp) {
              opacity = 0.6
            }
            return (
              <Marker
                key={pin.propertyId}
                longitude={pin.longitude}
                latitude={pin.latitude}
                anchor="bottom"
                onClick={e => { e.originalEvent.stopPropagation(); setSelectedPin(null); setSelectedAggPin(pin) }}
              >
                <div style={{ opacity, transition: 'opacity 0.2s ease' }}>
                  <AggregateMapPin color={aggPinColor(pin.avgRating)} />
                </div>
              </Marker>
            )
          })}

          {/* Aggregate pin popup — does not collapse the panel */}
          {selectedAggPin && !exploreResult && (
            <Popup
              longitude={selectedAggPin.longitude}
              latitude={selectedAggPin.latitude}
              anchor="bottom"
              offset={12}
              onClose={() => setSelectedAggPin(null)}
              closeOnClick={false}
            >
              <div className="p-2 min-w-[180px]">
                <p className="font-semibold text-gray-900 text-sm leading-snug mb-1">
                  {selectedAggPin.address}
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  {selectedAggPin.reviewCount === 1 ? '1 contractor review' : `${selectedAggPin.reviewCount} contractor reviews`}
                  {selectedAggPin.avgRating != null && ` · ★ ${selectedAggPin.avgRating.toFixed(1)}`}
                </p>
                <button
                  onClick={() => router.push(`/property/${selectedAggPin.propertyId}`)}
                  className="w-full py-1.5 px-3 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  View Property
                </button>
              </div>
            </Popup>
          )}

          {/* ── Search result marker + popup ── */}
          {exploreResult && (
            <>
              <Marker
                longitude={exploreResult.longitude}
                latitude={exploreResult.latitude}
                anchor="bottom"
              >
                <ExplorePin />
              </Marker>
              <Popup
                longitude={exploreResult.longitude}
                latitude={exploreResult.latitude}
                anchor="top"
                offset={8}
                onClose={() => setExploreResult(null)}
                closeOnClick={false}
              >
                <div className="p-2 min-w-[180px]">
                  <p className="font-semibold text-gray-900 text-sm leading-snug mb-2">
                    {exploreResult.address}
                  </p>
                  {exploreResult.loading ? (
                    <p className="text-xs text-gray-400">Looking up property...</p>
                  ) : exploreResult.propertyId ? (
                    <>
                      <p className="text-xs text-gray-400 mb-2">
                        {exploreResult.reviewCount != null && exploreResult.reviewCount > 0
                          ? (exploreResult.reviewCount === 1
                              ? '1 review from contractors'
                              : `${exploreResult.reviewCount} reviews from contractors`)
                          : 'No contractor reviews yet'}
                      </p>
                      <button
                        onClick={() => router.push(`/property/${exploreResult.propertyId!}`)}
                        className="w-full py-1.5 px-3 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                      >
                        View Property
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Parcel data not available for this address.
                    </p>
                  )}
                </div>
              </Popup>
            </>
          )}
        </Map>
      </div>

      {/* ── Slide-up panel — My Reviews only ── */}
      <div
        className="fixed inset-x-0 top-0 bottom-0 bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          zIndex: 10,
          transform: `translateY(${currentOffset}px)`,
          transition: isAnimating ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Drag handle + My Reviews header — total PANEL_HEADER_H (64px) */}
        <div
          className="flex-shrink-0 touch-none select-none cursor-grab active:cursor-grabbing"
          style={{ height: PANEL_HEADER_H }}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          role="button"
          aria-label="Drag to resize panel"
        >
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="px-4 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-800">My Reviews</span>
          </div>
        </div>

        <div className="flex-shrink-0 h-px bg-gray-100" />

        {/* Scrollable content */}
        <div
          className="overflow-y-auto overscroll-contain"
          style={{ height: Math.max(0, wh.current - currentOffset - PANEL_HEADER_H - 1) }}
        >
          <MyReviewsTab
            drafts={drafts}
            submitted={submitted}
            onDraftTap={pin => router.push(`/property/${pin.propertyId}/review?draftId=${pin.reviewId}`)}
            onSubmittedTap={pin => router.push(`/property/${pin.propertyId}`)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── My Reviews tab ───────────────────────────────────────────────────────────

function MyReviewsTab({
  drafts,
  submitted,
  onDraftTap,
  onSubmittedTap,
}: {
  drafts: ReviewPin[]
  submitted: ReviewPin[]
  onDraftTap: (pin: ReviewPin) => void
  onSubmittedTap: (pin: ReviewPin) => void
}) {
  const total = drafts.length + submitted.length

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="text-4xl mb-3" aria-hidden>🏠</div>
        <p className="text-gray-500 text-sm leading-relaxed">
          Start your first review — search for a property or tap a pin on the map.
        </p>
      </div>
    )
  }

  return (
    <div className="pb-8">

      {/* Summary row */}
      <div className="flex gap-5 px-4 py-3 border-b border-gray-50 text-sm">
        <span className="text-gray-500">
          <span className="font-semibold text-amber-600">{drafts.length}</span>{' '}
          Draft{drafts.length !== 1 ? 's' : ''}
        </span>
        <span className="text-gray-500">
          <span className="font-semibold text-blue-600">{submitted.length}</span>{' '}
          Submitted
        </span>
        <span className="text-gray-500">
          <span className="font-semibold text-gray-700">{total}</span> Total
        </span>
      </div>

      {/* Drafts section */}
      {drafts.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-1.5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Drafts</h3>
          </div>
          {drafts.map(pin => {
            const contact = pin.primaryContactName?.trim() || null
            return (
              <button
                key={pin.reviewId}
                onClick={() => onDraftTap(pin)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50"
              >
                {/* Line 1: address + Draft badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: '0.875rem', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pin.address}
                  </p>
                  <span style={{ flexShrink: 0, fontSize: '0.625rem', fontWeight: 600, color: '#D97706', backgroundColor: '#FEF3C7', borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Draft
                  </span>
                </div>
                {/* Line 2: contact name + empty gray stars */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontStyle: contact ? 'normal' : 'italic' }}>
                    {contact ?? 'No contact recorded'}
                  </span>
                  <Stars rating={null} empty />
                </div>
                {/* Line 3: last edited date */}
                <p style={{ margin: 0, fontSize: '0.6875rem', color: '#9CA3AF' }}>
                  Last edited: {fmtDate(pin.lastEditedAt ?? pin.createdAt)}
                </p>
              </button>
            )
          })}
        </>
      )}

      {/* Submitted section */}
      {submitted.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-1.5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Submitted</h3>
          </div>
          {submitted.map(pin => {
            const contact = pin.primaryContactName?.trim() || null
            return (
              <button
                key={pin.reviewId}
                onClick={() => onSubmittedTap(pin)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50"
              >
                {/* Line 1: address + review count badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: '0.875rem', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pin.address}
                  </p>
                  {pin.reviewCount != null && pin.reviewCount > 0 && (
                    <span style={{ flexShrink: 0, fontSize: '0.625rem', fontWeight: 600, color: '#2563EB', backgroundColor: '#EFF6FF', borderRadius: 4, padding: '2px 6px' }}>
                      {pin.reviewCount === 1 ? '1 review' : `${pin.reviewCount} reviews`}
                    </span>
                  )}
                </div>
                {/* Line 2: contact name + filled stars */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontStyle: contact ? 'normal' : 'italic' }}>
                    {contact ?? 'No contact recorded'}
                  </span>
                  <Stars rating={pin.overallRating} />
                </div>
                {/* Line 3: submitted date */}
                <p style={{ margin: 0, fontSize: '0.6875rem', color: '#9CA3AF' }}>
                  Submitted: {fmtDate(pin.updatedAt ?? pin.createdAt)}
                </p>
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
