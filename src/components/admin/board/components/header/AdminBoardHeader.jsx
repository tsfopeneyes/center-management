import React from 'react';
import PropTypes from 'prop-types';
import { PlusCircle, FileText, Calendar, X } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';

const AdminBoardHeader = ({ mode, showWriteForm, onToggleWriteForm }) => {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 p-6 md:p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-lg relative overflow-hidden group">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:scale-110 transition-transform duration-700"></div>
            
            <div className="relative z-10 flex items-center gap-4 md:gap-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-inner group-hover:rotate-6 transition-transform">
                    {mode === CATEGORIES.PROGRAM ? <Calendar size={32} className="text-white" /> : <FileText size={32} className="text-white" />}
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2 drop-shadow-sm flex items-center gap-2">
                        {mode === CATEGORIES.PROGRAM ? '학생 센터/스처 일정' : '학생 중요 공지사항'}
                    </h1>
                    <p className="text-blue-100 text-sm md:text-base font-medium font-bold opacity-90 drop-shadow-md">
                        {mode === CATEGORIES.PROGRAM ? '학생 센터 및 스처 프로그램 일정을 관리합니다.' : '학생들에게 전달할 중요한 공지사항을 관리합니다.'}
                    </p>
                </div>
            </div>

            <button 
                onClick={onToggleWriteForm} 
                className={`relative z-10 px-5 md:px-6 py-3 cursor-pointer md:py-4 rounded-2xl font-black text-sm md:text-base transition-all flex items-center gap-2 shadow-lg w-full sm:w-auto justify-center sm:justify-start ${showWriteForm ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20' : 'bg-white text-blue-600 hover:bg-blue-50 hover:scale-105 hover:shadow-blue-500/25'}`}
            >
                {showWriteForm ? (
                    <><X size={20} /> 취소하기</>
                ) : (
                    <><PlusCircle size={20} className={showWriteForm ? "" : "animate-bounce"} /> 새 {mode === CATEGORIES.PROGRAM ? '일정' : '작성'}</>
                )}
            </button>
        </div>
    );
};

AdminBoardHeader.propTypes = {
    mode: PropTypes.string.isRequired,
    showWriteForm: PropTypes.bool.isRequired,
    onToggleWriteForm: PropTypes.func.isRequired
};

export default React.memo(AdminBoardHeader);
