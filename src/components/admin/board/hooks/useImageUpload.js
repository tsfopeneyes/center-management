import { useState, useCallback } from 'react';
import getCroppedImg from '../../../../utils/imageUtils';
import { MAX_IMAGES } from '../utils/constants';

const useImageUpload = () => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [existingImages, setExistingImages] = useState([]);
    
    // Editor State
    const [showEditor, setShowEditor] = useState(false);
    const [editingFileIndex, setEditingFileIndex] = useState(null);
    const [editorImageSrc, setEditorImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const onDrop = useCallback(acceptedFiles => {
        if (selectedFiles.length + acceptedFiles.length > MAX_IMAGES) {
            alert(`최대 ${MAX_IMAGES}장까지만 업로드 가능합니다.`);
            return;
        }
        const newFiles = acceptedFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            id: Math.random().toString(36).substring(7)
        }));
        setSelectedFiles(prev => [...prev, ...newFiles]);
    }, [selectedFiles]);

    const openEditor = useCallback((index) => {
        setEditingFileIndex(index);
        setEditorImageSrc(selectedFiles[index].preview);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setShowEditor(true);
    }, [selectedFiles]);

    const saveEditedImage = useCallback(async () => {
        try {
            const croppedBlob = await getCroppedImg(editorImageSrc, croppedAreaPixels, rotation);
            const originalName = selectedFiles[editingFileIndex].file.name;
            const newFile = new File([croppedBlob], originalName, { type: 'image/jpeg' });
            const newPreview = URL.createObjectURL(newFile);

            const updated = [...selectedFiles];
            URL.revokeObjectURL(updated[editingFileIndex].preview);
            updated[editingFileIndex] = { ...updated[editingFileIndex], file: newFile, preview: newPreview };
            setSelectedFiles(updated);
            setShowEditor(false);
        } catch (e) {
            console.error(e);
            alert('이미지 저장 실패');
        }
    }, [editorImageSrc, croppedAreaPixels, rotation, selectedFiles, editingFileIndex]);

    const removeFile = useCallback((index) => {
        URL.revokeObjectURL(selectedFiles[index].preview);
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    }, [selectedFiles]);

    const handleDeleteExistingImage = useCallback((index) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    }, []);

    const resetImages = useCallback(() => {
        selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
        setSelectedFiles([]);
        setExistingImages([]);
    }, [selectedFiles]);

    // Drag and Drop for Sorting
    const handleImageDragStart = useCallback((e, index, type) => {
        e.dataTransfer.setData('index', index);
        e.dataTransfer.setData('type', type);
    }, []);

    const handleImageDrop = useCallback((e, dropIndex, dropType) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('index'));
        const dragType = e.dataTransfer.getData('type');
        
        if (dragType !== dropType || isNaN(dragIndex)) return;
        
        if (dragType === 'existing') {
            const newImages = [...existingImages];
            const [draggedItem] = newImages.splice(dragIndex, 1);
            newImages.splice(dropIndex, 0, draggedItem);
            setExistingImages(newImages);
        } else if (dragType === 'selected') {
            const newFiles = [...selectedFiles];
            const [draggedItem] = newFiles.splice(dragIndex, 1);
            newFiles.splice(dropIndex, 0, draggedItem);
            setSelectedFiles(newFiles);
        }
    }, [existingImages, selectedFiles]);

    const handleImageDragOver = useCallback((e) => {
        e.preventDefault();
    }, []);

    return {
        selectedFiles,
        existingImages,
        setExistingImages,
        onDrop,
        openEditor,
        removeFile,
        handleDeleteExistingImage,
        resetImages,
        handleImageDragStart,
        handleImageDrop,
        handleImageDragOver,
        editorState: {
            showEditor, setShowEditor,
            editorImageSrc,
            crop, setCrop,
            zoom, setZoom,
            rotation, setRotation,
            setCroppedAreaPixels,
            saveEditedImage
        }
    };
};

export default useImageUpload;
