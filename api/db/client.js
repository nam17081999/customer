import { supabase } from '@/lib/supabaseClient'

export const db = {
  from: (table) => supabase.from(table),
  rpc: (fnName, args) => supabase.rpc(fnName, args),
  channel: (name) => supabase.channel(name),
  removeChannel: (channel) => supabase.removeChannel(channel),
}
