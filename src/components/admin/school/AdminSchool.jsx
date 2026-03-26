import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Search, Plus, Trash2, Edit2, Download, Copy, ExternalLink, Calendar, MapPin, CheckCircle, RefreshCw, Eye, MessageCircle, FileText, X, School, Flame, LayoutGrid, LayoutList, CheckCircle2, User, Users, ChevronRight, ChevronLeft, Grid, List, Star, Heart, Columns, Settings, ClipboardList, Save, Clock, Cookie } from 'lucide-react';
import { SCHOOL_REGIONS, CLUB_TYPES } from '../../../constants/appConstants';
import { calculateAge } from '../../../utils/dateUtils';
import { motion, AnimatePresence } from 'framer-motion';
import TemplateManager from '../messages/TemplateManager';
import { userApi } from '../../../api/userApi';
import LogSelectorModal from './LogSelectorModal';
import { normalizeSchoolName } from '../../../utils/schoolUtils';
import SchoolCard from './components/SchoolCard';
import CompleterCard from './components/CompleterCard';
import ProgressBarCard from './components/ProgressBarCard';
import CallingForestDashboard from './components/CallingForestDashboard';
import SchoolDetailModal from './modals/SchoolDetailModal';
import { useAdminSchool } from './hooks/useAdminSchool';
import SnackDashboard from './components/SnackDashboard';

const MINISTRY_LOG_TEMPLATE = '';

const AdminSchool = ({ users = [], fetchData: refreshDashboardData }) => {
    const {
        schools, logs, loading, searchTerm, setSearchTerm,
        selectedSchoolName, setSelectedSchoolName,
        isDetailModalOpen, setIsDetailModalOpen,
        isSettingsMode, setIsSettingsMode,
        selectedRegion, setSelectedRegion,
        adminTab, setAdminTab,
        isAddSchoolModalOpen, setIsAddSchoolModalOpen,
        newSchoolName, setNewSchoolName,
        addingSchool, setAddingSchool,
        favorites, viewMode, prefsLoading,
        handleAddSchool, handleDeleteSchool,
        toggleFavorite, handleViewModeChange,
        fetchSchoolsAndLogsAndPrefs,
        staffList, schoolGroups, targetSchool,
        handleOpenDetail, handleSaveMetadata, handleToggleLeader
    } = useAdminSchool({ users, refreshDashboardData });
    if (loading) return <div className="p-10 text-center font-bold text-gray-400 animate-pulse">학교 데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="p-4 md:p-10 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-4 md:gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-indigo-50/20">
                <div className="flex items-center justify-between w-full lg:w-auto">
                    <div>
                        <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                            <School className="text-indigo-600" size={24} md:size={32} />
                            학교 관리
                        </h2>
                        <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">청소년 회원 소속 학교별 동아리 및 사역 일지 관리</p>
                    </div>

                    <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                            onClick={() => setAdminTab(adminTab === 'CALLING_FOREST' ? 'SCHOOLS' : 'CALLING_FOREST')}
                            className={`shrink-0 px-3 py-2 rounded-xl font-black text-[10px] transition-all flex items-center gap-1.5 ${adminTab === 'CALLING_FOREST' ? 'bg-green-500 text-white shadow-md shadow-green-200' : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200/50'}`}
                        >
                            <Flame size={12} className={adminTab === 'CALLING_FOREST' ? 'fill-current' : ''} />
                            리더훈련
                        </button>
                        <button
                            onClick={() => setAdminTab(adminTab === 'SNACKS' ? 'SCHOOLS' : 'SNACKS')}
                            className={`shrink-0 px-3 py-2 rounded-xl font-black text-[10px] transition-all flex items-center gap-1.5 ${adminTab === 'SNACKS' ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200/50'}`}
                        >
                            <Cookie size={12} className={adminTab === 'SNACKS' ? 'fill-current' : ''} />
                            간식
                        </button>
                    </div>
                </div>

                <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-4 w-full xl:w-auto flex-1 justify-end">
                    <button
                        onClick={() => setAdminTab(adminTab === 'CALLING_FOREST' ? 'SCHOOLS' : 'CALLING_FOREST')}
                        className={`hidden lg:flex shrink-0 px-4 md:px-5 py-2.5 rounded-xl font-black text-xs transition-all items-center gap-2 ${adminTab === 'CALLING_FOREST' ? 'bg-green-500 text-white shadow-md shadow-green-200' : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200/50'}`}
                    >
                        <Flame size={14} className={adminTab === 'CALLING_FOREST' ? 'fill-current' : ''} />
                        리더훈련
                    </button>

                    <button
                        onClick={() => setAdminTab(adminTab === 'SNACKS' ? 'SCHOOLS' : 'SNACKS')}
                        className={`hidden lg:flex shrink-0 px-4 md:px-5 py-2.5 rounded-xl font-black text-xs transition-all items-center gap-2 ${adminTab === 'SNACKS' ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200/50'}`}
                    >
                        <Cookie size={14} className={adminTab === 'SNACKS' ? 'fill-current' : ''} />
                        간식
                    </button>

                    <div className="flex bg-gray-100/50 p-1 md:p-1.5 rounded-xl md:rounded-2xl border border-gray-100 w-full sm:w-auto xl:overflow-visible overflow-x-auto no-scrollbar shrink-0 gap-1">
                        {['ALL', ...SCHOOL_REGIONS, '미지정'].map((region) => (
                            <button
                                key={region}
                                onClick={() => setSelectedRegion(region)}
                                className={`flex-1 sm:flex-none px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black text-[10px] md:text-xs transition-all whitespace-nowrap ${selectedRegion === region ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {region === 'ALL' ? '전체' : region}
                            </button>
                        ))}
                    </div>

                    {adminTab === 'SCHOOLS' && (
                        <div className="flex items-center gap-2 w-full xl:w-auto">
                            <button
                                onClick={() => setIsAddSchoolModalOpen(true)}
                                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs md:text-sm hover:bg-indigo-700 shadow-sm transition-colors shrink-0 flex items-center gap-2"
                            >
                                <Plus size={16} /> 학교 추가
                            </button>
                            <div className="relative group flex-1 xl:min-w-[300px] xl:max-w-[400px]">
                                <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} md:size={20} />
                                <input
                                    type="text"
                                    placeholder="검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-11 md:pl-14 p-3 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold text-gray-700 shadow-inner text-sm md:text-base"
                                />
                            </div>

                            <div className="flex bg-gray-100 p-1 rounded-lg md:rounded-xl shrink-0">
                                <button
                                    onClick={() => handleViewModeChange('grid-lg')}
                                    className={`p-1.5 md:p-2 rounded-md md:rounded-lg transition-all ${viewMode === 'grid-lg' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="크게 보기"
                                >
                                    <LayoutGrid size={16} md:size={18} />
                                </button>
                                <button
                                    onClick={() => handleViewModeChange('grid-md')}
                                    className={`p-1.5 md:p-2 rounded-md md:rounded-lg transition-all ${viewMode === 'grid-md' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="작게 보기"
                                >
                                    <Grid size={16} md:size={18} />
                                </button>
                                <button
                                    onClick={() => handleViewModeChange('grid-sm')}
                                    className={`p-1.5 md:p-2 rounded-md md:rounded-lg transition-all ${viewMode === 'grid-sm' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="더 작게 보기"
                                >
                                    <Columns size={16} md:size={18} />
                                </button>
                                <button
                                    onClick={() => handleViewModeChange('list')}
                                    className={`p-1.5 md:p-2 rounded-md md:rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="목록형"
                                >
                                    <List size={16} md:size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {adminTab === 'SCHOOLS' && (
                <div className={`
                    ${viewMode === 'list' ? 'flex flex-col gap-2' : 'grid gap-3 md:gap-4'}
                    ${viewMode === 'grid-lg' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : ''}
                    ${viewMode === 'grid-md' ? 'grid-cols-3 md:grid-cols-4 xl:grid-cols-5' : ''}
                    ${viewMode === 'grid-sm' ? 'grid-cols-4 md:grid-cols-5 xl:grid-cols-6' : ''}
                `}>
                    {schoolGroups.map((group) => (
                        <SchoolCard
                            key={group.name}
                            group={group}
                            viewMode={viewMode}
                            isFavorite={favorites.includes(group.name)}
                            onToggleFavorite={(e) => toggleFavorite(group.name, e)}
                            onDeleteSchool={handleDeleteSchool}
                            onClick={() => handleOpenDetail(group)}
                        />
                    ))}
                </div>
            )}

            {
                adminTab === 'CALLING_FOREST' && (
                    <CallingForestDashboard
                        users={users}
                        selectedRegion={selectedRegion}
                        schools={schools}
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                    />
                )}

            {
                adminTab === 'SNACKS' && (
                    <SnackDashboard
                        schools={schools}
                        selectedRegion={selectedRegion}
                        onClickSchool={(schoolName) => {
                            const group = schoolGroups.find(g => g.name === schoolName);
                            if (group) handleOpenDetail(group);
                        }}
                    />
                )}

            <AnimatePresence>
                {isDetailModalOpen && targetSchool && (
                    <SchoolDetailModal
                        school={targetSchool}
                        logs={logs.filter(l => l.school_id === targetSchool.metadata?.id)}
                        staffList={staffList}
                        onClose={() => setIsDetailModalOpen(false)}
                        isSettingsMode={isSettingsMode}
                        setIsSettingsMode={setIsSettingsMode}
                        onSaveMetadata={handleSaveMetadata}
                        refreshLogs={fetchSchoolsAndLogsAndPrefs}
                        refreshDashboardData={refreshDashboardData}
                        allUsers={users}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isAddSchoolModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setIsAddSchoolModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <School size={18} className="text-indigo-600" />
                                    학교 추가
                                </h3>
                                <button onClick={() => setIsAddSchoolModalOpen(false)}><X size={18} className="text-gray-400" /></button>
                            </div>
                            <div className="p-5">
                                <label className="text-xs font-bold text-gray-500 block mb-2">학교명</label>
                                <input
                                    type="text"
                                    value={newSchoolName}
                                    onChange={e => setNewSchoolName(e.target.value)}
                                    placeholder="예: OO고등학교"
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 font-bold"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddSchool(); }}
                                />
                                <button
                                    onClick={handleAddSchool}
                                    disabled={addingSchool || !newSchoolName.trim()}
                                    className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    {addingSchool ? '추가 중...' : '추가하기'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};



export default AdminSchool;
