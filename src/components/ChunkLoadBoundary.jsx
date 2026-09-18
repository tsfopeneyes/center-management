import React from 'react';
import { isMissingChunkError } from '../utils/chunkRecovery';

export default class ChunkLoadBoundary extends React.Component {
    state = { error: null };

    static getDerivedStateFromError(error) { return { error }; }

    componentDidCatch(error) { console.error('Unable to render app screen:', error); }

    render() {
        if (!this.state.error) return this.props.children;
        const missingChunk = isMissingChunkError(this.state.error);
        return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F9FA] px-6 text-center">
            <h1 className="text-xl font-black text-gray-900">{missingChunk ? '새 화면을 불러오지 못했어요' : '화면을 여는 중 문제가 생겼어요'}</h1>
            <p className="text-sm font-medium text-gray-500">페이지를 새로고침하면 다시 이용할 수 있어요.</p>
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[#CF3A27] px-5 py-3 text-sm font-black text-white">새로고침</button>
        </main>;
    }
}
