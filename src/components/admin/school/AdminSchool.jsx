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

import AdminPageHeader from '../common/AdminPageHeader';

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

    const headerActions = adminTab === 'SCHOOLS' ? (
        <button
            onClick={() => setIsAddSchoolModalOpen(true)}
            className="px-5 py-2.5 bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-xl font-bold text-xs md:text-sm shadow-sm transition-colors shrink-0 flex items-center gap-1.5 whitespace-nowrap"
        >
            <Plus size={16} /> 학교 추가
        </button>
    ) : null;

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <AdminPageHeader
                title="학교 관리"
                subtitle="청소년 회원 소속 학교별 동아리 및 사역 일지 관리"
                icon={<School className="text-blue-500" />}
                actions={headerActions}
            />

            {/* 토스 스타일의 통합 필터/검색 툴바 */}
            <div className="bg-white rounded-[24px] border border-[#f2f4f6] p-6 shadow-sm flex flex-col gap-5">
                {/* Row 1: 메인 서브탭 및 지역 선택 필터 */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#f2f4f6] pb-4">
                    {/* 메인 서브탭 */}
                    <div className="flex bg-[#f2f4f6] p-1 rounded-xl shrink-0 gap-1 w-full lg:w-auto">
                        <button
                            onClick={() => setAdminTab('SCHOOLS')}
                            className={`flex-1 lg:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${adminTab === 'SCHOOLS' ? 'bg-white text-[#191f28] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                        >
                            <School size={13} />
                            학교 목록
                        </button>
                        <button
                            onClick={() => setAdminTab('CALLING_FOREST')}
                            className={`flex-1 lg:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${adminTab === 'CALLING_FOREST' ? 'bg-white text-[#2b8a3e] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                        >
                            <Flame size={13} className={adminTab === 'CALLING_FOREST' ? 'fill-current' : ''} />
                            리더훈련
                        </button>
                        <button
                            onClick={() => setAdminTab('SNACKS')}
                            className={`flex-1 lg:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${adminTab === 'SNACKS' ? 'bg-white text-[#e67700] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                        >
                            <Cookie size={13} className={adminTab === 'SNACKS' ? 'fill-current' : ''} />
                            간식
                        </button>
                    </div>

                    {/* 지역 선택 필터 */}
                    <div className="flex bg-[#f2f4f6] p-1 rounded-xl shrink-0 gap-1 w-full lg:w-auto overflow-x-auto no-scrollbar">
                        {['ALL', ...SCHOOL_REGIONS, '미지정'].map((region) => (
                            <button
                                key={region}
                                onClick={() => setSelectedRegion(region)}
                                className={`flex-1 lg:flex-none px-4 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${selectedRegion === region ? 'bg-white text-[#3182f6] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                            >
                                {region === 'ALL' ? '전체' : region}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: 검색창 및 뷰 스위처 (SCHOOLS 탭일 때만 노출) */}
                {adminTab === 'SCHOOLS' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* 검색창 */}
                        <div className="relative group w-full sm:max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b95a1] group-focus-within:text-[#3182f6] transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="학교명 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-[#f2f4f6] border border-transparent rounded-xl outline-none focus:bg-white focus:border-[#3182f6] focus:ring-4 focus:ring-[#3182f6]/10 transition-all font-semibold text-[#191f28] text-sm shadow-inner"
                            />
                        </div>

                        {/* 뷰 스위처 */}
                        <div className="flex bg-[#f2f4f6] p-1 rounded-xl shrink-0 gap-0.5 border border-transparent self-end sm:self-auto">
                            <button
                                onClick={() => handleViewModeChange('grid-lg')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid-lg' ? 'bg-white text-[#3182f6] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                                title="크게 보기"
                            >
                                <LayoutGrid size={15} />
                            </button>
                            <button
                                onClick={() => handleViewModeChange('grid-md')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid-md' ? 'bg-white text-[#3182f6] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                                title="작게 보기"
                            >
                                <Grid size={15} />
                            </button>
                            <button
                                onClick={() => handleViewModeChange('grid-sm')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid-sm' ? 'bg-white text-[#3182f6] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                                title="더 작게 보기"
                            >
                                <Columns size={15} />
                            </button>
                            <button
                                onClick={() => handleViewModeChange('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-[#3182f6] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                                title="목록형"
                            >
                                <List size={15} />
                            </button>
                        </div>
                    </div>
                )}
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
