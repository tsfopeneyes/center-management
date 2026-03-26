import React from 'react';
import PropTypes from 'prop-types';
import Cropper from 'react-easy-crop';
import { RotateCw, X } from 'lucide-react';

const ImageCropModal = ({
    isOpen,
    imageSrc,
    crop,
    zoom,
    rotation,
    onCropChange,
    onZoomChange,
    onRotationChange,
    onCropComplete,
    onSave,
    onClose
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center p-4 text-white border-b border-white/10 bg-black/50">
                <h3 className="font-bold text-lg tracking-wide">이미지 편집</h3>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition"><X size={24} /></button>
            </div>
            
            <div className="flex-1 relative">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={1}
                    onCropChange={onCropChange}
                    onZoomChange={onZoomChange}
                    onRotationChange={onRotationChange}
                    onCropComplete={onCropComplete}
                    showGrid={true}
                    cropShape="rect"
                />
            </div>
            
            <div className="bg-black/80 p-6 md:p-8 space-y-6 max-w-3xl mx-auto w-full border-t border-white/10 rounded-t-3xl shadow-2xl">
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-white/50 text-xs font-bold mb-2 uppercase tracking-wider">
                            <span>확대/축소</span>
                            <span>{Math.round(zoom * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => onZoomChange(Number(e.target.value))}
                            className="w-full accent-blue-500 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-white/50 text-xs font-bold mb-2 uppercase tracking-wider">
                            <span>회전</span>
                            <span>{rotation}°</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                value={rotation}
                                min={0}
                                max={360}
                                step={1}
                                aria-labelledby="Rotation"
                                onChange={(e) => onRotationChange(Number(e.target.value))}
                                className="w-full accent-blue-500 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                            />
                            <button 
                                onClick={() => onRotationChange((rotation + 90) % 360)}
                                className="p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all shrink-0"
                                title="90도 회전"
                            >
                                <RotateCw size={18} />
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-3 max-w-md mx-auto">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all border border-white/5"
                    >
                        취소
                    </button>
                    <button 
                        onClick={onSave}
                        className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                    >
                        저장하기
                    </button>
                </div>
            </div>
        </div>
    );
};

ImageCropModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    imageSrc: PropTypes.string,
    crop: PropTypes.object.isRequired,
    zoom: PropTypes.number.isRequired,
    rotation: PropTypes.number.isRequired,
    onCropChange: PropTypes.func.isRequired,
    onZoomChange: PropTypes.func.isRequired,
    onRotationChange: PropTypes.func.isRequired,
    onCropComplete: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

export default React.memo(ImageCropModal);
