import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Profile = {
  display_name: string
  is_admin: boolean
  is_active: boolean
  license_status: string
}

const PROFILE_KEY = 'userProfile'

export function useProfile() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try cache first
    const cached = sessionStorage.getItem(PROFILE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setTimeout(() => {
          setProfile(parsed)
          setLoading(false)
        }, 0)
      } catch {
        sessionStorage.removeItem(PROFILE_KEY)
      }
    }

    // Always fetch fresh from Supabase to keep cache current
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('users')
        .select('display_name, is_admin, is_active, license_status')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        sessionStorage.setItem(PROFILE_KEY, JSON.stringify(data))
      }
      setLoading(false)
    }

    load()
  }, [router, supabase])

  return { profile, loading }
}