import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
    "https://rlodvljtgdnynmgpopth.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_API_KEY
)
