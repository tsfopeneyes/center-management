import React from 'react';
import { X } from 'lucide-react';

const ImageOverlayModal = ({ viewerImage, setViewerImage }) => {
    if (!viewerImage) return null;

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4"
            onClick={() => setViewerImage(null)}
        >
            <div className="absolute top-6 right-6 flex gap-4 z-10">
                <button
                    onClick={() => setViewerImage(null)}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all shadow-lg active:scale-95"
                >
                    <X size={24} />
                </button>
            </div>
            
            <img 
                src={viewerImage} 
                alt="Profile View" 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
    );
};

export default ImageOverlayModal;
