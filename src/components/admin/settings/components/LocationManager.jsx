import React from 'react';
import { Settings, Edit2, Trash2 } from 'lucide-react';

const LocationManager = ({
    isMaster,
    locations,
    locationGroups,
    tempGroupName,
    setTempGroupName,
    handleAddGroup,
    editGroupId,
    setEditGroupId,
    handleUpdateGroup,
    handleDeleteGroup,
    selectedGroupIdForLocation,
    setSelectedGroupIdForLocation,
    tempLocationName,
    setTempLocationName,
    handleAddLocation,
    editLocationId,
    setEditLocationId,
    handleUpdateLocation,
    handleDeleteLocation
}) => {
    if (!isMaster) {
        return (
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center py-12">
                <Settings size={48} className="text-gray-200 mb-4" />
                <h3 className="font-bold text-gray-400">마스터 권한이 필요한 메뉴입니다</h3>
                <p className="text-xs text-gray-400 mt-2">공간 관리 및 시스템 설정은 마스터 계정만 가능합니다.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
            <h3 className="font-bold text-base md:text-lg text-gray-700 flex items-center gap-2"><Settings size={20} /> 공간(Zone) 관리</h3>

            {/* Group Add */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">공간 그룹 (지역) 추가</h4>
                <div className="flex items-center gap-2">
                    <input type="text" value={tempGroupName} onChange={e => setTempGroupName(e.target.value)} placeholder="새 그룹 이름 (예: 하이픈)" className="flex-1 w-full min-w-0 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[40px]" />
                    <button onClick={handleAddGroup} className="bg-gray-800 text-white px-4 rounded-xl font-bold hover:bg-black shadow-sm text-sm whitespace-nowrap h-[40px] flex items-center justify-center transition-all">그룹 추가</button>
                </div>
            </div>

            {/* Location Add */}
            <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest">상세 공간 추가</h4>
                <div className="flex flex-col gap-2">
                    <select
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[40px] font-bold text-gray-700"
                        value={selectedGroupIdForLocation}
                        onChange={(e) => setSelectedGroupIdForLocation(e.target.value)}
                    >
                        <option value="" disabled>소속 그룹 선택</option>
                        {locationGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2">
                        <input type="text" value={tempLocationName} onChange={e => setTempLocationName(e.target.value)} placeholder="새 상세 공간 이름 (예: 2F 라운지)" className="flex-1 min-w-0 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[40px]" />
                        <button onClick={handleAddLocation} className="bg-blue-600 text-white px-4 rounded-xl font-bold hover:bg-blue-700 shadow-sm text-sm whitespace-nowrap h-[40px] flex items-center justify-center transition-all">공간 추가</button>
                    </div>
                </div>
            </div>

            {/* Location List by Group */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {/* Groups */}
                {locationGroups.map(group => {
                    const groupLocations = locations.filter(l => l.group_id === group.id);
                    return (
                        <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-gray-100 p-3 md:p-4 flex items-center justify-between group hover:bg-gray-200 transition">
                                {editGroupId === group.id ? (
                                    <input defaultValue={group.name} autoFocus onBlur={(e) => handleUpdateGroup(group.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroup(group.id, e.currentTarget.value)} className="flex-1 bg-white border border-gray-400 rounded px-2 py-1 outline-none text-sm font-bold" />
                                ) : (
                                    <span className="text-sm md:text-base text-gray-800 font-extrabold flex items-center gap-2">
                                        {group.name}
                                        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold">{groupLocations.length}</span>
                                    </span>
                                )}
                                <div className="flex gap-1">
                                    <button onClick={() => setEditGroupId(group.id)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-white rounded-lg transition"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            {/* Locations inside Group */}
                            <div className="bg-white divide-y divide-gray-50">
                                {groupLocations.length === 0 ? (
                                    <div className="p-4 text-xs text-center text-gray-400 font-bold">등록된 공간이 없습니다.</div>
                                ) : (
                                    groupLocations.map(loc => (
                                        <div key={loc.id} className="flex items-center justify-between p-3 pl-6 hover:bg-blue-50/50 transition group/loc">
                                            {editLocationId === loc.id ? (
                                                <input defaultValue={loc.name} autoFocus onBlur={(e) => handleUpdateLocation(loc.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateLocation(loc.id, e.currentTarget.value)} className="flex-1 bg-white border border-blue-300 rounded px-2 py-1 outline-none text-sm font-bold" />
                                            ) : (
                                                <span className="text-sm text-gray-600 font-bold">{loc.name}</span>
                                            )}
                                            <div className="flex gap-1 opacity-0 group-hover/loc:opacity-100 transition">
                                                <button onClick={() => setEditLocationId(loc.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDeleteLocation(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Unassigned Locations */}
                {locations.filter(l => !l.group_id).length > 0 && (
                    <div className="border border-orange-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-orange-50 p-3 md:p-4 flex items-center justify-between">
                            <span className="text-sm md:text-base text-orange-800 font-extrabold">소속 없는 공간</span>
                            <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-bold">{locations.filter(l => !l.group_id).length}</span>
                        </div>
                        <div className="bg-white divide-y divide-gray-50">
                            {locations.filter(l => !l.group_id).map(loc => (
                                <div key={loc.id} className="flex items-center justify-between p-3 pl-6 hover:bg-orange-50/50 transition group/loc">
                                    {editLocationId === loc.id ? (
                                        <input defaultValue={loc.name} autoFocus onBlur={(e) => handleUpdateLocation(loc.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateLocation(loc.id, e.currentTarget.value)} className="flex-1 bg-white border border-orange-300 rounded px-2 py-1 outline-none text-sm font-bold" />
                                    ) : (
                                        <span className="text-sm text-gray-600 font-bold">{loc.name}</span>
                                    )}
                                    <div className="flex gap-1 opacity-0 group-hover/loc:opacity-100 transition">
                                        <button onClick={() => setEditLocationId(loc.id)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-100 rounded-lg"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDeleteLocation(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationManager;
