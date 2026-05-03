import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseKey) {
    console.error("❌ Supabase Key is missing! Check your .env file and ensure it starts with VITE_");
}

export const createClient = () =>
    createSupabaseClient(
        supabaseUrl,
        supabaseKey,
    );

export const supabase = createClient();