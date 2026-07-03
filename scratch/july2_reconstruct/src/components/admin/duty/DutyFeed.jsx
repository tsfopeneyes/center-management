import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertTriangle, AlertCircle, Building2, Layers, CheckCircle2 } from 'lucide-react';

const DutyFeed = () => {
    const [feedLogs, setFeedLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFeedData();
    }, []);

    const fetchFeedData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('duty_logs')
                .select('*')
                .order('duty_date', { ascending: false })
                .limit(50);

            if (error) throw error;

            // Filter logs that have at least one valid note
            const filtered = data.filter(log => {
                const report = log.report_data || {};
                return (
                    (report.special_note && report.special_note.trim() !== '') ||
                    (report.inconvenience_note && report.inconvenience_note.trim() !== '') ||
                    (report.floor_6_note && report.floor_6_note.trim() !== '') ||
                    (report.floor_3_note && report.floor_3_note.trim() !== '') ||
                    (report.floor_2_note && report.floor_2_note.trim() !== '')
                );
            });

            setFeedLogs(filtered);
        } catch (error) {
            console.error('Failed to fetch duty feed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                <div className="font-bold">당직피드를 불러오는 중입니다...</div>
            </div>
        );
    }

    if (feedLogs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center bg-white rounded-2xl border border-gray-100 shadow-sm mt-4">
                <CheckCircle2 size={48} className="text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-700 mb-2">기록된 특이사항이 없습니다</h3>
                <p className="text-sm">최근 50일 동안 특별히 보고된 문제가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24 mt-2">
            {feedLogs.map((log) => {
                const report = log.report_data || {};
                const parsedDate = parseISO(log.duty_date);
                const formattedDate = format(parsedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko });

                return (
                    <div key={log.id} className="bg-white rounded-2xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden transition-all hover:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.12)]">
                        {/* Header */}
                        <div className="bg-gray-50/80 px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📅</span>
                                <h3 className="font-black text-gray-800 tracking-tight">{formattedDate}</h3>
                            </div>
                            <div className="text-sm font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                                담당: <span className="text-gray-800">{log.manager_name || '관리자'}</span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            {report.special_note && report.special_note.trim() !== '' && (
                                <div className="bg-red-50/50 rounded-xl p-4 border border-red-100 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                                    <div className="flex items-center gap-2 mb-2 text-red-600">
                                        <AlertTriangle size={18} className="stroke-[2.5]" />
                                        <span className="font-black text-sm">당일 특이 사항</span>
                                    </div>
                                    <p className="text-gray-800 text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap pl-1">
                                        {report.special_note}
                                    </p>
                                </div>
                            )}

                            {report.inconvenience_note && report.inconvenience_note.trim() !== '' && (
                                <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                                    <div className="flex items-center gap-2 mb-2 text-orange-600">
                                        <AlertCircle size={18} className="stroke-[2.5]" />
                                        <span className="font-black text-sm">공간 불편 사항</span>
                                    </div>
                                    <p className="text-gray-800 text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap pl-1">
                                        {report.inconvenience_note}
                                    </p>
                                </div>
                            )}

                            {report.floor_6_note && report.floor_6_note.trim() !== '' && (
                                <div className="bg-blue-50/40 rounded-xl p-4 border border-blue-50 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
                                    <div className="flex items-center gap-2 mb-2 text-blue-600">
                                        <Building2 size={16} className="stroke-[2.5]" />
                                        <span className="font-black text-sm">6층 상황</span>
                                    </div>
                                    <p className="text-gray-700 text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap pl-1">
                                        {report.floor_6_note}
                                    </p>
                                </div>
                            )}

                            {report.floor_3_note && report.floor_3_note.trim() !== '' && (
                                <div className="bg-cyan-50/40 rounded-xl p-4 border border-cyan-50 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                                    <div className="flex items-center gap-2 mb-2 text-cyan-700">
                                        <Layers size={16} className="stroke-[2.5]" />
                                        <span className="font-black text-sm">3층 상황</span>
                                    </div>
                                    <p className="text-gray-700 text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap pl-1">
                                        {report.floor_3_note}
                                    </p>
                                </div>
                            )}

                            {report.floor_2_note && report.floor_2_note.trim() !== '' && (
                                <div className="bg-indigo-50/40 rounded-xl p-4 border border-indigo-50 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
                                    <div className="flex items-center gap-2 mb-2 text-indigo-600">
                                        <Layers size={16} className="stroke-[2.5]" />
                                        <span className="font-black text-sm">2층 상황</span>
                                    </div>
                                    <p className="text-gray-700 text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap pl-1">
                                        {report.floor_2_note}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DutyFeed;
