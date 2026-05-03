ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name TEXT;

UPDATE public.profiles
SET display_name = 
  CASE 
    WHEN username LIKE '%@%' THEN SPLIT_PART(username, '@', 1)
    ELSE username
  END
WHERE display_name IS NULL;

ALTER TABLE public.profiles
ALTER COLUMN display_name SET NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    new.id, 
    new.email,
    SPLIT_PART(new.email, '@', 1)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_display_name(p_user_id UUID, p_display_name TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET display_name = p_display_name
  WHERE id = p_user_id;
  SELECT true;
$$;

CREATE POLICY "Users can update their own display_name" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
