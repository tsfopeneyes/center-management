import { useState, useEffect } from 'react';
import { challengesApi } from '../../../../api/challengesApi';
import { supabase } from '../../../../supabaseClient';
import { compressImage } from '../../../../utils/imageUtils';

export const useAdminChallenges = () => {
    const [categories, setCategories] = useState([]);
    const [challenges, setChallenges] = useState([]);
    const [loading, setLoading] = useState(true);

    const [expandedCategory, setExpandedCategory] = useState(null);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [showChallengeForm, setShowChallengeForm] = useState(false);

    const [editingCategory, setEditingCategory] = useState({ name: '', description: '' });
    const [editingChallenge, setEditingChallenge] = useState({
        name: '', description: '', category_id: '', type: 'VISIT', threshold: 0, criteria_label: '', image_url: ''
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [catData, chData] = await Promise.all([
                challengesApi.fetchCategories(),
                challengesApi.fetchChallenges()
            ]);
            setCategories(catData);
            setChallenges(chData);
            if (catData.length > 0 && !expandedCategory) {
                setExpandedCategory(catData[0].id);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            alert('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        try {
            await challengesApi.upsertCategory(editingCategory);
            setShowCategoryForm(false);
            setEditingCategory({ name: '', description: '' });
            fetchData();
            alert('카테고리가 저장되었습니다.');
        } catch (error) {
            alert('카테고리 저장 실패: ' + error.message);
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm('카테고리를 삭제하면 소속된 모든 챌린지도 삭제됩니다. 계속하시겠습니까?')) return;
        try {
            await challengesApi.deleteCategory(id);
            fetchData();
        } catch (error) {
            alert('삭제 실패: ' + error.message);
        }
    };

    const handleSaveChallenge = async (e) => {
        e.preventDefault();
        try {
            await challengesApi.upsertChallenge(editingChallenge);
            setShowChallengeForm(false);
            setEditingChallenge({ name: '', description: '', category_id: expandedCategory, type: 'VISIT', threshold: 0, criteria_label: '', image_url: '' });
            fetchData();
            alert('챌린지가 저장되었습니다.');
        } catch (error) {
            alert('챌린지 저장 실패: ' + error.message);
        }
    };

    const handleDeleteChallenge = async (id) => {
        if (!window.confirm('챌린지를 삭제하시겠습니까?')) return;
        try {
            await challengesApi.deleteChallenge(id);
            fetchData();
        } catch (error) {
            alert('삭제 실패: ' + error.message);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const compressedFile = await compressImage(file, 512, 0.9);
            const fileExt = compressedFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('notice-images')
                .upload(`badges/${fileName}`, compressedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('notice-images')
                .getPublicUrl(`badges/${fileName}`);

            setEditingChallenge(prev => ({ ...prev, image_url: publicUrl }));
        } catch (error) {
            alert('이미지 업로드 실패: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const openCategoryModal = (cat = { name: '', description: '' }) => {
        setEditingCategory(cat);
        setShowCategoryForm(true);
    };

    const openChallengeModal = (ch = { name: '', description: '', category_id: expandedCategory, type: 'VISIT', threshold: 0, image_url: '' }) => {
        setEditingChallenge(ch);
        setShowChallengeForm(true);
    };

    return {
        categories, challenges, loading,
        expandedCategory, setExpandedCategory,
        showCategoryForm, setShowCategoryForm,
        showChallengeForm, setShowChallengeForm,
        editingCategory, setEditingCategory,
        editingChallenge, setEditingChallenge,
        uploading,
        handleSaveCategory, handleDeleteCategory,
        handleSaveChallenge, handleDeleteChallenge,
        handleImageUpload, openCategoryModal, openChallengeModal
    };
};
