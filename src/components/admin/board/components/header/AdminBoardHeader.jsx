import React from 'react';
import PropTypes from 'prop-types';
import { PlusCircle, FileText, Calendar, X, Image } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';
import AdminPageHeader from '../../../common/AdminPageHeader';

const AdminBoardHeader = ({ mode, showWriteForm, onToggleWriteForm }) => {
    let title = '공지사항';
    let subtitle = '학생들에게 전달할 중요한 공지사항을 관리합니다.';
    let icon = <FileText />;

    if (mode === CATEGORIES.PROGRAM) {
        title = '프로그램 관리';
        subtitle = '학생 센터 및 스처 프로그램 일정을 관리합니다.';
        icon = <Calendar />;
    } else if (mode === CATEGORIES.GALLERY) {
        title = '갤러리 관리';
        subtitle = '센터 활동 사진 및 이벤트를 게시합니다.';
        icon = <Image />;
    }

    const actions = (
        <button 
            onClick={onToggleWriteForm} 
            className={`flex-1 md:flex-none px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 transition-all font-black shadow-lg border text-sm w-full md:w-auto ${
                showWriteForm 
                    ? 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 shadow-none' 
                    : 'bg-blue-600 text-white border-transparent hover:bg-blue-700'
            }`}
        >
            {showWriteForm ? (
                <><X size={18} /> <span className="uppercase tracking-wider">취소하기</span></>
            ) : (
                <><PlusCircle size={18} className={showWriteForm ? "" : "animate-bounce"} /> <span className="uppercase tracking-wider">새 {mode === CATEGORIES.PROGRAM ? '일정' : '공지'}</span></>
            )}
        </button>
    );

    return (
        <AdminPageHeader
            title={title}
            subtitle={subtitle}
            icon={icon}
            actions={actions}
        />
    );
};

AdminBoardHeader.propTypes = {
    mode: PropTypes.string.isRequired,
    showWriteForm: PropTypes.bool.isRequired,
    onToggleWriteForm: PropTypes.func.isRequired
};

export default React.memo(AdminBoardHeader);
