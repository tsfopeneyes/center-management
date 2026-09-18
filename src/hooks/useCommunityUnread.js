import { useEffect, useRef, useState } from 'react';
import { communityFeedApi } from '../api/communityFeedApi';

export default function useCommunityUnread(channelId, userId, posts, postsLoaded) {
    const [lastReadAt, setLastReadAt] = useState(null);
    const [cursorLoaded, setCursorLoaded] = useState(false);
    const markedRef = useRef(false);

    useEffect(() => {
        if (!channelId || !userId) return;
        let active = true;
        markedRef.current = false;
        setCursorLoaded(false);
        setLastReadAt(null);
        communityFeedApi.fetchReadAt(channelId, userId)
            .then(value => { if (active) setLastReadAt(value); })
            .catch(error => console.error('Failed to load community read position:', error))
            .finally(() => { if (active) setCursorLoaded(true); });
        return () => { active = false; };
    }, [channelId, userId]);

    useEffect(() => {
        if (!channelId || !userId || !cursorLoaded || !postsLoaded || markedRef.current) return;
        markedRef.current = true;
        const latestPostAt = posts.reduce((latest, post) =>
            !latest || new Date(post.created_at) > new Date(latest) ? post.created_at : latest, '');
        const readAt = latestPostAt || new Date().toISOString();
        communityFeedApi.markRead(channelId, userId, readAt)
            .catch(error => console.error('Failed to save community read position:', error));
    }, [channelId, cursorLoaded, posts, postsLoaded, userId]);

    return cursorLoaded ? lastReadAt : null;
}
