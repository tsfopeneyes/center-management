import React from 'react';
import { Share2, Database, FileText, ShieldAlert } from 'lucide-react';

const IntegrationConfig = ({
    gsWebhookUrl,
    setGsWebhookUrl,
    notionApiKey,
    setNotionApiKey,
    notionDbId,
    setNotionDbId,
    kioskMasterPin,
    setKioskMasterPin,
    isBackingUp,
    isUploadingNotion,
    syncProgress,
    handleSaveIntegrations,
    handleGoogleSheetsBackup,
    handleNotionUpload
}) => {
    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-base md:text-lg text-gray-700 flex items-center gap-2"><Share2 size={20} /> 외부 서비스 연동</h3>
                <button onClick={handleSaveIntegrations} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition">설정 저장</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Google Sheets */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 text-green-600 font-bold mb-2">
                        <Database size={18} />
                        <span>Google Sheets 백업</span>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Apps Script Webhook URL</label>
                        <input
                            type="text"
                            value={gsWebhookUrl}
                            onChange={e => setGsWebhookUrl(e.target.value)}
                            placeholder="https://script.google.com/macros/s/.../exec"
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-500 transition text-sm"
                        />
                    </div>
                    <button
                        onClick={handleGoogleSheetsBackup}
                        disabled={isBackingUp}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-sm disabled:bg-gray-300 flex items-center justify-center gap-2 text-sm"
                    >
                        {isBackingUp ? '동기화 중...' : <><Database size={16} /> 모든 데이터 시트 동기화</>}
                    </button>
                    {syncProgress && (
                        <p className="text-xs text-blue-600 font-bold animate-pulse text-center">{syncProgress}</p>
                    )}
                    <p className="text-[10px] text-gray-400 leading-relaxed">* 구글 앱스 스크립트를 통해 시트에 로그를 전송합니다.</p>
                </div>

                {/* Notion */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 text-black font-bold mb-2">
                        <FileText size={18} />
                        <span>Notion 요약 업로드</span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Notion API Key</label>
                            <input
                                type="password"
                                value={notionApiKey}
                                onChange={e => setNotionApiKey(e.target.value)}
                                placeholder="secret_..."
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-800 transition text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Database ID</label>
                            <input
                                type="text"
                                value={notionDbId}
                                onChange={e => setNotionDbId(e.target.value)}
                                placeholder="32자리 ID"
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-800 transition text-sm"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleNotionUpload}
                        disabled={isUploadingNotion}
                        className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-black transition shadow-sm disabled:bg-gray-300 flex items-center justify-center gap-2 text-sm"
                    >
                        {isUploadingNotion ? '업로드 중...' : <><FileText size={16} /> 지금 노션으로 업로드</>}
                    </button>
                    <p className="text-[10px] text-gray-400 leading-relaxed">* 오늘 하루의 통계(방문자 등)를 노션 데이터베이스에 추가합니다.</p>
                </div>

                {/* Kiosk Master Pin */}
                <div className="space-y-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 md:col-span-2">
                    <div className="flex items-center gap-2 text-blue-600 font-bold mb-2">
                        <ShieldAlert size={18} />
                        <span>키오스크 보안 설정</span>
                    </div>
                    <div className="flex flex-col md:flex-row items-end gap-4">
                        <div className="flex-1 w-full">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">키오스크 마스터 핀 (4자리 숫자)</label>
                            <input
                                type="password"
                                maxLength="4"
                                value={kioskMasterPin}
                                onChange={e => setKioskMasterPin(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="1801"
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm font-mono tracking-widest"
                            />
                        </div>
                        <button
                            onClick={handleSaveIntegrations}
                            className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm text-sm"
                        >
                            마스터 핀 저장
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed">* 키오스크 진입 및 설정 변경 시 필요한 비밀번호입니다. 유출되지 않도록 주의하세요.</p>
                </div>
            </div>
        </div>
    );
};

export default IntegrationConfig;
