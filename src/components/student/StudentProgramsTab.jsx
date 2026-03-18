import React from 'react';
import ProgramCard from './ProgramCard';

const StudentProgramsTab = ({
    filteredPrograms,
    responses,
    openNoticeDetail
}) => {
    return (
        <div className="p-5 pt-6 pb-32 bg-white rounded-t-[30px] shadow-sm mt-2 min-h-[calc(100vh-80px)]">
            <h1 className="text-3xl font-black text-gray-800 mb-2">센터 프로그램 🚀</h1>
            <p className="text-gray-500 text-[15px] mb-8 font-medium">다양한 프로그램에 참여해보세요!</p>



            <div className="space-y-4">
                {filteredPrograms.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">진행 중인 프로그램이 없습니다.</div>
                ) : (
                    filteredPrograms.map(n => (
                        <ProgramCard
                            key={n.id}
                            program={{ ...n, responseStatus: responses[n.id] }}
                            onClick={openNoticeDetail}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default StudentProgramsTab;
