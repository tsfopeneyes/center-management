import React, { useState, useEffect } from 'react';
import LogTableHeader from './LogTableHeader';
import LogTableRow from './LogTableRow';
import Pagination from '../../../common/Pagination';

const VisitLogTable = ({ hookData }) => {
    const {
        filteredVisitSummaries, selectedRows, handleSelectAll, handleRowSelect,
        filterOptions, visitFilters, setVisitFilters, toggleFilter,
        visitNotes, setVisitNotes, inputRefs, focusValRef,
        handleSaveNote, handleNoteKeyDown, handleNotePaste,
        handleCellMouseDown, handleCellMouseEnter, isCellSelected, selection
    } = hookData;

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // 필터링이나 데이터가 바뀌면 1페이지로 자동 회귀
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredVisitSummaries]);

    const totalPages = Math.ceil(filteredVisitSummaries.length / ITEMS_PER_PAGE);
    const currentData = filteredVisitSummaries.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className={`overflow-x-auto custom-scrollbar flex flex-col justify-between ${selection.isDragging ? 'select-none' : ''}`} style={{ minHeight: '500px' }}>
            <table className="w-full text-left border-collapse min-w-[1300px]">
                <LogTableHeader
                    filteredVisitSummaries={filteredVisitSummaries}
                    selectedRows={selectedRows}
                    handleSelectAll={handleSelectAll}
                    filterOptions={filterOptions}
                    visitFilters={visitFilters}
                    setVisitFilters={setVisitFilters}
                    toggleFilter={toggleFilter}
                />
                
                <tbody className="divide-y divide-gray-100 text-sm bg-white">
                    {currentData.length === 0 ? (
                        <tr><td colSpan="13" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
                    ) : (
                        currentData.map((summary, idx) => (
                            <LogTableRow
                                key={summary.id}
                                summary={summary}
                                idx={idx}
                                selectedRows={selectedRows}
                                handleRowSelect={handleRowSelect}
                                visitNotes={visitNotes}
                                setVisitNotes={setVisitNotes}
                                inputRefs={inputRefs}
                                focusValRef={focusValRef}
                                handleSaveNote={handleSaveNote}
                                handleNoteKeyDown={handleNoteKeyDown}
                                handleNotePaste={handleNotePaste}
                                handleCellMouseDown={handleCellMouseDown}
                                handleCellMouseEnter={handleCellMouseEnter}
                                isCellSelected={isCellSelected}
                            />
                        ))
                    )}
                </tbody>
            </table>

            {/* 페이지네이션 하단 고정 UI */}
            <div className="mt-auto border-t border-gray-100 bg-white/50 backdrop-blur-sm sticky left-0 w-full">
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
};

export default VisitLogTable;
