import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../../../../../supabaseClient';
import { noticesApi } from '../../../../../api/noticesApi';
import { CATEGORIES, MAX_IMAGES } from '../../utils/constants';
import { generateProgramInfoHtml, prepareNoticeForEdit, joinDateTime } from '../../utils/noticeHelpers';
import { compressImage } from '../../../../../utils/imageUtils';

// Hooks
import useNoticeForm from '../../hooks/useNoticeForm';
import useImageUpload from '../../hooks/useImageUpload';

// Sections
import BasicInfoSection from './BasicInfoSection';
import ProgramInfoSection from './ProgramInfoSection';
import RecruitmentSection from './RecruitmentSection';
import PollBuilder from './PollBuilder';
import PostSettings from './PostSettings';

// Image Components
import ImageUploader from '../images/ImageUploader';
import ImagePreviewList from '../images/ImagePreviewList';
import ImageCropModal from '../images/ImageCropModal';

const WriteForm = ({ mode, editNoticeId, existingNotice, onSave, onCancel }) => {
    const [isSaving, setIsSaving] = useState(false);

    const {
        formData,
        setFormData,
        updateField,
        resetForm,
        validateForm
    } = useNoticeForm(mode);

    const {
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
        editorState
    } = useImageUpload();

    // Initialize form for editing
    useEffect(() => {
        if (editNoticeId && existingNotice) {
            const prepared = prepareNoticeForEdit(existingNotice);
            setFormData(prepared);
            if (existingNotice.images) {
                setExistingImages(existingNotice.images);
            } else if (existingNotice.image_url) {
                setExistingImages([existingNotice.image_url]);
            }
        }
    }, [editNoticeId, existingNotice, setFormData, setExistingImages]);

    const handleSaveNotice = async (e) => {
        e.preventDefault();

        const validation = validateForm();
        if (!validation.isValid) {
            alert(validation.message);
            return;
        }

        setIsSaving(true);
        try {
            const isProgram = mode === CATEGORIES.PROGRAM;
            let finalContent = formData.content;

            if (isProgram) {
                let validJoinedDate = '';
                const pVal = formData.program_date;
                if (pVal && pVal !== '') {
                    const parsed = new Date(pVal);
                    if (!isNaN(parsed.getTime())) {
                        validJoinedDate = pVal; // e.g. "2024-03-24T14:30"
                    }
                }

                const combinedDateObj = {
                    ...formData,
                    program_date: validJoinedDate

                };
                const infoBlock = generateProgramInfoHtml(combinedDateObj);
                finalContent = infoBlock + finalContent;
            }

            // Image Handle Logic
            const uploadedUrls = [...existingImages];

            // Setup Storage
            if (selectedFiles.length > 0) {
                for (const item of selectedFiles) {
                    const file = item.file;
                    const compressedFile = await compressImage(file);
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('notice-images')
                        .upload(fileName, compressedFile);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('notice-images')
                        .getPublicUrl(fileName);

                    uploadedUrls.push(publicUrl);
                }
            }

            // Handle Poll Images
            const processedPollOptions = [];
            if (formData.is_poll && formData.poll_options) {
                for (let i = 0; i < formData.poll_options.length; i++) {
                    const opt = formData.poll_options[i];
                    let finalUrl = opt.image_url || '';

                    if (opt.imageFile) {
                        const compressedFile = await compressImage(opt.imageFile);
                        const fileExt = opt.imageFile.name.split('.').pop();
                        const fileName = `poll_${Date.now()}_${Math.random()}.${fileExt}`;

                        const { error: uploadError } = await supabase.storage
                            .from('notice-images')
                            .upload(fileName, compressedFile);

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                            .from('notice-images')
                            .getPublicUrl(fileName);
                        
                        finalUrl = publicUrl;
                    }

                    processedPollOptions.push({
                        id: opt.id,
                        title: opt.title,
                        description: opt.description || '',
                        image_url: finalUrl
                    });
                }
            }

            const noticeData = {
                title: formData.title,
                content: finalContent,
                category: mode,
                is_sticky: formData.is_sticky,
                send_push: formData.send_push || false,
                images: uploadedUrls,
                image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : null,
                is_recruiting: formData.is_recruiting,
                recruitment_deadline: (formData.is_recruiting && formData.recruitment_deadline) 
                    ? new Date(formData.recruitment_deadline).toISOString() 
                    : null,
                target_regions: formData.target_regions,
                is_poll: formData.is_poll,
                allow_multiple_votes: formData.is_poll ? formData.allow_multiple_votes : false,
                poll_deadline: (formData.is_poll && formData.poll_deadline) 
                    ? new Date(formData.poll_deadline).toISOString() 
                    : null,
                poll_options: formData.is_poll ? processedPollOptions : []
            };

            if (isProgram) {
                let finalProgramDate = null;
                const pVal = formData.program_date;
                if (pVal && pVal !== '') {
                    const parsedDate = new Date(pVal);
                    if (!isNaN(parsedDate.getTime())) {
                        finalProgramDate = parsedDate.toISOString();
                    }
                }
                noticeData.program_date = finalProgramDate;
                noticeData.program_type = formData.program_type;
                noticeData.max_capacity = formData.max_capacity ? parseInt(formData.max_capacity) : null;
                noticeData.is_leader_only = formData.is_leader_only;
                noticeData.hyphen_reward = formData.hyphen_reward ? parseInt(formData.hyphen_reward, 10) : 0;

                if (!editNoticeId && !noticeData.program_status) {
                    noticeData.program_status = 'ACTIVE';
                }
            }

            if (editNoticeId) {
                await noticesApi.update(editNoticeId, noticeData);
            } else {
                await noticesApi.create(noticeData);
            }

            onSave(noticeData);

        } catch (error) {
            console.error('Save error:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSaveNotice} className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in-up">
            <div className="space-y-6 md:space-y-8">
                
                <BasicInfoSection 
                    mode={mode} 
                    title={formData.title} 
                    content={formData.content} 
                    onTitleChange={(v) => updateField('title', v)} 
                    onContentChange={(v) => updateField('content', v)} 
                />

                {mode === CATEGORIES.PROGRAM && (
                    <ProgramInfoSection formData={formData} updateField={updateField} />
                )}

                <RecruitmentSection formData={formData} updateField={updateField} mode={mode} />
                
                <PollBuilder formData={formData} updateField={updateField} />

                <PostSettings formData={formData} updateField={updateField} mode={mode} />

                {/* --- Image Upload Section --- */}
                <div className="space-y-4 pt-4 border-t border-gray-50">
                    <p className="text-xs font-bold text-gray-400 ml-1">상세 이미지 <span className="text-blue-500 font-bold ml-2">최대 {MAX_IMAGES}장</span></p>
                    
                    <ImagePreviewList 
                        existingImages={existingImages}
                        selectedFiles={selectedFiles}
                        onDragStart={handleImageDragStart}
                        onDrop={handleImageDrop}
                        onDragOver={handleImageDragOver}
                        onDeleteExisting={handleDeleteExistingImage}
                        onDeleteSelected={removeFile}
                        onEditSelected={openEditor}
                    />

                    {(existingImages.length + selectedFiles.length) < MAX_IMAGES && (
                        <ImageUploader 
                            onDrop={onDrop} 
                            currentCount={existingImages.length + selectedFiles.length} 
                        />
                    )}
                </div>

                {/* --- Action Buttons --- */}
                <div className="flex gap-4 pt-8">
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="flex-1 py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-all border border-gray-100"
                    >
                        취소하기
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSaving} 
                        className={`flex-1 py-4 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.15)] 
                        ${isSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_25px_rgba(37,99,235,0.3)] hover:-translate-y-0.5'}`}
                    >
                        {isSaving ? '저장 중...' : (editNoticeId ? '수정하기' : '등록하기')}
                    </button>
                </div>
            </div>

            <ImageCropModal 
                isOpen={editorState.showEditor}
                imageSrc={editorState.editorImageSrc}
                crop={editorState.crop}
                zoom={editorState.zoom}
                rotation={editorState.rotation}
                onCropChange={editorState.setCrop}
                onZoomChange={editorState.setZoom}
                onRotationChange={editorState.setRotation}
                onCropComplete={(croppedArea, croppedAreaPixels) => editorState.setCroppedAreaPixels(croppedAreaPixels)}
                onSave={editorState.saveEditedImage}
                onClose={() => editorState.setShowEditor(false)}
            />
        </form>
    );
};

WriteForm.propTypes = {
    mode: PropTypes.string.isRequired,
    editNoticeId: PropTypes.string,
    existingNotice: PropTypes.object,
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export default React.memo(WriteForm);
