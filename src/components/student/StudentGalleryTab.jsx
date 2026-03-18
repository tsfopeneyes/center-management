import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

const StudentGalleryTab = ({
    galleryNotices,
    openNoticeDetail
}) => {
    return (
        <div className="p-2.5 pt-8 pb-32">
            <h1 className="text-3xl font-black text-gray-800 mb-2">스처 갤러리 📸</h1>
            <p className="text-gray-500 text-sm mb-6">우리들의 추억을 모아보세요</p>

            <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
                {galleryNotices.map(n => {
                    const thumb = n.images?.length > 0 ? n.images[0] : n.image_url;
                    if (!thumb) return null;
                    return (
                        <div key={n.id} onClick={() => openNoticeDetail(n, galleryNotices)} className="relative aspect-[4/5] bg-gray-100 overflow-hidden cursor-pointer group rounded-xl border border-gray-100/50">
                            <img src={thumb} alt={n.title} className="w-full h-full object-cover transition duration-300 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                {n.images?.length > 1 && <ImageIcon className="text-white drop-shadow-md" size={20} />}
                            </div>
                        </div>
                    )
                })}
            </div>
            {galleryNotices.length === 0 && <div className="text-center py-20 text-gray-400 text-sm italic">등록된 사진이 없습니다.</div>}
        </div>
    );
};

export default StudentGalleryTab;
