import React from 'react';
import PropTypes from 'prop-types';
import { PlusCircle, FileText, Calendar, X } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';

const AdminBoardHeader = ({ mode, showWriteForm, onToggleWriteForm }) => {
    return (
        <div className="px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center justify-between border-b border-gray-50">
            <div className="flex flex-col justify-between w-full md:w-auto">
                <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                    {mode === CATEGORIES.PROGRAM ? <Calendar className="text-blue-600 w-6 h-6 md:w-8 md:h-8" /> : <FileText className="text-blue-600 w-6 h-6 md:w-8 md:h-8" />}
                    {mode === CATEGORIES.PROGRAM ? '프로그램 관리' : '공지사항'}
                </h2>
                <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">
                    {mode === CATEGORIES.PROGRAM ? '학생 센터 및 스처 프로그램 일정을 관리합니다.' : '학생들에게 전달할 중요한 공지사항을 관리합니다.'}
                </p>
            </div>

            <button 
                onClick={onToggleWriteForm} 
                className={`flex-1 md:flex-none px-5 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 transition-all font-black shadow-lg border text-sm w-full md:w-auto ${
                    showWriteForm 
                        ? 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200' 
                        : 'bg-primary-gradient text-white border-transparent hover:opacity-90'
                }`}
            >
                {showWriteForm ? (
                    <><X size={18} /> <span className="uppercase tracking-wider">취소하기</span></>
                ) : (
                    <><PlusCircle size={18} className={showWriteForm ? "" : "animate-bounce"} /> <span className="uppercase tracking-wider">새 {mode === CATEGORIES.PROGRAM ? '일정' : '공지'}</span></>
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
