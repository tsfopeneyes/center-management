import React, { useState, useEffect } from 'react';

const LogTableRow = React.memo(({
    summary,
    idx,
    selectedRows,
    handleRowSelect,
    visitNotes,
    setVisitNotes,
    inputRefs,
    focusValRef,
    handleSaveNote,
    handleNoteKeyDown,
    handleNotePaste,
    handleCellMouseDown,
    handleCellMouseEnter,
    isCellSelected
}) => {
    const noteKey = `${summary.userId}_${summary.date}`;
    const initialNote = visitNotes[noteKey] || {};
    
    // 로컬 상태를 사용하여 타이핑 시 전체 테이블이 리렌더링되는 렉 방지
    const [localPurpose, setLocalPurpose] = useState(initialNote.purpose || '');
    const [localRemarks, setLocalRemarks] = useState(initialNote.remarks || '');

    // 외부(DB/API)에서 업데이트 된 값이 있으면 동기화
    useEffect(() => {
        setLocalPurpose(initialNote.purpose || '');
        setLocalRemarks(initialNote.remarks || '');
    }, [initialNote.purpose, initialNote.remarks]);

    const isSelected = selectedRows.has(summary.id);

    return (
        <tr className={`hover:bg-gray-50 transition border-l-4 border-l-blue-400 ${isSelected ? 'bg-blue-50/30' : ''}`}>
            <td className="p-3 pl-6 text-center">
                <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={isSelected}
                    onChange={() => handleRowSelect(summary.id)}
                />
            </td>
            <td className="p-3 font-mono text-[11px] text-gray-500">{summary.weekId}</td>
            <td className="p-3 whitespace-nowrap">{summary.date}</td>
            <td className="p-3">{summary.dayOfWeek}</td>
            <td className="p-3 whitespace-nowrap">{summary.school}</td>
            <td className="p-3">{summary.age}</td>
            <td className="p-3 font-bold text-gray-800">{summary.name}</td>
            <td className="p-3 font-mono text-xs">{summary.startTime}</td>
            <td className="p-3 font-mono text-xs">{summary.endTime}</td>
            <td className="p-3">
                <span className="text-[11px] text-gray-600 line-clamp-2 leading-tight" title={summary.usedSpaces}>
                    {summary.usedSpaces}
                </span>
            </td>
            <td className="p-3 font-mono text-xs text-blue-600 font-bold">{summary.durationStr}</td>
            <td className="p-3 text-xs text-gray-500">{summary.durationMin}</td>
            <td className={`p-1 min-w-[200px] transition-colors ${isCellSelected(idx, 'purpose') ? 'bg-blue-100/50' : ''}`}>
                <input
                    ref={el => inputRefs.current[`${idx}-purpose`] = el}
                    className={`w-full p-2 bg-transparent border-none outline-none focus:bg-blue-50/50 focus:ring-1 focus:ring-blue-100 rounded text-xs text-blue-700 font-bold transition-all ${isCellSelected(idx, 'purpose') ? 'placeholder-blue-300' : ''}`}
                    placeholder="방문목적..."
                    title={localPurpose}
                    value={localPurpose}
                    onChange={(e) => setLocalPurpose(e.target.value)}
                    onFocus={(e) => {
                        focusValRef.current[`${noteKey}_purpose`] = e.target.value;
                    }}
                    onBlur={(e) => {
                        const val = e.target.value;
                        setVisitNotes(prev => ({ ...prev, [noteKey]: { ...prev[noteKey], purpose: val } }));
                        const original = focusValRef.current[`${noteKey}_purpose`] || '';
                        if (val !== original) {
                            handleSaveNote(summary.userId, summary.date, 'purpose', val);
                        }
                    }}
                    onKeyDown={(e) => handleNoteKeyDown(e, idx, 'purpose')}
                    onPaste={(e) => handleNotePaste(e, idx, 'purpose')}
                    onMouseDown={() => handleCellMouseDown(idx, 'purpose')}
                    onMouseEnter={() => handleCellMouseEnter(idx, 'purpose')}
                />
            </td>
            <td className={`p-1 pr-6 min-w-[150px] transition-colors ${isCellSelected(idx, 'remarks') ? 'bg-blue-100/50' : ''}`}>
                <input
                    ref={el => inputRefs.current[`${idx}-remarks`] = el}
                    className={`w-full p-2 bg-transparent border-none outline-none focus:bg-gray-100/50 focus:ring-1 focus:ring-gray-200 rounded text-xs text-gray-500 transition-all ${isCellSelected(idx, 'remarks') ? 'placeholder-blue-300' : ''}`}
                    placeholder="비고..."
                    value={localRemarks}
                    onChange={(e) => setLocalRemarks(e.target.value)}
                    onFocus={(e) => {
                        focusValRef.current[`${noteKey}_remarks`] = e.target.value;
                    }}
                    onBlur={(e) => {
                        const val = e.target.value;
                        setVisitNotes(prev => ({ ...prev, [noteKey]: { ...prev[noteKey], remarks: val } }));
                        const original = focusValRef.current[`${noteKey}_remarks`] || '';
                        if (val !== original) {
                            handleSaveNote(summary.userId, summary.date, 'remarks', val);
                        }
                    }}
                    onKeyDown={(e) => handleNoteKeyDown(e, idx, 'remarks')}
                    onPaste={(e) => handleNotePaste(e, idx, 'remarks')}
                    onMouseDown={() => handleCellMouseDown(idx, 'remarks')}
                    onMouseEnter={() => handleCellMouseEnter(idx, 'remarks')}
                />
            </td>
        </tr>
    );
}, (prevProps, nextProps) => {
    // React.memo comparison for rendering optimization
    return (
        prevProps.summary === nextProps.summary &&
        prevProps.selectedRows.has(prevProps.summary.id) === nextProps.selectedRows.has(nextProps.summary.id) &&
        prevProps.isCellSelected === nextProps.isCellSelected &&
        // Only re-render if its explicit note object reference changes, not the entire visitNotes dictionary
        prevProps.visitNotes[`${prevProps.summary.userId}_${prevProps.summary.date}`] === nextProps.visitNotes[`${nextProps.summary.userId}_${nextProps.summary.date}`]
    );
});

export default LogTableRow;
