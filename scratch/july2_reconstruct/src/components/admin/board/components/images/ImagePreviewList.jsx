import React from 'react';
import PropTypes from 'prop-types';
import { ZoomIn, Trash2 } from 'lucide-react';

const ImagePreviewList = ({
    existingImages,
    selectedFiles,
    onDragStart,
    onDrop,
    onDragOver,
    onDeleteExisting,
    onDeleteSelected,
    onEditSelected
}) => {
    if (existingImages.length === 0 && selectedFiles.length === 0) return null;

    return (
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {existingImages.map((url, idx) => (
                <div 
                    key={`exist-${idx}`} 
                    draggable
                    onDragStart={(e) => onDragStart(e, idx, 'existing')}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, idx, 'existing')}
                    className="relative w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden group shrink-0 shadow-sm border border-gray-100 cursor-move"
                >
                    <img src={url} alt={`existing-${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); onDeleteExisting(idx); }} 
                            className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition shadow-lg transform hover:scale-105"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
            
            {selectedFiles.map((file, idx) => (
                <div 
                    key={file.id} 
                    draggable
                    onDragStart={(e) => onDragStart(e, idx, 'selected')}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, idx, 'selected')}
                    className="relative w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden group shrink-0 shadow-sm border border-gray-100 cursor-move"
                >
                    <img src={file.preview} alt="preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); onEditSelected(idx); }} 
                            className="p-2 bg-white text-gray-800 rounded-xl hover:bg-gray-100 transition shadow-lg transform hover:scale-105"
                        >
                            <ZoomIn size={16} />
                        </button>
                        <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); onDeleteSelected(idx); }} 
                            className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition shadow-lg transform hover:scale-105"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

ImagePreviewList.propTypes = {
    existingImages: PropTypes.array.isRequired,
    selectedFiles: PropTypes.array.isRequired,
    onDragStart: PropTypes.func.isRequired,
    onDrop: PropTypes.func.isRequired,
    onDragOver: PropTypes.func.isRequired,
    onDeleteExisting: PropTypes.func.isRequired,
    onDeleteSelected: PropTypes.func.isRequired,
    onEditSelected: PropTypes.func.isRequired
};

export default React.memo(ImagePreviewList);
