import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, ImagePlus, Loader2, Monitor, Plus, Radio, Save, Trash2 } from 'lucide-react';
import AdminPageHeader from '../common/AdminPageHeader';
import { supabase } from '../../../supabaseClient';
import { uploadAccountImage } from '../../../auth/accountMedia';
import { isAccountAuthEnabled } from '../../../auth/accountAuthRuntime';
import { useAuth } from '../../../auth/AuthProvider';
import { isAdminOrStaff } from '../../../utils/userUtils';
import { compressImage } from '../../../utils/imageUtils';
import {
    loadScreenConfig, MAX_SCREEN_ASSETS, MAX_SCREEN_SET_IMAGES, MAX_SCREEN_SETS,
    saveScreenConfig, SCREEN_INTERVALS,
} from '../../../utils/screenConfig';

const copyConfig = config => ({
    ...config,
    assets: config.assets.map(item => ({ ...item })),
    sets: config.sets.map(item => ({ ...item, imageIds: [...item.imageIds] })),
});
const GuestMobileWelcome = lazy(() => import('../../../pages/GuestMobileWelcome'));

export default function AdminScreen({ currentAdmin }) {
    const auth = useAuth();
    const [config, setConfig] = useState(null);
    const [selectedSetId, setSelectedSetId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);

    useEffect(() => {
        loadScreenConfig().then(next => {
            setConfig(copyConfig(next));
            setSelectedSetId(next.activeSetId);
        }).catch(error => window.alert(`전자칠판 설정을 불러오지 못했습니다.\n${error.message}`))
            .finally(() => setLoading(false));
    }, []);

    const selectedSet = config?.sets.find(item => item.id === selectedSetId) || config?.sets[0];
    const activeSet = config?.sets.find(item => item.id === config.activeSetId) || config?.sets[0];
    const assetMap = useMemo(() => new Map((config?.assets || []).map(item => [item.id, item])), [config?.assets]);
    const selectedImages = selectedSet?.imageIds.map(id => assetMap.get(id)).filter(Boolean) || [];

    const changeConfig = updater => {
        setConfig(current => updater(copyConfig(current)));
        setDirty(true);
    };
    const changeSelectedSet = updater => changeConfig(next => ({
        ...next,
        sets: next.sets.map(item => item.id === selectedSet.id ? updater(item) : item),
    }));

    const uploadSelectedFiles = async (files, profileId = currentAdmin?.id, allowReauth = true) => {
        if (!files.length) return;
        if (config.assets.length + files.length > MAX_SCREEN_ASSETS) {
            window.alert(`이미지 보관함에는 최대 ${MAX_SCREEN_ASSETS}장까지 등록할 수 있습니다.`);
            return;
        }
        setUploading(true);
        const uploaded = [];
        try {
            for (const file of files) {
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WebP 이미지만 올릴 수 있습니다.');
                const optimized = await compressImage(file, 3840, 0.9);
                let url;
                if (isAccountAuthEnabled()) {
                    url = await uploadAccountImage({ profileId, kind: 'notice', file: optimized });
                } else {
                    const path = `screen/${currentAdmin?.id || 'admin'}/${crypto.randomUUID()}.jpg`;
                    const { error } = await supabase.storage.from('notice-images').upload(path, optimized);
                    if (error) throw error;
                    url = supabase.storage.from('notice-images').getPublicUrl(path).data.publicUrl;
                }
                uploaded.push({ id: crypto.randomUUID(), url, name: file.name });
            }
        } catch (error) {
            if (error?.code === 'reauth_required' && allowReauth) {
                setPendingFiles(files.slice(uploaded.length));
                setLoginOpen(true);
            } else {
                window.alert(`이미지 업로드에 실패했습니다.\n${error.message}`);
            }
        } finally {
            if (uploaded.length) changeConfig(next => ({ ...next, assets: [...next.assets, ...uploaded] }));
            setUploading(false);
        }
    };

    const uploadFiles = event => {
        const files = [...(event.target.files || [])];
        event.target.value = '';
        void uploadSelectedFiles(files);
    };

    const resumeUpload = profile => {
        setLoginOpen(false);
        if (!isAdminOrStaff(profile)) {
            setPendingFiles([]);
            window.alert('전자칠판 이미지는 관리자 또는 스탭만 올릴 수 있습니다.');
            return;
        }
        const files = pendingFiles;
        setPendingFiles([]);
        void auth.refresh()
            .then(() => uploadSelectedFiles(files, profile.id, false))
            .catch(error => window.alert(`로그인 상태를 확인하지 못했습니다.\n${error.message}`));
    };

    const addSet = () => {
        if (config.sets.length >= MAX_SCREEN_SETS) return window.alert(`송출 세트는 최대 ${MAX_SCREEN_SETS}개까지 만들 수 있습니다.`);
        const id = crypto.randomUUID();
        changeConfig(next => ({ ...next, sets: [...next.sets, { id, name: `새 송출 세트 ${next.sets.length + 1}`, imageIds: [], intervalSeconds: 10 }] }));
        setSelectedSetId(id);
    };
    const duplicateSet = () => {
        if (config.sets.length >= MAX_SCREEN_SETS) return window.alert(`송출 세트는 최대 ${MAX_SCREEN_SETS}개까지 만들 수 있습니다.`);
        const id = crypto.randomUUID();
        changeConfig(next => ({ ...next, sets: [...next.sets, { ...selectedSet, id, name: `${selectedSet.name} 복사본`, imageIds: [...selectedSet.imageIds] }] }));
        setSelectedSetId(id);
    };
    const deleteSet = () => {
        if (config.sets.length === 1) return window.alert('송출 세트는 최소 하나가 필요합니다.');
        if (selectedSet.id === config.activeSetId) return window.alert('현재 송출 중인 세트는 삭제할 수 없습니다. 다른 세트를 먼저 적용해주세요.');
        if (!window.confirm(`‘${selectedSet.name}’ 세트를 삭제할까요?\n보관함의 이미지는 삭제되지 않습니다.`)) return;
        const remaining = config.sets.filter(item => item.id !== selectedSet.id);
        changeConfig(next => ({ ...next, sets: next.sets.filter(item => item.id !== selectedSet.id) }));
        setSelectedSetId(remaining[0].id);
    };
    const toggleAsset = id => {
        const included = selectedSet.imageIds.includes(id);
        if (!included && selectedSet.imageIds.length >= MAX_SCREEN_SET_IMAGES) return window.alert(`한 세트에는 최대 ${MAX_SCREEN_SET_IMAGES}장까지 넣을 수 있습니다.`);
        changeSelectedSet(item => ({ ...item, imageIds: included ? item.imageIds.filter(itemId => itemId !== id) : [...item.imageIds, id] }));
    };
    const move = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= selectedSet.imageIds.length) return;
        changeSelectedSet(item => {
            const imageIds = [...item.imageIds];
            [imageIds[index], imageIds[target]] = [imageIds[target], imageIds[index]];
            return { ...item, imageIds };
        });
    };
    const deleteAsset = asset => {
        const usedBy = config.sets.filter(item => item.imageIds.includes(asset.id));
        const warning = usedBy.length
            ? `\n이 이미지는 ${usedBy.length}개 세트에서도 함께 빠집니다.` : '';
        if (!window.confirm(`‘${asset.name}’을 보관함에서 삭제할까요?${warning}`)) return;
        changeConfig(next => ({
            ...next,
            assets: next.assets.filter(item => item.id !== asset.id),
            sets: next.sets.map(item => ({ ...item, imageIds: item.imageIds.filter(id => id !== asset.id) })),
        }));
    };

    const persist = async activeSetId => {
        const target = config.sets.find(item => item.id === activeSetId);
        if (!target?.imageIds.length) return window.alert('표시할 이미지가 없는 세트는 송출할 수 없습니다.');
        setSaving(true);
        try {
            const saved = await saveScreenConfig({ ...config, activeSetId });
            setConfig(copyConfig(saved));
            setDirty(false);
            window.alert(activeSetId === config.activeSetId ? '변경사항을 저장했습니다.' : `‘${target.name}’ 세트를 전자칠판에 적용했습니다.`);
        } catch (error) {
            window.alert(`전자칠판 설정을 저장하지 못했습니다.\n${error.message}`);
        } finally { setSaving(false); }
    };

    if (loading || !config || !selectedSet) return <div className="py-20 text-center font-bold text-gray-400">전자칠판 설정을 불러오는 중...</div>;

    return <div className="w-full space-y-6 pb-12">
        {loginOpen && <Suspense fallback={<div className="fixed inset-0 z-50 bg-white/80" aria-hidden="true" />}><GuestMobileWelcome isQRCheckin={false} loginOnly onLoginComplete={resumeUpload} onLoginCancel={() => { setLoginOpen(false); setPendingFiles([]); }} /></Suspense>}
        <AdminPageHeader title="전자칠판" subtitle="이미지는 보관하고, 상황에 맞는 송출 세트를 골라 적용하세요." icon={<Monitor />} />

        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-lg shadow-blue-100 md:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Radio size={24} /></span>
                    <div><p className="text-sm font-bold text-blue-100">현재 송출 중</p><h2 className="mt-1 text-2xl font-black">{activeSet.name}</h2><p className="mt-1 text-sm font-medium text-blue-100">이미지 {activeSet.imageIds.length}장 · {activeSet.intervalSeconds}초 간격</p></div>
                </div>
                <button type="button" onClick={() => window.open('/screen', '_blank', 'noopener,noreferrer')} className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/25"><ExternalLink size={17} /> 실제 화면 열기</button>
            </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="text-lg font-black text-gray-900">송출 세트</h2><p className="mt-1 text-sm font-medium text-gray-400">행사나 상황별 이미지 구성을 저장해두세요.</p></div>
                <button type="button" onClick={addSet} className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-600"><Plus size={17} /> 새 세트</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {config.sets.map(item => <button type="button" key={item.id} onClick={() => setSelectedSetId(item.id)} className={`rounded-2xl border p-4 text-left transition ${item.id === selectedSet.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-100 hover:border-blue-200'}`}>
                    <div className="flex items-center justify-between gap-2"><span className="truncate font-black text-gray-800">{item.name}</span>{item.id === config.activeSetId && <span className="shrink-0 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black text-white">송출 중</span>}</div>
                    <p className="mt-2 text-xs font-bold text-gray-400">이미지 {item.imageIds.length}장 · {item.intervalSeconds}초</p>
                </button>)}
            </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1">
                    <label className="text-xs font-black text-gray-400">선택한 세트 이름</label>
                    <input value={selectedSet.name} maxLength={40} onChange={event => changeSelectedSet(item => ({ ...item, name: event.target.value }))} className="mt-2 w-full max-w-xl rounded-xl border border-gray-200 px-4 py-3 text-lg font-black text-gray-800 outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={duplicateSet} className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600"><Copy size={16} /> 복제</button>
                    <button type="button" onClick={deleteSet} className="flex items-center gap-2 rounded-xl border border-red-100 px-4 py-3 text-sm font-bold text-red-500"><Trash2 size={16} /> 세트 삭제</button>
                </div>
            </div>

            <div className="mt-6 flex flex-col gap-5 border-t border-gray-100 pt-6 md:flex-row md:items-end md:justify-between">
                <label><span className="text-sm font-black text-gray-800">이미지 전환 간격</span><select value={selectedSet.intervalSeconds} onChange={event => changeSelectedSet(item => ({ ...item, intervalSeconds: Number(event.target.value) }))} className="mt-2 block w-48 rounded-xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-700 outline-none focus:border-blue-500">{SCREEN_INTERVALS.map(seconds => <option key={seconds} value={seconds}>{seconds}초</option>)}</select><p className="mt-2 text-xs font-medium text-gray-400">이미지가 한 장이면 계속 고정됩니다.</p></label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" disabled={saving || !dirty} onClick={() => persist(config.activeSetId)} className="flex min-w-36 items-center justify-center gap-2 rounded-xl border border-blue-200 px-5 py-3.5 font-black text-blue-600 disabled:border-gray-100 disabled:text-gray-300"><Save size={17} /> 변경 저장</button>
                    <button type="button" disabled={saving || selectedSet.id === config.activeSetId && !dirty} onClick={() => persist(selectedSet.id)} className="min-w-48 rounded-xl bg-blue-600 px-5 py-3.5 font-black text-white shadow-lg shadow-blue-100 disabled:bg-gray-300 disabled:shadow-none">{saving ? '적용 중...' : selectedSet.id === config.activeSetId ? '현재 세트에 적용' : '이 세트를 송출하기'}</button>
                </div>
            </div>

            <div className="mt-7"><h3 className="font-black text-gray-800">표시 순서 <span className="text-blue-600">{selectedImages.length}</span></h3>
                {selectedImages.length === 0 ? <div className="mt-3 flex min-h-36 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-sm font-bold text-gray-400">아래 보관함에서 표시할 이미지를 선택해주세요.</div> :
                    <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{selectedImages.map((item, index) => <article key={item.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50"><div className="aspect-video bg-black"><img src={item.url} alt={item.name} className="h-full w-full object-contain" /></div><div className="flex items-center gap-2 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-600">{item.name}</span><button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg p-2 text-gray-400 disabled:opacity-20" aria-label="앞으로 이동"><ArrowUp size={17} /></button><button type="button" disabled={index === selectedImages.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-2 text-gray-400 disabled:opacity-20" aria-label="뒤로 이동"><ArrowDown size={17} /></button><button type="button" onClick={() => toggleAsset(item.id)} className="rounded-lg p-2 text-red-400" aria-label="세트에서 빼기"><Trash2 size={17} /></button></div></article>)}</div>}
            </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-gray-900">이미지 보관함</h2><p className="mt-1 text-sm font-medium text-gray-400">한 번 올린 이미지를 여러 송출 세트에서 다시 사용할 수 있습니다. · {config.assets.length}/{MAX_SCREEN_ASSETS}장</p></div><label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-600 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>{uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}{uploading ? '업로드 중...' : '이미지 추가'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={uploadFiles} /></label></div>
            {config.assets.length === 0 ? <label className="mt-6 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:border-blue-300 hover:text-blue-500"><ImagePlus size={38} /><span className="mt-3 font-bold">보관할 이미지를 추가해주세요</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={uploadFiles} /></label> :
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{config.assets.map(asset => { const included = selectedSet.imageIds.includes(asset.id); return <article key={asset.id} className={`overflow-hidden rounded-2xl border ${included ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100'}`}><button type="button" onClick={() => toggleAsset(asset.id)} className="relative block aspect-video w-full bg-black"><img src={asset.url} alt={asset.name} className="h-full w-full object-contain" />{included && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white"><Check size={16} /></span>}</button><div className="flex items-center gap-2 p-3"><button type="button" onClick={() => toggleAsset(asset.id)} className={`min-w-0 flex-1 truncate text-left text-sm font-bold ${included ? 'text-blue-600' : 'text-gray-600'}`}>{asset.name}</button><button type="button" onClick={() => deleteAsset(asset)} className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500" aria-label="보관함에서 삭제"><Trash2 size={16} /></button></div></article>; })}</div>}
        </section>
    </div>;
}
