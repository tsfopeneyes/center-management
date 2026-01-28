import { supabase } from '../supabaseClient';

export const messagesApi = {
    async fetchInbox(userId) {
        const { data, error } = await supabase
            .from('messages')
            .select('*, sender:sender_id(id)')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async fetchConversations(userId) {
        const { data, error } = await supabase
            .from('messages')
            .select('*, sender:sender_id(id, name, user_group), receiver:receiver_id(id, name, user_group)')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async fetchThread(myId, otherId) {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    },

    async markAsRead(msgId) {
        const { error } = await supabase.from('messages').update({ is_read: true }).eq('id', msgId);
        if (error) throw error;
    },

    async markThreadAsRead(myId, otherId) {
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('receiver_id', myId)
            .eq('sender_id', otherId)
            .eq('is_read', false);
        if (error) throw error;
    },

    async sendMessage(senderId, receiverId, content) {
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                sender_id: senderId,
                receiver_id: receiverId,
                content: content,
                is_read: false
            }])
            .select();
        if (error) throw error;
        return data[0];
    }
};
