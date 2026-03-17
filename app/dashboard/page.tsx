'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import PropertyMap from '@/components/PropertyMap'
import NavBar from '@/components/NavBar'

export default function DashboardPage() {
  const router = useRouter()
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <div style={{ flex: 1 }}>
        <PropertyMap
          height="100%"
          onPropertySelect={(property) => {
            console.log('Selected property:', property)
          }}
        />
      </div>
    </div>
  )
}