import { supabase } from '../supabaseClient';

const missingRpc = error => ['42883', 'PGRST202'].includes(error?.code);

const callRpc = async (name, args, fallback) => {
    const { data, error } = await supabase.rpc(name, args);
    if (!error) return data;
    if (fallback && missingRpc(error)) return fallback();
    throw error;
};

export const dmApi = {
    async fetchPushPreferences(userId) {
        const { data, error } = await supabase.from('dm_push_preferences')
            .select('enabled,preview_enabled,group_enabled').eq('user_id', userId).maybeSingle();
        if (error && !['42P01', 'PGRST205'].includes(error?.code)) throw error;
        return data || { enabled: true, preview_enabled: false, group_enabled: true };
    },

    async savePushPreferences(userId, preferences) {
        const row = {
            user_id: userId,
            enabled: Boolean(preferences.enabled),
            preview_enabled: Boolean(preferences.preview_enabled),
            group_enabled: Boolean(preferences.group_enabled),
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('dm_push_preferences')
            .upsert(row, { onConflict: 'user_id' })
            .select('enabled,preview_enabled,group_enabled').single();
        if (error) throw error;
        return data;
    },

    async fetchConversations(userId) {
        const { data, error } = await supabase
            .from('dm_participant_memberships')
            .select('id,joined_at,last_read_at,display_title,conversation:dm_conversations!inner(id,kind,title,status,created_at,last_message_at),user:users!dm_participant_memberships_user_id_fkey(id,name,school,profile_image_url)')
            .eq('user_id', userId)
            .is('left_at', null)
            .eq('conversation.status', 'ACTIVE')
            .order('last_message_at', { referencedTable: 'dm_conversations', ascending: false, nullsFirst: false });
        if (error) throw error;

        return Promise.all((data || []).map(async membership => {
            const conversationId = membership.conversation.id;
            const [{ data: participants }, { data: messages }] = await Promise.all([
                supabase.from('dm_participant_memberships')
                    .select('id,user_id,joined_at,left_at,joined_as_staff,user:users!dm_participant_memberships_user_id_fkey(id,name,school,profile_image_url,gender,birth)')
                    .eq('conversation_id', conversationId),
                supabase.from('dm_messages')
                    .select('id,sender_id,message_type,content,created_at,revoked_at')
                    .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1),
            ]);
            const last = messages?.[0] || null;
            const { count } = await supabase.from('dm_messages').select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversationId).in('message_type', ['TEXT', 'IMAGE']).is('revoked_at', null)
                .neq('sender_id', userId).gt('created_at', membership.last_read_at || membership.joined_at);
            return { ...membership.conversation, membership, participants: participants || [], lastMessage: last, unreadCount: count || 0 };
        }));
    },

    async fetchMessages(conversationId, before = null) {
        let query = supabase.from('dm_messages')
            .select('*,sender:users!dm_messages_sender_id_fkey(id,name,profile_image_url),reactions:dm_message_reactions(id,user_id,emoji,user:users!dm_message_reactions_user_id_fkey(id,name))')
            .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(50);
        if (before) query = query.lt('created_at', before);
        const { data, error } = await query;
        if (error) throw error;
        const rows = (data || []).reverse();
        return Promise.all(rows.map(async message => {
            if (message.message_type !== 'IMAGE' || message.revoked_at || !message.media_path) return message;
            const { data: signed, error: signedError } = await supabase.storage
                .from('dm-media').createSignedUrl(message.media_path, 600);
            if (signedError) return { ...message, media_error: true };
            return { ...message, media_url: signed?.signedUrl || null };
        }));
    },

    async fetchParticipants(conversationId) {
        const { data, error } = await supabase.from('dm_participant_memberships')
            .select('id,user_id,joined_at,joined_as_staff,user:users!dm_participant_memberships_user_id_fkey(id,name,school,profile_image_url,gender,birth)')
            .eq('conversation_id', conversationId).is('left_at', null).order('joined_at');
        if (error) throw error;
        return data || [];
    },

    async fetchCandidates() {
        const { data, error } = await supabase.from('users')
            .select('id,name,school,profile_image_url,user_group,status,role,is_master')
            .neq('status', 'withdrawn').order('name').limit(1000);
        if (error) throw error;
        return data || [];
    },

    createDirect(otherUserId) {
        return callRpc('dm_create_direct', { p_other_user_id: otherUserId });
    },
    startConversation(recipientIds, content) {
        return callRpc('dm_start_conversation', { p_recipient_ids: recipientIds, p_content: content });
    },
    async uploadImage(path, file) {
        const { error } = await supabase.storage.from('dm-media').upload(path, file, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
        });
        if (error) throw error;
        return path;
    },
    async removeUnattachedImage(path) {
        const { error } = await supabase.storage.from('dm-media').remove([path]);
        if (error) throw error;
    },
    sendImage(conversationId, mediaPath, mediaMime, senderId) {
        return callRpc('dm_send_image', {
            p_conversation_id: conversationId,
            p_media_path: mediaPath,
            p_media_mime: mediaMime,
        }, async () => {
            const { data, error } = await supabase.from('dm_messages').insert({
                conversation_id: conversationId,
                sender_id: senderId,
                message_type: 'IMAGE',
                media_path: mediaPath,
                media_mime: mediaMime,
            }).select().single();
            if (error) throw error;
            return data;
        });
    },
    startImageConversation(recipientIds, mediaPath, mediaMime, senderId) {
        return callRpc('dm_start_image_conversation', {
            p_recipient_ids: recipientIds,
            p_media_path: mediaPath,
            p_media_mime: mediaMime,
        }, async () => {
            let conversationId;
            if (recipientIds.length === 1) conversationId = await dmApi.createDirect(recipientIds[0]);
            else {
                const directId = await dmApi.createDirect(recipientIds[0]);
                conversationId = await dmApi.createGroup(directId, recipientIds.slice(1));
            }
            await dmApi.sendImage(conversationId, mediaPath, mediaMime, senderId);
            return conversationId;
        });
    },
    createGroup(sourceConversationId, invitedUserIds, title = null) {
        return callRpc('dm_create_group', { p_source_conversation_id: sourceConversationId, p_invited_user_ids: invitedUserIds, p_title: title });
    },
    invite(conversationId, userId) {
        return callRpc('dm_invite_participant', { p_conversation_id: conversationId, p_user_id: userId });
    },
    send(conversationId, content, senderId) {
        return callRpc('dm_send_message', { p_conversation_id: conversationId, p_content: content }, async () => {
            const { data, error } = await supabase.from('dm_messages').insert({ conversation_id: conversationId, sender_id: senderId, content: content.trim() }).select().single();
            if (error) throw error;
            return data;
        });
    },
    markRead(conversationId) {
        return callRpc('dm_mark_read', { p_conversation_id: conversationId });
    },
    revoke(messageId) {
        return callRpc('dm_revoke_message', { p_message_id: messageId });
    },
    toggleReaction(messageId, emoji) {
        return callRpc('dm_toggle_reaction', { p_message_id: messageId, p_emoji: emoji }, async () => {
            const { data: existing } = await supabase.from('dm_message_reactions').select('id').eq('message_id', messageId).eq('emoji', emoji).maybeSingle();
            if (existing) {
                const { error } = await supabase.from('dm_message_reactions').delete().eq('id', existing.id);
                if (error) throw error;
                return false;
            }
            throw Object.assign(new Error('reaction_rpc_required'), { code: 'DM_RPC_REQUIRED' });
        });
    },
    rename(conversationId, title) {
        return callRpc('dm_rename_group', { p_conversation_id: conversationId, p_title: title });
    },
    leave(conversationId) {
        return callRpc('dm_leave_conversation', { p_conversation_id: conversationId });
    },
    report(conversationId) {
        return callRpc('dm_report_conversation', { p_conversation_id: conversationId });
    },
    async fetchTyping(conversationId, currentUserId) {
        const cutoff = new Date(Date.now() - 5000).toISOString();
        const { data, error } = await supabase.from('dm_typing_states')
            .select('user_id,updated_at,user:users!dm_typing_states_user_id_fkey(id,name)')
            .eq('conversation_id', conversationId).neq('user_id', currentUserId).gt('updated_at', cutoff);
        if (error) throw error;
        return data || [];
    },
    async setTyping(conversationId, userId) {
        const { error } = await supabase.from('dm_typing_states').upsert({ conversation_id: conversationId, user_id: userId, updated_at: new Date().toISOString() });
        if (error) throw error;
    },
    async clearTyping(conversationId, userId) {
        const { error } = await supabase.from('dm_typing_states').delete().eq('conversation_id', conversationId).eq('user_id', userId);
        if (error) throw error;
    },
};
