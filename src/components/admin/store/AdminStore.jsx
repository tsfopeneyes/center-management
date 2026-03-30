import React, { useState } from 'react';
import { Store, Inbox, Award } from 'lucide-react';
import StoreApprovals from './components/StoreApprovals';
import StoreItems from './components/StoreItems';
import StoreManualPoints from './components/StoreManualPoints';
import AdminGuestbook from '../board/AdminGuestbook';

const AdminStore = () => {
    const [activeTab, setActiveTab] = useState('APPROVALS'); // APPROVALS, ITEMS

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <Store className="text-blue-600" size={28} />
                        하이픈 포인트
                    </h2>
                    <p className="text-gray-500 font-bold text-sm mt-1">학생들의 포인트 관리 및 스토어 승인, 그리고 콘텐츠 참여(인증) 내역을 확인합니다.</p>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1 -mx-1">
                <button
                    onClick={() => setActiveTab('APPROVALS')}
                    className={`whitespace-nowrap shrink-0 px-4 md:px-6 py-3 rounded-2xl font-black text-[13px] md:text-base flex items-center justify-center gap-1.5 md:gap-2 transition-all ${
                        activeTab === 'APPROVALS'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:-translate-y-0.5'
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Inbox size={18} />주문승인
                </button>
                <button
                    onClick={() => setActiveTab('ITEMS')}
                    className={`whitespace-nowrap shrink-0 px-4 md:px-6 py-3 rounded-2xl font-black text-[13px] md:text-base flex items-center justify-center gap-1.5 md:gap-2 transition-all ${
                        activeTab === 'ITEMS'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:-translate-y-0.5'
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Store size={18} />항목관리
                </button>
                <button
                    onClick={() => setActiveTab('MANUAL')}
                    className={`whitespace-nowrap shrink-0 px-4 md:px-6 py-3 rounded-2xl font-black text-[13px] md:text-base flex items-center justify-center gap-1.5 md:gap-2 transition-all ${
                        activeTab === 'MANUAL'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:-translate-y-0.5'
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Award size={18} />포인트지급
                </button>
                <button
                    onClick={() => setActiveTab('CONTENT')}
                    className={`whitespace-nowrap shrink-0 px-4 md:px-6 py-3 rounded-2xl font-black text-[13px] md:text-base flex items-center justify-center gap-1.5 md:gap-2 transition-all ${
                        activeTab === 'CONTENT'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:-translate-y-0.5'
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Inbox size={18} />콘텐츠 참여
                </button>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {activeTab === 'APPROVALS' && <StoreApprovals />}
                {activeTab === 'ITEMS' && <StoreItems />}
                {activeTab === 'MANUAL' && <StoreManualPoints />}
                {activeTab === 'CONTENT' && <AdminGuestbook />}
            </div>
        </div>
    );
};

export default AdminStore;
