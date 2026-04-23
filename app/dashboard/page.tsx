'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashNav, { NAV_H } from '@/components/DashNav'

// ─── Pin color constants ──────────────────────────────────────────────────────
const DRAFT_PIN_COLOR = '#F59E0B'
const SUBMITTED_PIN_COLOR = '#2563EB'
const EXPLORE_PIN_COLOR = '#6B7280'

// ─── Map defaults (Seattle) ───────────────────────────────────────────────────
const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const DEFAULT_VIEW = { longitude: -122.3321, latitude: 47.6062, zoom: 10 }

// ─── Panel geometry ───────────────────────────────────────────────────────────
// COLLAPSED_H: px visible when panel is collapsed — handle + tab bar
const COLLAPSED_H = 64
// Measured heights of fixed chrome inside the panel (drag handle + tab bar)
const DRAG_H = 28    // py-3 (24px) + h-1 bar (4px)
const TAB_BAR_H = 41 // py-2.5 (20px) + text-sm line (20px) + border (1px)

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

type RecentlyViewedItem = {
  propertyId: string
  address: string
  reviewCount: number | null
  lastViewedAt: string
}

type MismatchResult = {
  kcAddress: string
  propertyId: string | null
  lat: number
  lng: number
}

// FIX 5: Added 'third' (~33vh visible) as a snap point triggered by tab taps
type PanelState = 'collapsed' | 'third' | 'half' | 'full'

// ─── Panel offset helpers ─────────────────────────────────────────────────────

function targetOffset(state: PanelState, wh: number): number {
  if (state === 'collapsed') return wh - COLLAPSED_H
  if (state === 'third') return Math.floor(wh * 0.67)   // 33% visible
  if (state === 'half') return Math.floor(wh * 0.5)
  // Full: at least NAV_H + 4px clearance below the nav bar
  return Math.max(NAV_H + 4, Math.floor(wh * 0.08))
}

function snapToState(offset: number, wh: number): PanelState {
  if (offset < wh * 0.32) return 'full'
  if (offset < wh * 0.62) return 'half'
  return 'collapsed'
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function staleDays(lastEditedAt: string | null, createdAt: string): number {
  const ref = lastEditedAt ?? createdAt
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Small shared components ──────────────────────────────────────────────────

function Stars({ rating }: { rating: number | null }) {
  if (!rating || rating < 1) return null
  return (
    <span
      className="text-amber-400 text-sm tracking-tight"
      aria-label={`${rating} out of 5 stars`}
    >
      {'★'.repeat(rating)}{'☆'.repeat(Math.max(0, 5 - rating))}
    </span>
  )
}

function JobBadge({ size }: { size: string | null }) {
  if (!size) return null
  return (
    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
      {size}
    </span>
  )
}

function ReviewMapPin({ color, selected }: { color: string; selected: boolean }) {
  const size = selected ? 20 : 16
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        border: `${selected ? 3 : 2.5}px solid white`,
        boxShadow: selected
          ? `0 0 0 2px ${color}, 0 2px 8px rgba(0,0,0,0.4)`
          : '0 1px 4px rgba(0,0,0,0.35)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
    />
  )
}

function ExplorePin() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        backgroundColor: EXPLORE_PIN_COLOR,
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        border: '2px solid white',
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        cursor: 'pointer',
      }}
    />
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const mapRef = useRef<MapRef>(null)
  const wh = useRef(800)
  const dragRef = useRef<{
    startY: number
    startOffset: number
    moved: boolean
  } | null>(null)

  const fetchedRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [reviews, setReviews] = useState<ReviewPin[]>([])
  const [activeTab, setActiveTab] = useState<'my-reviews' | 'explore'>('my-reviews')
  const [selectedPin, setSelectedPin] = useState<ReviewPin | null>(null)
  const [exploreResult, setExploreResult] = useState<ExploreResult | null>(null)
  const [panelState, setPanelState] = useState<PanelState>('collapsed')
  const [liveOffset, setLiveOffset] = useState<number | null>(null)

  // Initialise window height and starting panel state
  useEffect(() => {
    wh.current = window.innerHeight
    setPanelState(window.innerWidth >= 768 ? 'half' : 'collapsed')
    const onResize = () => { wh.current = window.innerHeight }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Auth guard + fetch My Reviews on load
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

      const { data, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          id,
          property_id,
          status,
          job_size,
          overall_rating,
          last_edited_at,
          updated_at,
          created_at,
          properties!inner(address_full, latitude, longitude)
        `)
        .in('status', ['draft', 'submitted'])
        .order('last_edited_at', { ascending: false, nullsFirst: false })

      console.log('[My Reviews fetch] rows:', data?.length ?? 0, 'error:', reviewsError)

      if (data) {
        const seenIds = new Set<string>()
        const pins: ReviewPin[] = (data as any[])
          .filter(r => {
            if (seenIds.has(r.id)) return false
            seenIds.add(r.id)
            return true
          })
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
            lastEditedAt: r.last_edited_at,
            updatedAt: r.updated_at,
            createdAt: r.created_at,
            reviewCount: null,
          }))

        // Fetch review counts separately to avoid nested join issues
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

  // ─── Panel drag ────────────────────────────────────────────────────────────

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startY: e.clientY,
      startOffset: targetOffset(panelState, wh.current),
      moved: false,
    }
  }, [panelState])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const delta = e.clientY - dragRef.current.startY
    if (Math.abs(delta) > 4) dragRef.current.moved = true
    if (!dragRef.current.moved) return
    const offset = Math.max(
      targetOffset('full', wh.current),
      Math.min(wh.current - COLLAPSED_H, dragRef.current.startOffset + delta),
    )
    setLiveOffset(offset)
  }, [])

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { startY, startOffset, moved } = dragRef.current
    dragRef.current = null

    if (!moved) {
      // Tap on handle — cycle collapsed↔half↔full (skips 'third')
      setPanelState(prev =>
        prev === 'collapsed' ? 'half' : prev === 'half' ? 'full' : 'collapsed'
      )
      setLiveOffset(null)
      return
    }

    const finalOffset = Math.max(
      targetOffset('full', wh.current),
      Math.min(wh.current - COLLAPSED_H, startOffset + (e.clientY - startY)),
    )
    setPanelState(snapToState(finalOffset, wh.current))
    setLiveOffset(null)
  }, [])

  // ─── Tab switch — FIX 5: snap to 'third' if currently collapsed ───────────

  const handleTabSwitch = useCallback((tab: 'my-reviews' | 'explore') => {
    setActiveTab(tab)
    setPanelState(prev => prev === 'collapsed' ? 'third' : prev)
  }, [])

  // ─── Map pin interaction ───────────────────────────────────────────────────

  const handlePinClick = useCallback((pin: ReviewPin) => {
    setSelectedPin(pin)
    setPanelState('collapsed')
    setTimeout(() => {
      mapRef.current?.flyTo({
        center: [pin.longitude, pin.latitude],
        zoom: 16,
        duration: 800,
      })
    }, 300)
  }, [])

  // ─── Derived ───────────────────────────────────────────────────────────────

  const drafts = reviews.filter(r => r.status === 'draft')
  const submitted = reviews.filter(r => r.status === 'submitted')
  const currentOffset = liveOffset !== null ? liveOffset : targetOffset(panelState, wh.current)
  const isAnimating = liveOffset === null

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
    // FIX 1: Removed overflow-hidden — all children are fixed/absolute so no
    // scrollbar risk. overflow-hidden was trapping the fixed DashNav in a
    // stacking context that clipped it behind the Mapbox canvas in Safari/iOS.
    <div className="fixed inset-0 bg-gray-200">

      {/* ── Floating nav bar (z-index: 9999 in DashNav component) ── */}
      <DashNav isAdmin={isAdmin} displayName={displayName} />

      {/* ── Full-screen map ──
          FIX 1: explicit zIndex: 0 creates a clear stacking baseline so
          DashNav (9999) and the panel (10) are unambiguously above the map. ── */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <Map
          ref={mapRef}
          initialViewState={DEFAULT_VIEW}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={token}
          onClick={() => setSelectedPin(null)}
        >
          <NavigationControl position="bottom-right" />
          <GeolocateControl
            position="bottom-right"
            trackUserLocation={false}
            showUserHeading={false}
          />

          {/* My Reviews pins — shown only on My Reviews tab */}
          {activeTab === 'my-reviews' && reviews.map(pin => (
            <Marker
              key={pin.reviewId}
              longitude={pin.longitude}
              latitude={pin.latitude}
              anchor="center"
              onClick={e => {
                e.originalEvent.stopPropagation()
                handlePinClick(pin)
              }}
            >
              <ReviewMapPin
                color={pin.status === 'draft' ? DRAFT_PIN_COLOR : SUBMITTED_PIN_COLOR}
                selected={selectedPin?.reviewId === pin.reviewId}
              />
            </Marker>
          ))}

          {/* My Reviews pin popup */}
          {activeTab === 'my-reviews' && selectedPin && (
            <Popup
              longitude={selectedPin.longitude}
              latitude={selectedPin.latitude}
              anchor="bottom"
              offset={12}
              onClose={() => setSelectedPin(null)}
              closeOnClick={false}
            >
              <div className="p-2 min-w-[180px]">
                <p className="font-semibold text-gray-900 text-sm leading-snug mb-2">
                  {selectedPin.address}
                </p>
                <div className="flex flex-wrap gap-1 mb-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedPin.status === 'draft'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {selectedPin.status === 'draft' ? 'Draft' : 'Submitted'}
                  </span>
                  {selectedPin.jobSize && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {selectedPin.jobSize}
                    </span>
                  )}
                </div>
                {selectedPin.reviewCount != null && selectedPin.reviewCount > 0 && (
                  <p className="text-xs text-gray-400 mb-2">
                    {selectedPin.reviewCount === 1 ? '1 review from contractors' : `${selectedPin.reviewCount} reviews from contractors`}
                  </p>
                )}
                <button
                  onClick={() =>
                    selectedPin.status === 'draft'
                      ? router.push(`/property/${selectedPin.propertyId}/review?draftId=${selectedPin.reviewId}`)
                      : router.push(`/property/${selectedPin.propertyId}`)
                  }
                  className="w-full py-1.5 px-3 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  {selectedPin.status === 'draft' ? 'Resume' : 'View'}
                </button>
              </div>
            </Popup>
          )}

          {/* Explore search result marker + popup */}
          {activeTab === 'explore' && exploreResult && (
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
                      Parcel data not available for this address. Try a nearby address or search by parcel number.
                    </p>
                  )}
                </div>
              </Popup>
            </>
          )}
        </Map>
      </div>

      {/* ── Slide-up panel ── */}
      <div
        className="fixed inset-x-0 top-0 bottom-0 bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          zIndex: 10,
          transform: `translateY(${currentOffset}px)`,
          transition: isAnimating
            ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
            : 'none',
          willChange: 'transform',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          role="button"
          aria-label="Drag to resize panel"
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Tab bar — FIX 5: onClick uses handleTabSwitch */}
        <div className="flex-shrink-0 flex border-b border-gray-100">
          <button
            onClick={() => handleTabSwitch('my-reviews')}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'my-reviews'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Reviews
          </button>
          <button
            onClick={() => handleTabSwitch('explore')}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'explore'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Explore
          </button>
        </div>

        {/* Scrollable content — explicit height so overflow-y-auto works at all panel snap states */}
        <div
          className="overflow-y-auto overscroll-contain"
          style={{ height: Math.max(0, wh.current - currentOffset - DRAG_H - TAB_BAR_H) }}
        >
          {activeTab === 'my-reviews' ? (
            <MyReviewsTab
              drafts={drafts}
              submitted={submitted}
              onDraftTap={pin => router.push(`/property/${pin.propertyId}/review?draftId=${pin.reviewId}`)}
              onSubmittedTap={pin => router.push(`/property/${pin.propertyId}`)}
            />
          ) : (
            <ExploreTab
              mapRef={mapRef}
              result={exploreResult}
              onResult={r => {
                setExploreResult(r)
                if (r !== null) setPanelState('collapsed')
              }}
            />
          )}
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
          Start your first review — search for a property or tap the map.
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
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Drafts
            </h3>
          </div>
          {drafts.map(pin => {
            const days = staleDays(pin.lastEditedAt, pin.createdAt)
            const stale = days > 30
            return (
              <button
                key={pin.reviewId}
                onClick={() => onDraftTap(pin)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50"
              >
                <div
                  className="flex-shrink-0 rounded-full"
                  style={{ width: 10, height: 10, backgroundColor: DRAFT_PIN_COLOR, marginTop: 4 }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {pin.address}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <JobBadge size={pin.jobSize} />
                    {stale ? (
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-full font-medium">
                        Stale — {days}d ago
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Edited {fmtDate(pin.lastEditedAt ?? pin.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 gap-0.5" style={{ marginTop: 2 }}>
                  {pin.reviewCount != null && pin.reviewCount > 0 && (
                    <span className="text-xs text-gray-400">
                      {pin.reviewCount === 1 ? '1 review' : `${pin.reviewCount} reviews`}
                    </span>
                  )}
                  <span className="text-gray-300 text-xl leading-none" aria-hidden>›</span>
                </div>
              </button>
            )
          })}
        </>
      )}

      {/* Submitted section */}
      {submitted.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-1.5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Submitted
            </h3>
          </div>
          {submitted.map(pin => (
            <button
              key={pin.reviewId}
              onClick={() => onSubmittedTap(pin)}
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50"
            >
              <div
                className="flex-shrink-0 rounded-full"
                style={{ width: 10, height: 10, backgroundColor: SUBMITTED_PIN_COLOR, marginTop: 4 }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {pin.address}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <JobBadge size={pin.jobSize} />
                  <Stars rating={pin.overallRating} />
                  <span className="text-xs text-gray-400">
                    {fmtDate(pin.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 gap-0.5" style={{ marginTop: 2 }}>
                {pin.reviewCount != null && pin.reviewCount > 0 && (
                  <span className="text-xs text-gray-400">
                    {pin.reviewCount === 1 ? '1 review' : `${pin.reviewCount} reviews`}
                  </span>
                )}
                <span className="text-gray-300 text-xl leading-none" aria-hidden>›</span>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Explore tab ──────────────────────────────────────────────────────────────

function ExploreTab({
  mapRef,
  result,
  onResult,
}: {
  mapRef: React.RefObject<MapRef | null>
  result: ExploreResult | null
  onResult: (r: ExploreResult | null) => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [mismatch, setMismatch] = useState<MismatchResult | null>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([])
  const selectedRef = useRef(false)

  useEffect(() => {
    const loadRecent = async () => {
      const { data } = await supabase
        .from('recently_viewed')
        .select('property_id, last_viewed_at, properties!inner(address_full)')
        .order('last_viewed_at', { ascending: false })
        .limit(10)

      if (!data || data.length === 0) return

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

      // Delete stale entries client-side (fire-and-forget)
      const hasStale = data.some((r: any) => r.last_viewed_at < thirtyDaysAgo)
      if (hasStale) {
        supabase.from('recently_viewed').delete().lt('last_viewed_at', thirtyDaysAgo)
      }

      const fresh = (data as any[]).filter(r => r.last_viewed_at >= thirtyDaysAgo)
      if (fresh.length === 0) return

      // Fetch review counts separately
      const propIds = fresh.map((r: any) => r.property_id)
      const countMap: Record<string, number> = {}
      const { data: ppData } = await supabase
        .from('property_profiles')
        .select('property_id, review_count')
        .in('property_id', propIds)
      if (ppData) {
        ppData.forEach((pp: any) => { countMap[pp.property_id] = pp.review_count ?? 0 })
      }

      setRecentlyViewed(fresh.map((r: any) => ({
        propertyId: r.property_id,
        address: r.properties.address_full,
        reviewCount: countMap[r.property_id] ?? null,
        lastViewedAt: r.last_viewed_at,
      })))
    }
    loadRecent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runGeocoding = useCallback(async (q: string) => {
    try {
      const url = new URL('https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(q) + '.json')
      url.searchParams.set('access_token', token)
      url.searchParams.set('types', 'address')
      url.searchParams.set('country', 'US')
      url.searchParams.set('bbox', '-122.5434,47.1842,-121.3046,47.7776')
      url.searchParams.set('proximity', '-122.0651,47.4502')
      url.searchParams.set('autocomplete', 'true')
      url.searchParams.set('fuzzy_match', 'false')
      url.searchParams.set('limit', '10')
      const res = await fetch(url.toString())
      const data = await res.json()
      if (data.features) {
        const houseNum = q.match(/^\d+/)?.[0]
        const filtered = (data.features as GeocodeSuggestion[]).filter(f => {
          // Must start with the typed house number (eliminates partial/positional matches)
          if (houseNum && !f.place_name.startsWith(houseNum)) return false
          // Must have a street component (first segment must contain a space after the number)
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

  const handleSearchNow = () => {
    if (selectedRef.current) return
    if (query.trim().length < 2) return
    runGeocoding(query)
  }

  // Debounced geocoding — gated after selection until user types a new address
  // Stage 1: pure digits (no space yet) → suppress; Stage 2: digits+space+street → fire
  useEffect(() => {
    if (selectedRef.current) return
    const trimmed = query.trim()
    if (!/^\d+\s+\S/.test(trimmed)) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(() => runGeocoding(query), 300)
    return () => clearTimeout(timer)
  }, [query, runGeocoding])

  const handleSelect = async (suggestion: GeocodeSuggestion) => {
    const mapboxLng = suggestion.center[0]
    const mapboxLat = suggestion.center[1]
    const shortAddress = suggestion.place_name.split(',')[0]
    // Preserve user's typed query — KC uses abbreviated forms (SE 32ND ST) while
    // Mapbox spells them out (Southeast 32nd Street)
    const originalQuery = query

    selectedRef.current = true
    setSuggestions([])
    setQuery(shortAddress)
    setError('')
    setMismatch(null)
    setSearching(true)

    // Do NOT fly or place a marker until KC confirms a real parcel

    try {
      const searchRes = await fetch(
        `/api/property/search?address=${encodeURIComponent(originalQuery)}`
      )
      const searchData = searchRes.ok ? await searchRes.json() : null
      const property = searchData?.property ?? searchData?.properties?.[0]

      // Case 1 — no parcel found
      if (!searchRes.ok || !searchData || !property) {
        setError('No parcel found for this address. Try searching for a nearby address or a different street number.')
        setSearching(false)
        return
      }

      const kcLat = property.latitude ? Number(property.latitude) : mapboxLat
      const kcLng = property.longitude ? Number(property.longitude) : mapboxLng
      const kcAddress = property.address_full || shortAddress

      // House number mismatch check — >20% difference flags a wrong parcel
      const searchedNum = parseInt(shortAddress.match(/^\d+/)?.[0] ?? '0', 10)
      const kcNum = parseInt(kcAddress.match(/^\d+/)?.[0] ?? '0', 10)
      const isMismatch = searchedNum > 0 && kcNum > 0 &&
        Math.abs(searchedNum - kcNum) / Math.max(searchedNum, kcNum) > 0.2

      // Case 2 — KC returned a parcel but at a different address
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

      // Case 3 — KC confirmed a real parcel at or near the searched address
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

      // Place marker and collapse panel first, then fly after collapse animation (300ms)
      onResult({
        address: kcAddress,
        latitude: kcLat,
        longitude: kcLng,
        propertyId: cacheData.id ?? null,
        loading: false,
        reviewCount,
      })
      setTimeout(() => {
        mapRef.current?.flyTo({ center: [kcLng, kcLat], zoom: 17, duration: 800 })
      }, 300)
    } catch (err) {
      console.error('[Explore KC error]', err)
      setError('Search failed. Please try again.')
    }

    setSearching(false)
  }

  return (
    <div className="px-4 pt-4">

      {/* Search input */}
      <div className="relative mb-3">
        <input
          type="text"
          value={query}
          onChange={e => {
            selectedRef.current = false
            setQuery(e.target.value)
            if (!e.target.value.trim()) onResult(null)
          }}
          onKeyDown={e => { if (e.key === 'Enter') handleSearchNow() }}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Search an address..."
          className="w-full pl-3 pr-20 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute right-0 inset-y-0 flex items-center">
          {/* X clear button */}
          {query.length > 0 && (
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                selectedRef.current = false
                setQuery('')
                setSuggestions([])
                onResult(null)
              }}
              style={{ width: 36, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          )}
          {/* Search / spinner button */}
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={handleSearchNow}
            disabled={searching}
            style={{ width: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}
          >
            {searching
              ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.75"/><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Helper text */}
      {inputFocused && suggestions.length === 0 && (
        /^\d+\s*$/.test(query.trim()) && query.trim().length > 0
          ? <p className="text-xs text-gray-400 mb-3 -mt-1 px-1">Add a street name to search</p>
          : !/^\d+\s+\S/.test(query.trim())
            ? <p className="text-xs text-gray-400 mb-3 -mt-1 px-1">Enter a house number and street name to search</p>
            : null
      )}

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 shadow-sm">
          {suggestions.map((s, i) => {
            const parts = s.place_name.split(', ')
            // Primary: street address + city (e.g. "41235 SE 123rd Street, North Bend")
            const primary = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0]
            // Secondary: state + zip abbreviated (e.g. "WA 98045"), never show "United States"
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
                className="w-full text-left px-4 border-b last:border-0 border-gray-100 hover:bg-blue-50 transition-colors"
                style={{ minHeight: 48, paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
              >
                <div className="text-sm font-medium text-gray-800">{primary}</div>
                {secondary && <div className="text-xs text-gray-400 mt-0.5">{secondary}</div>}
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mb-3 mt-1">{error}</p>
      )}

      {/* Mismatch confirmation — KC returned a nearby but different parcel */}
      {mismatch && !searching && (
        <div className="mb-4 mt-1 px-3 py-3 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-sm text-gray-800 leading-snug mb-3">
            Exact address not found. Nearest parcel is{' '}
            <span className="font-medium">{mismatch.kcAddress}</span> — is this the property you are looking for?
          </p>
          <div className="flex gap-2">
            {mismatch.propertyId && (
              <button
                onClick={() => router.push(`/property/${mismatch.propertyId!}`)}
                className="flex-1 py-2 px-3 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Yes, view this property
              </button>
            )}
            <button
              onClick={() => {
                setMismatch(null)
                selectedRef.current = false
              }}
              className={`${mismatch.propertyId ? 'flex-1' : 'w-full'} py-2 px-3 bg-white text-gray-600 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50 transition-colors`}
            >
              No, search again
            </button>
          </div>
        </div>
      )}

      {/* Inline result confirmation (mirrors the map popup) */}
      {result && !result.loading && !suggestions.length && (
        <div className="mb-4 mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-lg">
          <p className="text-sm font-medium text-gray-800 truncate">{result.address}</p>
          {result.propertyId ? (
            <>
              <p className="mt-0.5 text-xs text-gray-400">
                {result.reviewCount != null && result.reviewCount > 0
                  ? (result.reviewCount === 1
                      ? '1 review from contractors'
                      : `${result.reviewCount} reviews from contractors`)
                  : 'No contractor reviews yet'}
              </p>
              <button
                onClick={() => router.push(`/property/${result.propertyId!}`)}
                className="mt-1.5 text-xs text-blue-600 font-medium hover:underline"
              >
                View property profile →
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs text-gray-400">
              Parcel data not available for this address. Try a nearby address or search by parcel number.
            </p>
          )}
        </div>
      )}

      {/* Recently Viewed */}
      <div className="mb-5 mt-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Recently Viewed
        </h3>
        {recentlyViewed.length === 0 ? (
          <p className="text-sm text-gray-400">Properties you visit will appear here.</p>
        ) : (
          <div>
            {recentlyViewed.map(item => (
              <button
                key={item.propertyId}
                onClick={() => router.push(`/property/${item.propertyId}`)}
                className="w-full text-left py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-0"
              >
                <p className="text-sm font-medium text-gray-900 truncate">{item.address}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">Visited {fmtDate(item.lastViewedAt)}</span>
                  {item.reviewCount != null && item.reviewCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                      {item.reviewCount === 1 ? '1 review' : `${item.reviewCount} reviews`}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Aggregate pins toggle — coming soon */}
      <div className="flex items-center justify-between py-3 border-t border-gray-100">
        <span className="text-sm text-gray-400">
          Show all reviewed properties on map
        </span>
        <span className="text-xs text-gray-300 font-medium select-none">
          Coming soon
        </span>
      </div>

    </div>
  )
}
