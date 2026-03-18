import { supabase } from '../supabaseClient';

export const noticesApi = {
    async fetchAll() {
        const { data, error } = await supabase
            .from('notices')
            .select('*')
            .order('is_sticky', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async fetchResponses(userId) {
        const { data, error } = await supabase
            .from('notice_responses')
            .select('notice_id, status')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
    },

    async upsertResponse(noticeId, userId, status) {
        const { error } = await supabase
            .from('notice_responses')
            .upsert(
                { notice_id: noticeId, user_id: userId, status: status },
                { onConflict: 'notice_id, user_id' }
            );
        if (error) throw error;
    },

    async deleteResponse(noticeId, userId) {
        const { error } = await supabase
            .from('notice_responses')
            .delete()
            .eq('notice_id', noticeId)
            .eq('user_id', userId);
        if (error) throw error;
    },

    async getJoinCount(noticeId) {
        const { count, error } = await supabase
            .from('notice_responses')
            .select('*', { count: 'exact', head: true })
            .eq('notice_id', noticeId)
            .eq('status', 'JOIN');
        if (error) throw error;
        return count;
    },

    async fetchAllJoinCounts() {
        const { data, error } = await supabase
            .from('notice_responses')
            .select('notice_id')
            .eq('status', 'JOIN');
        if (error) throw error;

        const countsMap = {};
        data?.forEach((r) => {
            countsMap[r.notice_id] = (countsMap[r.notice_id] || 0) + 1;
        });
        return countsMap;
    },

    async promoteFromWaitlist(noticeId) {
        // 1. Get the first person in waitlist (oldest first)
        const { data: nextInLine, error: fetchError } = await supabase
            .from('notice_responses')
            .select('user_id, notices(title)')
            .eq('notice_id', noticeId)
            .eq('status', 'WAITLIST')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (fetchError || !nextInLine) return null;

        // 2. Promote to JOIN
        const { error: updateError } = await supabase
            .from('notice_responses')
            .update({ status: 'JOIN' })
            .eq('notice_id', noticeId)
            .eq('user_id', nextInLine.user_id);

        if (updateError) throw updateError;

        // 3. Send Notification Message
        try {
            const admin = JSON.parse(localStorage.getItem('admin_user'));
            const adminId = admin?.id || 'd3885f86-f127-448c-8517-578964d509f7'; // Fallback to a known UUID if possible, or just use system-like id

            await supabase.from('messages').insert([{
                sender_id: adminId, // System/Admin message
                receiver_id: nextInLine.user_id,
                content: `[알림] 대기 중이던 프로그램 '${nextInLine.notices?.title || '신청하신 프로그램'}'의 자리가 생겨 참석으로 전환되었습니다! 축하드려요! 🎉`,
                is_read: false
            }]);
        } catch (msgErr) {
            console.error('Failed to send promotion notification:', msgErr);
        }

        return nextInLine.user_id;
    },

    async update(id, updates) {
        const { error } = await supabase
            .from('notices')
            .update(updates)
            .eq('id', id);
        if (error) throw error;
    },

    async delete(id) {
        const { error } = await supabase
            .from('notices')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async create(notice) {
        const { data, error } = await supabase
            .from('notices')
            .insert([notice])
            .select();
        if (error) throw error;
        return data[0];
    },

    async updateProgramStatus(noticeId, status) {
        const { error } = await supabase
            .from('notices')
            .update({ program_status: status })
            .eq('id', noticeId);
        if (error) throw error;
    },

    async updateAttendance(noticeId, userId, isAttended) {
        const { error } = await supabase
            .from('notice_responses')
            .update({ is_attended: isAttended })
            .eq('notice_id', noticeId)
            .eq('user_id', userId);
        if (error) throw error;
    },

    async markAllAttended(noticeId) {
        const { error } = await supabase
            .from('notice_responses')
            .update({ is_attended: true })
            .eq('notice_id', noticeId)
            .eq('status', 'JOIN');
        if (error) throw error;
    },

    async searchUsers(query) {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, school, phone_back4')
            .or(`name.ilike.%${query}%,phone_back4.ilike.%${query}%`)
            .limit(10);
        if (error) throw error;
        return data;
    },

    // Polling API
    async upsertPollVote(noticeId, userId, optionIds) {
        if (!Array.isArray(optionIds)) {
            optionIds = [optionIds];
        }

        // Delete existing votes for this user on this notice
        const { error: deleteError } = await supabase
            .from('notice_poll_responses')
            .delete()
            .eq('notice_id', noticeId)
            .eq('user_id', userId);
        
        if (deleteError) throw deleteError;

        if (optionIds.length === 0) return;

        // Insert new votes
        const inserts = optionIds.map(optId => ({
            notice_id: noticeId,
            user_id: userId,
            option_id: optId
        }));

        const { error: insertError } = await supabase
            .from('notice_poll_responses')
            .insert(inserts);

        if (insertError) throw insertError;
    },

    async fetchPollResponses(noticeId) {
        const { data, error } = await supabase
            .from('notice_poll_responses')
            .select('user_id, option_id, users(id, name, school)')
            .eq('notice_id', noticeId);
        if (error) throw error;
        return data;
    },

    async getUserPollVote(noticeId, userId) {
        const { data, error } = await supabase
            .from('notice_poll_responses')
            .select('option_id')
            .eq('notice_id', noticeId)
            .eq('user_id', userId);
        if (error) throw error;
        return data.map(row => row.option_id);
    }
};
