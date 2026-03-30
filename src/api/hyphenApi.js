import { supabase } from '../supabaseClient';

export const hyphenApi = {
    // ---- Earning & Deducting ----
    async grantProgramReward(userId, noticeId, rewardAmount, adminId, noticeTitle) {
        if (!rewardAmount || rewardAmount <= 0) return;

        // 1. Check if already granted for this specific program (source_id logic or string matching)
        // Since we don't have a source_id column, we match by source_description
        const descMatch = `[프로그램 참여] ${noticeTitle}`;

        const { data: existing, error: checkErr } = await supabase
            .from('hyphen_transactions')
            .select('id')
            .eq('user_id', userId)
            .eq('source_description', descMatch)
            .maybeSingle();

        if (checkErr) throw checkErr;
        
        // If already granted, skip it
        if (existing) return;

        // 2. Insert transaction
        const { error: insertErr } = await supabase
            .from('hyphen_transactions')
            .insert([{
                user_id: userId,
                amount: rewardAmount,
                transaction_type: 'EARN',
                source_description: descMatch,
                admin_id: adminId
            }]);

        if (insertErr) throw insertErr;
    },

    async revokeProgramReward(userId, noticeTitle) {
        const descMatch = `[프로그램 참여] ${noticeTitle}`;
        
        // Find existing EARN transaction for this program and delete it to revoke
        const { error } = await supabase
            .from('hyphen_transactions')
            .delete()
            .eq('user_id', userId)
            .eq('source_description', descMatch)
            .eq('transaction_type', 'EARN');

        if (error) throw error;
    },

    async manualAdjustment(userId, amount, reason, adminId) {
        if (amount === 0) return;
        
        const type = amount > 0 ? 'EARN' : 'SPEND'; // SPEND or MANUAL? MANUAL matches 'EARN' logic but we can just use 'MANUAL' or 'EARN'
        
        const { error } = await supabase
            .from('hyphen_transactions')
            .insert([{
                user_id: userId,
                amount: amount,
                transaction_type: 'MANUAL',
                source_description: `[관리자 수동 조정] ${reason}`,
                admin_id: adminId
            }]);

        if (error) throw error;
    },

    async grantContentVerificationReward(userId, category = '방명록 작성', sourceId = null) {
        const { error } = await supabase
            .from('hyphen_transactions')
            .insert([{
                user_id: userId,
                amount: 1,
                transaction_type: 'EARN',
                source_description: `[콘텐츠 인증] ${category}`,
                source_id: sourceId
            }]);

        if (error) throw error;
    },

    async revokeContentVerificationReward(userId, sourceId, category = null) {
        let query = supabase
            .from('hyphen_transactions')
            .delete()
            .eq('user_id', userId)
            .eq('transaction_type', 'EARN');

        if (sourceId) {
            query = query.eq('source_id', sourceId);
        } else if (category) {
            query = query.like('source_description', `%[콘텐츠 인증] ${category}%`);
        } else {
            query = query.like('source_description', '%[콘텐츠 인증]%');
        }

        // Delete the matching rows (should usually just be 1 if tied to a specific id)
        const { error } = await query;
        if (error && error.code !== 'PGRST116') throw error;
    },

    // ---- Admin Store & Approval Logic ----
    async createOrder(userId, itemId, amount, requiresApproval, itemName) {
        // 1. Insert into store_orders
        const { error: orderError } = await supabase
            .from('store_orders')
            .insert([{
                user_id: userId,
                item_id: itemId,
                amount: amount,
                status: requiresApproval ? 'PENDING' : 'APPROVED'
            }]);

        if (orderError) throw orderError;

        // 2. If it DOES NOT require approval, immediately deduct from balance
        if (!requiresApproval) {
            const { error: deductError } = await supabase
                .from('hyphen_transactions')
                .insert([{
                    user_id: userId,
                    amount: -Math.abs(amount),
                    transaction_type: 'SPEND',
                    source_description: `[스토어 교환] ${itemName}`
                }]);

            if (deductError) throw deductError;
        }
    },

    async getPendingOrders() {
        const { data, error } = await supabase
            .from('store_orders')
            .select(`
                *,
                users (name, school),
                hyphen_items (name, requires_approval)
            `)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    },

    async processOrder(orderId, userId, amount, isApproved, adminId, itemName) {
        const newStatus = isApproved ? 'APPROVED' : 'REJECTED';
        
        // 1. Update order status
        const { error: updateErr } = await supabase
            .from('store_orders')
            .update({ status: newStatus, admin_id: adminId, completed_at: new Date().toISOString() })
            .eq('id', orderId);

        if (updateErr) throw updateErr;

        // 2. If approved, deduct points. (If pending, points weren't deducted yet, or maybe they were locked? Let's deduct on APPROVED).
        if (isApproved) {
            const { error: deductErr } = await supabase
                .from('hyphen_transactions')
                .insert([{
                    user_id: userId,
                    amount: -Math.abs(amount),
                    transaction_type: 'SPEND',
                    source_description: `[스토어 교환] ${itemName}`,
                    admin_id: adminId
                }]);
            
            if (deductErr) throw deductErr;
        }
    },

    // ---- Store Items ----
    async getStoreItems() {
        const { data, error } = await supabase
            .from('hyphen_items')
            .select('*')
            .order('amount', { ascending: true });
        
        if (error) throw error;
        return data;
    }
};
