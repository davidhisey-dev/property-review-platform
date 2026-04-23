import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const now = new Date()

  // Drafts stale > 30 days with no prompt sent yet → send email + mark
  const { data: staleDrafts } = await supabase
    .from('reviews')
    .select('id, user_id, property_id, last_edited_at')
    .eq('status', 'draft')
    .is('stale_prompt_sent_at', null)
    .lt('last_edited_at', new Date(now.getTime() - 30 * 86400000).toISOString())

  for (const draft of staleDrafts ?? []) {
    // TODO: send email via Resend using draft.user_id + draft.property_id
    await supabase
      .from('reviews')
      .update({ stale_prompt_sent_at: now.toISOString() })
      .eq('id', draft.id)
  }

  // Drafts where prompt was sent > 7 days ago and user hasn't snoozed → discard
  const { data: expiredDrafts } = await supabase
    .from('reviews')
    .select('id')
    .eq('status', 'draft')
    .lt('stale_prompt_sent_at', new Date(now.getTime() - 7 * 86400000).toISOString())
    .is('snooze_until', null)

  for (const draft of expiredDrafts ?? []) {
    await supabase
      .from('reviews')
      .update({
        status: 'discarded',
        discarded_at: now.toISOString(),
      })
      .eq('id', draft.id)
  }

  return new Response('OK', { status: 200 })
})
