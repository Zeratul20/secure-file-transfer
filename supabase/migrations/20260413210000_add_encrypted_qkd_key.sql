ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS encrypted_qkd_key TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS sender_encrypted_qkd_key TEXT;
