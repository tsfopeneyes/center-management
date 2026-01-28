import React, { useEffect, useState } from 'react';
import { Trash2, MessageCircle, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import LinkPreview from '../LinkPreview';
import { extractUrls } from '../../utils/linkUtils';

const AdminGuestbook = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [showList, setShowList] = useState(true);

    const fetchPosts = async () => {
        try {
            const { data, error } = await supabase
                .from('guest_posts')
                .select('*, users(name, school)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPosts(data || []);
        } catch (error) {
            console.error('Error fetching guest posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const deletePost = async (postId) => {
        if (!confirm('이 방명록 글을 삭제하시겠습니까? (댓글도 함께 삭제됩니다)')) return;

        try {
            const { error } = await supabase.from('guest_posts').delete().eq('id', postId);
            if (error) throw error;
            alert('삭제되었습니다.');
            fetchPosts();
            if (selectedPost?.id === postId) setSelectedPost(null);
        } catch (error) {
            alert('삭제 실패: ' + error.message);
        }
    };

    const deleteComment = async (commentId) => {
        if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('guest_comments').delete().eq('id', commentId);
            if (error) throw error;
            fetchComments(selectedPost.id);
        } catch (error) {
            alert('댓글 삭제 실패: ' + error.message);
        }
    };

    const fetchComments = async (postId) => {
        try {
            const { data } = await supabase
                .from('guest_comments')
                .select('*, users(name)')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });
            setComments(data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const openPostDetail = (post) => {
        setSelectedPost(post);
        fetchComments(post.id);
        if (window.innerWidth < 1024) {
            setShowList(false);
        }
    };

    const handleBackToList = () => {
        setShowList(true);
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    if (loading) return <div className="text-center py-10 text-gray-400">로딩 중...</div>;

    return (
        <div className="flex gap-4 md:gap-6 h-[calc(100vh-140px)] relative">
            {/* Post List */}
            <div className={`
                ${showList ? 'flex' : 'hidden'} 
                lg:flex flex-col ${selectedPost ? 'lg:w-1/2' : 'w-full'} 
                bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300
            `}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="font-bold text-base md:text-lg text-gray-800">방명록 목록 ({posts.length})</h2>
                    <button onClick={fetchPosts} className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-lg transition">새로고침</button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
                    {posts.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 text-sm">등록된 방명록 글이 없습니다.</div>
                    ) : (
                        posts.map(post => (
                            <div
                                key={post.id}
                                onClick={() => openPostDetail(post)}
                                className={`p-3 md:p-4 rounded-xl border cursor-pointer transition relative group ${selectedPost?.id === post.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500">
                                            {post.users?.name?.[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-xs md:text-sm text-gray-800">{post.users?.name}</p>
                                            <p className="text-[9px] md:text-[10px] text-gray-400">{new Date(post.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deletePost(post.id); }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <p className="text-xs md:text-sm text-gray-600 line-clamp-2 leading-relaxed">{post.content}</p>
                                {post.image_url && (
                                    <div className="mt-2 h-16 w-16 md:h-20 md:w-20 rounded-lg overflow-hidden border border-gray-100 ring-1 ring-gray-100">
                                        <img src={post.image_url} alt="thumbnail" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Detail View */}
            {selectedPost && (
                <div className={`
                    ${!showList ? 'flex' : 'hidden'} 
                    lg:flex flex-col lg:w-1/2 bg-white rounded-2xl shadow-sm border border-gray-100 animate-fade-in overflow-hidden
                `}>
                    <div className="p-3 md:p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                            <button onClick={handleBackToList} className="lg:hidden p-2 -ml-1 text-gray-500 hover:bg-gray-50 rounded-lg">
                                <ArrowLeft size={20} />
                            </button>
                            <h2 className="font-bold text-base md:text-lg text-gray-800">상세보기</h2>
                        </div>
                        <button onClick={() => setSelectedPost(null)} className="hidden lg:block p-2 hover:bg-gray-100 rounded-full transition">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 md:p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center text-base md:text-lg font-bold text-blue-600 ring-2 ring-white shadow-sm">
                                {selectedPost.users?.name?.[0]}
                            </div>
                            <div>
                                <p className="font-bold text-base md:text-lg text-gray-900 leading-tight">{selectedPost.users?.name}</p>
                                <p className="text-xs md:text-sm text-gray-500">{selectedPost.users?.school}</p>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{new Date(selectedPost.created_at).toLocaleString()}</p>
                            </div>
                        </div>

                        <p className="text-sm md:text-base text-gray-800 whitespace-pre-wrap leading-relaxed mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
                            {selectedPost.content}
                            {extractUrls(selectedPost.content).map((url, i) => (
                                <LinkPreview key={i} url={url} size="small" />
                            ))}
                        </p>

                        {selectedPost.image_url && (
                            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-md mb-8 ring-1 ring-gray-100">
                                <img src={selectedPost.image_url} alt="Post" className="w-full" />
                            </div>
                        )}

                        {/* Comments */}
                        <div className="border-t border-gray-100 pt-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <MessageCircle size={18} className="text-blue-500" />
                                댓글 ({comments.length})
                            </h3>
                            <div className="space-y-3">
                                {comments.length === 0 ? (
                                    <p className="text-xs md:text-sm text-gray-400 py-4 text-center">댓글이 없습니다.</p>
                                ) : (
                                    comments.map(comment => (
                                        <div key={comment.id} className="bg-gray-50 p-3 rounded-2xl flex justify-between group border border-gray-100/50">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-xs md:text-sm text-gray-800">{comment.users?.name}</span>
                                                    <span className="text-[9px] md:text-[10px] text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
                                                </div>
                                                <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{comment.content}</p>
                                            </div>
                                            <button
                                                onClick={() => deleteComment(comment.id)}
                                                className="self-start text-gray-300 hover:text-red-500 transition p-1"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                        <button
                            onClick={() => deletePost(selectedPost.id)}
                            className="w-full md:w-auto bg-white border border-red-100 text-red-500 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Trash2 size={16} /> 원본 글 삭제
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminGuestbook;
