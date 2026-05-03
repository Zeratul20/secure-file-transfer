ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#3b82f6'; -- default blue

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

DO $$
BEGIN
  CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'audio');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.messages 
  ALTER COLUMN receiver_id DROP NOT NULL;

ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups ON DELETE CASCADE;

ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS message_type public.message_type DEFAULT 'text';

ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS media_url TEXT;

ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS media_metadata JSONB;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS message_must_have_recipient_or_group;

ALTER TABLE public.messages
  ADD CONSTRAINT message_must_have_recipient_or_group
  CHECK (
    (receiver_id IS NOT NULL AND group_id IS NULL) OR
    (receiver_id IS NULL AND group_id IS NOT NULL)
  );

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group" ON public.groups;
DROP POLICY IF EXISTS "Creator can update group" ON public.groups;
DROP POLICY IF EXISTS "Creator can delete group" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Creator can insert group members" ON public.group_members;
DROP POLICY IF EXISTS "Creator can delete group members" ON public.group_members;

CREATE POLICY "Members can view group" ON public.groups FOR SELECT
  USING (
    id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Creator can update group" ON public.groups FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Creator can delete group" ON public.groups FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "Users can create groups" ON public.groups FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT
  USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Creator can insert group members" ON public.group_members FOR INSERT
  WITH CHECK (
    group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
  );

CREATE POLICY "Creator can delete group members" ON public.group_members FOR DELETE
  USING (
    group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Messages only viewable by sender or receiver" ON public.messages;
DROP POLICY IF EXISTS "Messages viewable by participants" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;

CREATE POLICY "Messages viewable by participants" ON public.messages FOR SELECT
  USING (
    (receiver_id IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = receiver_id))
    OR
    (group_id IS NOT NULL AND group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'groups'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.groups;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'group_members'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.group_members;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON public.messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);