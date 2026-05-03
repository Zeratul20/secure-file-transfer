ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS sender_plaintext_ciphertext TEXT;
