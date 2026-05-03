import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Profile {
    id: string;
    username: string;
    display_name?: string;
    avatar_color?: string;
    pqc_public_key?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Message {
    id: number;
    sender_id: string;
    receiver_id?: string;
    group_id?: string;
    pqc_key_bundle: string;
    aes_iv: string;
    content: string;
    qkd_key_id: string;
    message_type: 'text' | 'image' | 'video' | 'audio';
    media_url?: string;
    media_metadata?: Record<string, any>;
    created_at?: string;
    encrypted_qkd_key?: string;
    sender_encrypted_qkd_key?: string;
    plaintext?: string;
    decryptionFailed?: boolean;
}

export interface Group {
    id: string;
    name: string;
    created_by: string;
    created_at?: string;
    updated_at?: string;
}

export interface GroupMember {
    id: string;
    group_id: string;
    user_id: string;
    joined_at?: string;
}

export interface Conversation {
    id: string;
    type: '1-1' | 'group';
    name: string;
    avatarColor?: string;
    participants: Profile[];
    lastMessage?: Message;
    lastMessageTime?: string;
    isOnline?: boolean;
    unreadCount?: number;
}
