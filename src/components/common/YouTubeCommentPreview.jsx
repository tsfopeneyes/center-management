import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ExternalLink, Play, X } from 'lucide-react';
import { getYouTubeEmbedUrl, loadYouTubeMetadata } from '../../utils/youtubePreview';
import { activateYouTubePreview, getActiveYouTubePreview, getServerYouTubePreview, stopYouTubePreview, subscribeYouTubePlayback } from '../../utils/youtubePlayback';

export default function YouTubeCommentPreview({ video }) {
    const cardRef = useRef(null);
    const instanceRef = useRef(Symbol('youtube-comment'));
    const activePreview = useSyncExternalStore(subscribeYouTubePlayback, getActiveYouTubePreview, getServerYouTubePreview);
    const playing = activePreview === instanceRef.current;
    const [embedFailed, setEmbedFailed] = useState(false);
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        const token = instanceRef.current;
        return () => stopYouTubePreview(token);
    }, [video.id, video.url]);

    useEffect(() => {
        let active = true;
        let started = false;
        setMetadata(null);
        setLoading(true);
        setImageFailed(false);
        const load = () => {
            if (started) return;
            started = true;
            loadYouTubeMetadata(video.id).then(data => {
                if (active) { setMetadata(data); setLoading(false); }
            });
        };
        if (typeof IntersectionObserver === 'undefined') {
            load();
            return () => { active = false; };
        }
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
        }, { rootMargin: '200px' });
        if (cardRef.current) observer.observe(cardRef.current);
        return () => { active = false; observer.disconnect(); };
    }, [video.id]);

    const title = metadata?.title || (loading ? '영상 정보 불러오는 중…' : 'YouTube 영상');
    const focusStyle = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
    return <div ref={cardRef} data-comment-interactive className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left ${playing ? 'max-w-md' : 'max-w-sm'}`} onClick={event => event.stopPropagation()}>
        {playing ? <>
            <div className="flex items-center gap-1 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</span>
                <a href={video.url} target="_blank" rel="noopener noreferrer" aria-label="YouTube에서 열기" title="YouTube에서 열기" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 ${focusStyle}`}><ExternalLink size={15} aria-hidden="true"/></a>
                <button type="button" onClick={() => stopYouTubePreview(instanceRef.current)} aria-label="영상 닫기" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 ${focusStyle}`}><X size={18} aria-hidden="true"/></button>
            </div>
            {embedFailed ? <p className="px-3 py-6 text-sm text-slate-600">영상을 불러오지 못했어요. 오른쪽 위 아이콘으로 YouTube에서 열어주세요.</p> : <iframe src={getYouTubeEmbedUrl(video)} title={`${metadata?.title || 'YouTube 영상'} 플레이어`} className="aspect-video min-h-[200px] w-full border-0 bg-black" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={() => setEmbedFailed(true)}/>}
        </> : <>
            <button type="button" aria-label={`${metadata?.title || 'YouTube 영상'} 댓글에서 재생`} onClick={() => { setEmbedFailed(false); activateYouTubePreview(instanceRef.current); }} className={`group flex min-h-20 w-full items-center gap-2.5 p-2 pr-9 text-left transition-colors hover:bg-slate-50 ${focusStyle}`}>
                <span className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-600 sm:h-16 sm:w-24">
                    {!imageFailed && <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="absolute inset-0 h-full w-full object-cover"/>}
                    <span className="relative flex h-6 w-8 items-center justify-center rounded-md bg-red-600 text-white"><Play size={13} fill="currentColor" aria-hidden="true"/></span>
                </span>
                <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-900">{title}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{metadata?.author || 'YouTube'}</span>
                </span>
            </button>
            <a href={video.url} target="_blank" rel="noopener noreferrer" aria-label="YouTube에서 열기" title="YouTube에서 열기" className={`absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${focusStyle}`}><ExternalLink size={14} aria-hidden="true"/></a>
        </>}
    </div>;
}
