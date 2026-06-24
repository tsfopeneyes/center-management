import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { format } from 'date-fns';
import { ClipboardCheck, Download, Calendar as CalendarIcon, Save } from 'lucide-react';
import DutyChecklist from './DutyChecklist';
import DutyReportForm from './DutyReportForm';
import DutyFeed from './DutyFeed';
import * as XLSX from 'xlsx';

const AdminDuty = ({ currentAdmin, users }) => {
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [activeTab, setActiveTab] = useState('START'); // START, END, REPORT
    const [loading, setLoading] = useState(false);
    
    // Data State
    const [dutyLogId, setDutyLogId] = useState(null);
    const [startChecklist, setStartChecklist] = useState({});
    const [endChecklist, setEndChecklist] = useState({});
    const [reportData, setReportData] = useState({});
    const [logManagerName, setLogManagerName] = useState('');
    const [checklistSettings, setChecklistSettings] = useState([]);

    useEffect(() => {
        fetchDutyLog();
    }, [selectedDate]);

    useEffect(() => {
        fetchChecklistSettings();
    }, []);

    const fetchChecklistSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('duty_checklist_settings')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });

            if (error) throw error;
            setChecklistSettings(data || []);
        } catch (error) {
            console.error('Failed to fetch duty checklist settings:', error);
        }
    };

    const fetchDutyLog = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('duty_logs')
                .select('*')
                .eq('duty_date', selectedDate)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setDutyLogId(data.id);
                setStartChecklist(data.start_checklist || {});
                setEndChecklist(data.end_checklist || {});
                setReportData(data.report_data || {});
                setLogManagerName(data.manager_name || '');
            } else {
                setDutyLogId(null);
                setStartChecklist({});
                setEndChecklist({});
                setReportData({});
                setLogManagerName('');
            }
        } catch (error) {
            console.error('Failed to fetch duty log:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (field, value) => {
        try {
            let newData = {};
            if (field === 'START') {
                newData = { start_checklist: value };
                setStartChecklist(value);
            } else if (field === 'END') {
                newData = { end_checklist: value };
                setEndChecklist(value);
            } else if (field === 'REPORT') {
                newData = { report_data: value };
                setReportData(value);
            }

            if (dutyLogId) {
                // Update existing
                await supabase
                    .from('duty_logs')
                    .update(newData)
                    .eq('id', dutyLogId);
            } else {
                // Insert new
                const { data, error } = await supabase
                    .from('duty_logs')
                    .insert([{
                        duty_date: selectedDate,
                        manager_name: currentAdmin?.name || 'Unknown',
                        ...newData
                    }])
                    .select()
                    .single();
                
                if (error) throw error;
                if (data) {
                    setDutyLogId(data.id);
                    setLogManagerName(data.manager_name);
                }
            }
        } catch (error) {
            console.error('Failed to save duty log:', error);
            alert('저장에 실패했습니다.');
        }
    };

    const handleExportExcel = async () => {
        try {
            // Fetch all duty logs (or a specific range)
            const { data: logs, error } = await supabase
                .from('duty_logs')
                .select('*')
                .order('duty_date', { ascending: false });

            if (error) throw error;

            if (!logs || logs.length === 0) {
                alert('다운로드할 당직 데이터가 없습니다.');
                return;
            }

            const excelData = logs.map(log => {
                const report = log.report_data || {};
                return {
                    '당직일자': log.duty_date,
                    '담당자': log.manager_name,
                    '6층 상황': report.floor_6_note || '',
                    '3층 상황': report.floor_3_note || '',
                    '2층 상황': report.floor_2_note || '',
                    '공간 불편 사항': report.inconvenience_note || '',
                    '당일 특이 사항': report.special_note || ''
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '당직 업무 보고');
            XLSX.writeFile(workbook, `당직보고서_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        } catch (error) {
            console.error('Failed to export excel:', error);
            alert('엑셀 다운로드에 실패했습니다.');
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-120px)]">
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-gray-100 flex flex-row justify-between items-center gap-2 bg-white z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <ClipboardCheck size={18} />
                    </div>
                    <h2 className="text-lg font-black text-gray-800 tracking-tight">당직 관리</h2>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-[130px] sm:w-[150px] pl-8 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-bold text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        <CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold transition-colors shadow-sm"
                        title="보고서 다운로드"
                    >
                        <Download size={14} />
                        <span className="hidden sm:inline sm:ml-1.5 text-sm">다운로드</span>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-3 md:px-4 pt-3 border-b border-gray-100 flex gap-4 overflow-x-auto custom-scrollbar bg-white z-10">
                {['START', 'END', 'REPORT', 'FEED'].map((tab) => {
                    const labels = { START: '시작 업무', END: '마감 업무', REPORT: '업무 보고', FEED: '당직피드' };
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 px-1 font-bold text-sm whitespace-nowrap transition-colors relative ${
                                activeTab === tab ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            {labels[tab]}
                            {activeTab === tab && (
                                <span className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/30">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400 font-bold">로딩 중...</div>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        {activeTab === 'START' && (
                            <DutyChecklist 
                                type="START" 
                                data={startChecklist} 
                                checklistSettings={checklistSettings}
                                onSave={(data) => handleSave('START', data)} 
                            />
                        )}
                        {activeTab === 'END' && (
                            <DutyChecklist 
                                type="END" 
                                data={endChecklist} 
                                checklistSettings={checklistSettings}
                                onSave={(data) => handleSave('END', data)} 
                            />
                        )}
                        {activeTab === 'REPORT' && (
                            <DutyReportForm 
                                data={reportData} 
                                currentAdmin={currentAdmin}
                                logManagerName={logManagerName}
                                onSave={(data) => handleSave('REPORT', data)} 
                            />
                        )}
                        {activeTab === 'FEED' && (
                            <DutyFeed />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDuty;
