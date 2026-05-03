ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group" ON public.groups;
DROP POLICY IF EXISTS "Creator can update group" ON public.groups;
DROP POLICY IF EXISTS "Creator can delete group" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;

DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Creator can insert group members" ON public.group_members;
DROP POLICY IF EXISTS "Creator can delete group members" ON public.group_members;

DROP POLICY IF EXISTS "Messages viewable by participants" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Messages only viewable by sender or receiver" ON public.messages;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_group_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT group_id FROM public.group_members WHERE user_id = p_user_id
  UNION ALL
  SELECT id FROM public.groups WHERE created_by = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.user_is_group_creator(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT created_by = p_user_id FROM public.groups WHERE id = p_group_id;
$$;

CREATE POLICY "Members can view group" ON public.groups FOR SELECT
  USING (
    public.user_is_group_member(id, auth.uid())
    OR
    created_by = auth.uid()
  );

CREATE POLICY "Creator can update group" ON public.groups FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Creator can delete group" ON public.groups FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "Users can create groups" ON public.groups FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group members can view group members" ON public.group_members FOR SELECT
  USING (
    public.user_is_group_member(group_id, auth.uid())
    OR
    user_id = auth.uid()
  );

CREATE POLICY "Creator can insert group members" ON public.group_members FOR INSERT
  WITH CHECK (
    public.user_is_group_creator(group_id, auth.uid())
  );

CREATE POLICY "Creator can delete group members" ON public.group_members FOR DELETE
  USING (
    public.user_is_group_creator(group_id, auth.uid())
  );

CREATE POLICY "Messages viewable by participants" ON public.messages FOR SELECT
  USING (
    (receiver_id IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = receiver_id))
    OR
    (group_id IS NOT NULL AND public.user_is_group_member(group_id, auth.uid()))
  );

CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

SELECT 'RLS policies fixed - infinite recursion resolved' as status;
