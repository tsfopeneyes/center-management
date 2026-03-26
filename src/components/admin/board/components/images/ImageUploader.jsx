import React from 'react';
import PropTypes from 'prop-types';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { MAX_IMAGES } from '../../utils/constants';

const ImageUploader = ({ onDrop, currentCount }) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
        multiple: true
    });

    const remainingSlots = MAX_IMAGES - currentCount;

    return (
        <div 
            {...getRootProps()} 
            className={`w-full p-8 md:p-12 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[160px] 
            ${isDragActive ? 'border-blue-500 bg-blue-50 scale-[0.99] shadow-inner' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}`}
        >
            <input {...getInputProps()} />
            <div className={`p-4 rounded-full mb-3 transition-colors ${isDragActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                <UploadCloud size={32} />
            </div>
            {isDragActive ? (
                <p className="font-bold text-blue-600">여기에 이미지를 놓으세요!</p>
            ) : (
                <div className="space-y-1">
                    <p className="font-bold text-gray-700">클릭하거나 이미지를 끌어다 놓으세요</p>
                    <p className="text-sm font-medium text-gray-400">JPG, PNG, GIF, WEBP (최대 {MAX_IMAGES}장)</p>
                    <p className="text-xs font-bold text-blue-500 mt-2 bg-blue-50 px-3 py-1 rounded-full inline-block">
                        {remainingSlots > 0 ? `${remainingSlots}장 더 추가 가능` : '이미지 한도 초과'}
                    </p>
                </div>
            )}
        </div>
    );
};

ImageUploader.propTypes = {
    onDrop: PropTypes.func.isRequired,
    currentCount: PropTypes.number.isRequired
};

export default React.memo(ImageUploader);
