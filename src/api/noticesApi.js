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

            const promoMessage = `🎉 [알림] 대기 중이던 프로그램 '${nextInLine.notices?.title || '신청하신 프로그램'}'의 자리가 생겨 참석으로 자동 전환되었습니다! 축하드려요!`;

            await supabase.from('messages').insert([{
                sender_id: adminId, // System/Admin message
                receiver_id: nextInLine.user_id,
                content: promoMessage,
                is_read: false
            }]);

            await supabase.from('app_notifications').insert([{
                sender_id: adminId,
                target_group: `USER_${nextInLine.user_id}`,
                content: promoMessage
            }]);
        } catch (msgErr) {
            console.error('Failed to send promotion notification:', msgErr);
        }

        return nextInLine.user_id;
    },

    async update(id, updates) {
        const payload = { ...updates };
        delete payload.send_push; // Prevent schema error
        
        const { error } = await supabase
            .from('notices')
            .update(payload)
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
        const payload = { ...notice };
        const shouldSendPush = payload.send_push;
        delete payload.send_push; // Prevent schema error if column doesn't exist
        
        const { data, error } = await supabase
            .from('notices')
            .insert([payload])
            .select();
        if (error) throw error;
        
        // 체크박스 '푸시 알림 발송'이 활성화된 경우에만 푸쉬 전송
        if (shouldSendPush) {
            try {
                const notificationTitle = notice.category === 'PROGRAM' ? '🎯 새 프로그램 안내!' : '📢 새 공지사항!';
                const notificationBody = `[${notice.title}] 등록되었습니다. 앱에서 확인해보세요!`;
                
                const { error: pushError } = await supabase.functions.invoke('send-push', {
                    body: {
                        title: notificationTitle,
                        body: notificationBody
                    }
                });
                if (pushError) console.error("푸쉬 알림 전송 에러:", pushError);

                const adminInfo = JSON.parse(localStorage.getItem('admin_user')) || { id: 'd3885f86-f127-448c-8517-578964d509f7' };
                await supabase.from('app_notifications').insert([{
                    sender_id: adminInfo.id,
                    target_group: '전체',
                    content: notificationBody
                }]);

            } catch (ex) {
                console.error("푸쉬 알림 API 호출 실패:", ex);
            }
        }
        
        return data[0];
    },

    async updateProgramStatus(noticeId, status) {
        const { error } = await supabase
            .from('notices')
            .update({ program_status: status })
            .eq('id', noticeId);
        if (error) throw error;
    },

    async finalizeProgramLogs(noticeId, noticeData) {
        // 1. Get all JOIN responses
        const { data: responses, error: respError } = await supabase
            .from('notice_responses')
            .select('*')
            .eq('notice_id', noticeId)
            .eq('status', 'JOIN');
            
        if (respError) throw respError;
        if (!responses || responses.length === 0) return;

        // 2. Format location_id using pipes: noticeId|title|date|time|location
        const loc = `${noticeId}|${noticeData.title || ''}|${noticeData.program_date || ''}|${noticeData.program_time || ''}|${noticeData.location || ''}`;

        // 3. Delete existing PRG logs for this program to avoid duplicates
        await supabase.from('logs').delete().like('location_id', `${noticeId}|%`);

        // 4. Insert new logs based on attendance
        const logsToInsert = responses.map(r => ({
            user_id: r.user_id,
            type: r.is_attended ? 'PRG_ATTENDED' : 'PRG_ABSENT',
            location_id: loc
        }));

        const { error: insertError } = await supabase.from('logs').insert(logsToInsert);
        if (insertError) throw insertError;
    },

    async revertProgramLogs(noticeId) {
        // Delete all PRG logs for this program since it was reverted to ACTIVE
        const { error } = await supabase.from('logs').delete().like('location_id', `${noticeId}|%`);
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
