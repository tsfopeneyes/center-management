import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { isAdminOrStaff } from '../utils/userUtils';

export const useCoffeeChatRealtime = (user, onRequestReceived, onStatusChanged) => {
    useEffect(() => {
        if (!user?.id) return;

        const isStaff = isAdminOrStaff(user);

        let channel;

        if (isStaff) {
            // Staff/Admin listener: Listen for NEW incoming coffee chat requests
            channel = supabase
                .channel('coffee_chats_staff_channel')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'coffee_chats',
                        filter: `staff_id=eq.${user.id}`
                    },
                    (payload) => {
                        if (payload.new && payload.new.status === 'PENDING') {
                            onRequestReceived(payload.new);
                        }
                    }
                )
                .subscribe();
        } else {
            // Student listener: Listen for updates to my requests (Accepted/Rejected)
            channel = supabase
                .channel('coffee_chats_student_channel')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'coffee_chats',
                        filter: `student_id=eq.${user.id}`
                    },
                    (payload) => {
                        if (payload.new && (payload.new.status === 'ACCEPTED' || payload.new.status === 'REJECTED')) {
                            onStatusChanged(payload.new);
                        }
                    }
                )
                .subscribe();
        }

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [user, onRequestReceived, onStatusChanged]);
};
