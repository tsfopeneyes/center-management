import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ClipboardList, Trash2, UserPlus, Users, CheckCheck, Search } from 'lucide-react';
import UserAvatar from '../../../../common/UserAvatar';
import UserCategoryBadge from '../../../../common/UserCategoryBadge';
import { exportParticipantsToExcel } from '../../../../../utils/exportUtils';
import { usesDailySessionRsvp } from '../../../../../utils/dailyProgramSessions';
import { readLegacyGuestFields } from '../../../../../features/programs/applicationFields';
import { participantAnswerCellStates, participantAnswerColumns, participantAnswerDetails, questionAudienceLabel, sortParticipantsByAnswer } from '../../../../../features/programs/application/participantAnswerColumns';

const AttendanceSection = ({ notice, participantList, onAttendanceToggle, onStaffToggle, onDeleteParticipant,
    onMarkAllAttended, setShowEntranceList, selectedDate, availableDates = [], onUserClick, onColumnsChange }) => {
    const participants = participantList.JOIN || [];
    const waiting = participantList.WAITLIST || [];
    const isSessionBased = usesDailySessionRsvp(notice) || (notice.is_recruiting !== false && availableDates.length > 0);
    const isOpen = notice.is_recruiting === false && !isSessionBased;
    const isDateBased = notice.is_recruiting === false || isSessionBased;
    const fields = useMemo(() => readLegacyGuestFields(notice.guest_properties), [notice.guest_properties]);
    const currentQuestions = Array.isArray(notice.application_form?.questions) ? notice.application_form.questions : fields;
    const columns = useMemo(() => participantAnswerColumns(participants, fields, currentQuestions), [participants, fields, currentQuestions]);
    useEffect(() => { onColumnsChange?.(columns.length > 0); }, [columns.length, onColumnsChange]);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const sortedParticipants = useMemo(() => sortParticipantsByAnswer(participants.filter(person => `${person.name || ''} ${person.school || ''} ${person.phone_back4 || ''}`.toLowerCase().includes(query.trim().toLowerCase())),
        columns.find(column => column.key === sort?.key), sort?.direction, fields, currentQuestions), [participants, columns, sort, fields, currentQuestions, query]);
    const toggleQuestionSort = key => setSort(previous => previous?.key !== key
        ? { key, direction: 'asc' }
        : previous.direction === 'asc' ? { key, direction: 'desc' } : null);
    const attended = participants.filter(person => person.is_attended).length;
    const missing = participants.length - attended;
    const span = (isOpen ? 4 : 5) + columns.length;

    return <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-hide bg-[#f9fafb] p-4 md:p-6">
        <div className="pb-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">참여자 명단 <span className="rounded-lg bg-[#F4DDD4] px-2 py-0.5 text-sm text-[#CF3A27]">{participants.length}명</span></h3>
                    <p className="mt-1.5 flex items-center gap-3 text-sm text-slate-500">{!isOpen ? <><span className="text-emerald-700">출석 {attended}명</span><span>미출석 {missing}명</span></> : '참여자 정보와 출석을 확인하세요.'}</p></div>
                <div className="flex w-full sm:w-auto gap-2">
                    <button type="button" disabled={!participants.length} onClick={() => exportParticipantsToExcel(sortedParticipants, notice.title, fields, currentQuestions, columns)}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><ClipboardList size={16} /><span className="hidden sm:inline">엑셀 다운로드</span><span className="sm:hidden">엑셀</span></button>
                    {!isOpen && <button type="button" disabled={!missing} onClick={onMarkAllAttended} className="min-h-10 rounded-xl bg-slate-100 px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"><CheckCheck size={16} className="inline mr-1.5" /><span className="hidden sm:inline">전체 참석 처리</span><span className="sm:hidden">전체 출석</span></button>}
                    <button type="button" onClick={() => setShowEntranceList(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#CF3A27] px-3 text-xs sm:text-sm font-semibold text-white hover:bg-[#B93223]"><UserPlus size={16} /><span className="hidden sm:inline">{isSessionBased ? '명단 추가' : '명단 추가 (지급)'}</span><span className="sm:hidden">추가</span></button>
                </div>
            </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 text-slate-500"><Search size={18} /><input aria-label="참여자 검색" placeholder="이름, 학교, 연락처 뒷자리 검색" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none" /></label>
        <div className={columns.length ? 'md:hidden space-y-2' : 'space-y-2'}>
            {sortedParticipants.map(person => {
                const cells = participantAnswerCellStates(person, columns, fields, currentQuestions);
                return <article key={person.id} className="rounded-2xl bg-white p-4 hover:bg-[#F8E8E4] focus-within:bg-[#F8E8E4]">
                    <div className="flex items-center gap-3">
                        {!isOpen && <input type="checkbox" checked={Boolean(person.is_attended)} onChange={() => onAttendanceToggle(person.id, person.is_attended)} aria-label={person.name + ' 출석'} className="h-5 w-5 shrink-0 accent-[#CF3A27]" />}
                        <button type="button" onClick={() => onUserClick?.(person)} className="flex min-w-0 flex-1 items-center gap-3 text-left group">
                            <UserAvatar user={person} size="w-10 h-10" textSize="text-sm" />
                            <div className="min-w-0 md:flex md:flex-1 md:items-center md:gap-5">
                                <div className="min-w-0 md:w-40"><span className="font-bold text-slate-900 group-hover:text-[#CF3A27]">{person.name?.replace('(guest)', '').trim()}</span></div>
                                <p className="mt-1 text-xs text-slate-500 md:mt-0 md:text-sm">{person.school || '학교 미등록'}<span className="ml-2 tabular-nums">{person.phone_back4 || ''}</span></p>
                            </div>
                        </button>
                        <div className="shrink-0 text-center"><span className="mb-1 block text-[10px] text-slate-400 md:hidden">구분</span><UserCategoryBadge user={person} /></div>
                        <div className="flex shrink-0 items-center gap-1">
                            {!isOpen && !isSessionBased && <button type="button" onClick={() => onStaffToggle(person.id, person.is_staff)} aria-pressed={Boolean(person.is_staff)} className={person.is_staff ? 'rounded-lg bg-[#F4DDD4] px-2 py-2 text-xs font-bold text-[#B93223]' : 'rounded-lg bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-500'}>스탭</button>}
                            <button type="button" onClick={() => onDeleteParticipant(person.id, person.name)} aria-label={person.name + (isOpen ? ' 출석 취소 및 하이픈 회수' : ' 신청 취소')} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    {participantAnswerDetails(person, fields, currentQuestions).length > 0 && <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer">이전 질문 답변</summary>{participantAnswerDetails(person, fields, currentQuestions).map((entry, index) => <div key={index} className="mt-2"><p className="font-semibold">{entry.label}</p><p className="whitespace-pre-wrap break-words">{entry.answer}</p></div>)}</details>}
                    {columns.length > 0 && <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3">{columns.map((column, index) => <div key={column.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm"><dt className="text-slate-500">{column.label}</dt><dd className="whitespace-pre-wrap break-words text-slate-800">{cells[index].kind === 'not_applicable' ? '해당 없음' : cells[index].answer || '답변 없음'}</dd></div>)}</dl>}
                </article>;
            })}
            {!sortedParticipants.length && <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-500">{query ? '검색 결과가 없습니다.' : '등록된 참여자가 없습니다.'}</p>}
        </div>
        {columns.length > 0 && <div className="hidden md:block overflow-hidden rounded-2xl bg-white">
            <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead className="bg-[#f9fafb] text-xs font-semibold text-slate-500"><tr>
                        {!isOpen && <th scope="col" className="sticky left-0 z-20 w-[64px] min-w-[64px] border-b border-slate-100 bg-[#f9fafb] px-3 py-2.5 text-center">출석</th>}
                        <th scope="col" className={`sticky z-20 w-[140px] min-w-[140px] border-b border-slate-100 bg-[#f9fafb] px-4 py-2.5 ${isOpen ? 'left-0' : 'left-[64px]'}`}>이름</th>
                        <th scope="col" className="w-[88px] min-w-[88px] border-b border-slate-100 px-3 py-2.5">구분</th>
                        <th scope="col" className="min-w-[160px] border-b border-slate-100 px-4 py-2.5">학교·연락처</th>
                        {columns.map(col => <th key={col.key} scope="col" aria-sort={sort?.key === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="min-w-[160px] max-w-[220px] border-b border-slate-100 px-4 py-2.5">
                            <button type="button" title={`${col.label} · ${questionAudienceLabel(col.audience)} · 클릭하여 정렬`} aria-label={`${col.shortLabel}: ${col.label}, ${questionAudienceLabel(col.audience)}, 답변 정렬`} onClick={() => toggleQuestionSort(col.key)} className={`inline-flex items-center gap-1 rounded font-semibold hover:text-[#CF3A27] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CF3A27] ${sort?.key === col.key ? 'text-[#CF3A27]' : 'text-slate-500'}`}>{col.shortLabel}<span className="ml-1 text-[11px] font-normal text-slate-400">{questionAudienceLabel(col.audience)}</span><span aria-hidden="true" className="text-[11px]">{sort?.key === col.key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button>
                        </th>)}
                        <th scope="col" className="w-[128px] min-w-[128px] border-b border-slate-100 px-4 py-2.5 text-center">관리</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedParticipants.map(person => {
                            const cells = participantAnswerCellStates(person, columns, fields, currentQuestions);
                            const previousAnswers = participantAnswerDetails(person, fields, currentQuestions);
                            const detail = expanded?.personId === person.id ? expanded : null;
                            return <React.Fragment key={person.id}><tr className="group hover:bg-[#F8E8E4] focus-within:bg-[#F8E8E4]">
                                {!isOpen && <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F8E8E4] group-focus-within:bg-[#F8E8E4] px-3 py-2.5 text-center"><input type="checkbox" checked={Boolean(person.is_attended)} onChange={() => onAttendanceToggle(person.id, person.is_attended)} aria-label={`${person.name} 출석`} className="h-4 w-4 cursor-pointer accent-[#CF3A27]" /></td>}
                                <td className={`sticky z-10 bg-white group-hover:bg-[#F8E8E4] group-focus-within:bg-[#F8E8E4] px-4 py-2.5 ${isOpen ? 'left-0' : 'left-[64px]'}`}>
                                    <button type="button" onClick={() => onUserClick?.(person)} className="flex items-center gap-2.5 text-left font-semibold text-slate-900 hover:text-[#B93223]"><UserAvatar user={person} size="w-9 h-9" textSize="text-sm" />{person.name?.replace('(guest)', '').trim()}</button>
                                    {previousAnswers.length > 0 && <button type="button" onClick={() => setExpanded(detail?.columnKey === 'history' ? null : { personId: person.id, columnKey: 'history', name: person.name, historical: previousAnswers })} className="mt-1 text-xs text-slate-500 underline-offset-2 hover:text-[#B93223] hover:underline">이전 질문 {previousAnswers.length}개</button>}
                                </td>
                                <td className="px-3 py-2.5"><UserCategoryBadge user={person} /></td>
                                <td className="px-4 py-2.5 text-slate-700"><div className="font-medium">{person.school || '—'}</div><div className="mt-1 text-xs text-slate-500">{person.phone_back4 || '—'}</div></td>
                                {columns.map((col, index) => <td key={col.key} className="max-w-[220px] px-4 py-2.5 text-slate-700">{cells[index].kind === 'not_applicable' ? <span className="text-xs text-slate-400">해당 없음</span> : cells[index].kind === 'blank' ? <span title={cells[index].audienceUnknown ? '신청 당시 회원·비회원 구분 기록 없음' : '답변 없음'} className="text-slate-400">—</span> : <button type="button" title="답변 전체 보기" onClick={() => setExpanded(detail?.columnKey === col.key ? null : { personId: person.id, columnKey: col.key, name: person.name, label: col.label, answer: cells[index].answer })} className="line-clamp-2 break-words text-left hover:text-[#B93223] hover:underline">{cells[index].answer}</button>}</td>)}
                                <td className="px-3 py-2.5 text-center"><div className="flex items-center justify-center gap-2">
                                    {isOpen ? <button type="button" onClick={() => onDeleteParticipant(person.id, person.name)} title="출석 취소 및 하이픈 회수" className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">출석 취소</button> : <>
                                        {!isSessionBased && <button type="button" onClick={() => onStaffToggle(person.id, person.is_staff)} aria-pressed={Boolean(person.is_staff)} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${person.is_staff ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>스탭</button>}
                                        <button type="button" onClick={() => onDeleteParticipant(person.id, person.name)} aria-label={`${person.name} 신청 취소`} title="신청 취소" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>
                                    </>}
                                </div></td>
                            </tr>{detail && <tr><td colSpan={span} className="bg-slate-50 px-5 py-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold text-slate-600">{detail.name} · {detail.historical ? '이전 질문 답변' : detail.label}</p>{detail.historical ? <div className="mt-2 space-y-2">{detail.historical.map((entry, index) => <div key={`${entry.id}-${index}`} className="text-sm"><span className="font-medium text-slate-700">{entry.label} ({questionAudienceLabel(entry.audience)})</span>{!entry.definitionKnown && <span className="ml-2 text-xs text-slate-400">당시 질문 기록 없음</span>}<p className="whitespace-pre-wrap break-words text-slate-600">{entry.answer}</p></div>)}</div> : <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{detail.answer}</p>}</div><button type="button" onClick={() => setExpanded(null)} className="shrink-0 text-xs font-semibold text-slate-600 hover:underline">닫기</button></div></td></tr>}</React.Fragment>;
                        })}
                        {!sortedParticipants.length && <tr><td colSpan={span} className="px-5 py-12 text-center text-sm text-slate-500">{isDateBased ? `${selectedDate}에 등록된 참여자가 없습니다.` : '신청한 참여자가 없습니다.'}</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>

        }

        {!isOpen && waiting.length > 0 && <section className="border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-700">대기 명단 <span className="ml-1 text-[#CF3A27]">{waiting.length}명</span></h4>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-sm text-slate-600">{waiting.map(person => <div key={person.id} className="inline-flex items-center gap-1"><button type="button" onClick={() => onUserClick?.(person)} className="font-medium hover:underline">{person.name?.replace('(guest)', '').trim()}</button><button type="button" onClick={() => onDeleteParticipant(person.id, person.name)} aria-label={`${person.name} 대기 신청 취소`} className="p-1 text-slate-400 hover:text-red-700"><Trash2 size={14} /></button></div>)}</div>
        </section>}
    </div>;
};

AttendanceSection.propTypes = {
    notice: PropTypes.object.isRequired, participantList: PropTypes.object.isRequired,
    onAttendanceToggle: PropTypes.func.isRequired, onStaffToggle: PropTypes.func.isRequired,
    onDeleteParticipant: PropTypes.func.isRequired, onMarkAllAttended: PropTypes.func.isRequired,
    setShowEntranceList: PropTypes.func.isRequired, selectedDate: PropTypes.string,
    availableDates: PropTypes.arrayOf(PropTypes.string),
    onUserClick: PropTypes.func,
};

export default React.memo(AttendanceSection);
