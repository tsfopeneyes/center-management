import React from 'react';
import { Layout, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';

const LayoutDesigner = ({
    dashboardConfig,
    sidebarConfig,
    configLoading,
    sidebarConfigLoading,
    handleMoveConfig,
    handleUpdateConfig,
    handleSaveDashboardConfig,
    handleMoveSidebarConfig,
    handleUpdateSidebarConfig,
    handleSaveSidebarConfig
}) => {
    return (
        <>
            {/* Dashboard Layout Customization */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-base md:text-lg text-gray-700 flex items-center gap-2"><Layout size={20} /> 학생 대시보드 레이아웃 설정</h3>
                    <button
                        onClick={handleSaveDashboardConfig}
                        disabled={configLoading}
                        className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition shadow-md disabled:bg-gray-300"
                    >
                        {configLoading ? '저장 중...' : '레이아웃 저장'}
                    </button>
                </div>

                <div className="space-y-3">
                    {dashboardConfig.map((item, index) => (
                        <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border transition ${item.isVisible ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => handleMoveConfig(index, -1)}
                                        disabled={index === 0}
                                        className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-0"
                                    ><ArrowUp size={16} /></button>
                                    <button
                                        onClick={() => handleMoveConfig(index, 1)}
                                        disabled={index === dashboardConfig.length - 1}
                                        className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-0"
                                    ><ArrowDown size={16} /></button>
                                </div>
                                <div>
                                    <span className="font-bold text-gray-700 block">{item.label}</span>
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">{item.id}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500">노출 개수</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={item.count}
                                        onChange={(e) => handleUpdateConfig(item.id, 'count', parseInt(e.target.value) || 1)}
                                        className="w-16 p-2 bg-gray-50 border border-gray-100 rounded-lg text-center text-sm font-bold outline-none focus:border-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={() => handleUpdateConfig(item.id, 'isVisible', !item.isVisible)}
                                    className={`p-2.5 rounded-xl transition-all ${item.isVisible ? 'bg-blue-50 text-blue-600 shadow-sm' : 'bg-gray-200 text-gray-500'}`}
                                >
                                    {item.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="mt-4 text-[10px] text-gray-400 leading-relaxed">* 학생 대시보드 홈 탭에 표시되는 섹션의 순서와 노출 개수를 설정합니다. 상하 화살표로 순서를 변경하세요.</p>
            </div>

            {/* Admin Sidebar Layout Customization */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-base md:text-lg text-gray-700 flex items-center gap-2"><Layout size={20} /> 관리자 사이드바 메뉴 설정</h3>
                    <button
                        onClick={handleSaveSidebarConfig}
                        disabled={sidebarConfigLoading}
                        className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition shadow-md disabled:bg-gray-300"
                    >
                        {sidebarConfigLoading ? '저장 중...' : '사이드바 저장'}
                    </button>
                </div>

                <div className="space-y-3">
                    {sidebarConfig.map((item, index) => (
                        <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border transition ${item.isVisible ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => handleMoveSidebarConfig(index, -1)}
                                        disabled={index === 0}
                                        className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-0"
                                    ><ArrowUp size={16} /></button>
                                    <button
                                        onClick={() => handleMoveSidebarConfig(index, 1)}
                                        disabled={index === sidebarConfig.length - 1}
                                        className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-0"
                                    ><ArrowDown size={16} /></button>
                                </div>
                                <div>
                                    <span className="font-bold text-gray-700 block">{item.label}</span>
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">{item.id}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <button
                                    onClick={() => handleUpdateSidebarConfig(item.id, 'isVisible', !item.isVisible)}
                                    className={`p-2.5 rounded-xl transition-all ${item.isVisible ? 'bg-blue-50 text-blue-600 shadow-sm' : 'bg-gray-200 text-gray-500'}`}
                                >
                                    {item.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="mt-4 text-[10px] text-gray-400 leading-relaxed">* 관리자 메뉴의 순서와 노출 여부를 설정합니다. 상하 화살표로 순서를 변경하세요.</p>
            </div>
        </>
    );
};

export default LayoutDesigner;
