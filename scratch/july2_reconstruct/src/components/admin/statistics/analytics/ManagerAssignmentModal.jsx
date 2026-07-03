import React, { useState, useEffect } from 'react';
import { X, Search, CheckCircle2, Save, MapPin } from 'lucide-react';
import { userApi } from '../../../../api/userApi';

const ManagerAssignmentModal = ({ isOpen, onClose, selectedRegion, users, onSave }) => {
    const [staffList, setStaffList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [assignmentChanges, setAssignmentChanges] = useState({}); // { userId: initialRegion }

    useEffect(() => {
        if (isOpen && users && selectedRegion) {
            // Filter only STAFF and ADMIN users
            const eligibleStaff = users.filter(u =>
                u.user_group === 'STAFF' || u.user_group === '관리자' || u.role === 'admin' || u.name === 'admin'
            );

            setStaffList(eligibleStaff);
            setAssignmentChanges({});
            setSearchTerm('');
        }
    }, [isOpen, users, selectedRegion]);

    if (!isOpen || !selectedRegion) return null;

    const filteredStaff = staffList.filter(staff =>
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAssigned = (user) => {
        const currentRegion = assignmentChanges[user.id] !== undefined
            ? assignmentChanges[user.id]
            : user.preferences?.seucheoRegion;
        return currentRegion === selectedRegion;
    };

    const toggleAssignment = (user) => {
        const currentlyAssigned = isAssigned(user);
        setTimeout(() => { // slight delay for smooth visual feedback
            setAssignmentChanges(prev => ({
                ...prev,
                [user.id]: currentlyAssigned ? null : selectedRegion
            }));
        }, 50);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const changes = Object.entries(assignmentChanges);

            if (changes.length > 0) {
                // Update preferences in parallel
                await Promise.all(changes.map(([userId, newRegion]) =>
                    userApi.updateUserPreferences(userId, { seucheoRegion: newRegion })
                ));
            }

            alert(`${selectedRegion} 담당자 설정이 저장되었습니다.`);
            if (onSave) onSave(); // Call refetch
            onClose();
        } catch (error) {
            console.error('Error saving manager assignments:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 mb-1">
                            <MapPin size={18} className="fill-indigo-100" />
                            <span className="text-[10px] font-black uppercase tracking-wider">권역 담당자 관리</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">
                            [{selectedRegion}] 담당자 지정
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-full transition text-gray-400 hover:text-gray-600 shadow-sm border border-transparent hover:border-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="이름으로 스태프 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-sm text-gray-700"
                        />
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                    <div className="space-y-2">
                        {filteredStaff.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 text-sm font-bold">
                                검색된 스태프가 없습니다.
                            </div>
                        ) : (
                            filteredStaff.map((staff) => {
                                const assigned = isAssigned(staff);
                                return (
                                    <div
                                        key={staff.id}
                                        onClick={() => toggleAssignment(staff)}
                                        className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${assigned
                                                ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm tracking-tighter ${assigned
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {staff.name.substring(0, 2)}
                                            </div>
                                            <div>
                                                <p className={`font-bold ${assigned ? 'text-indigo-900' : 'text-gray-700'}`}>
                                                    {staff.name}
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400">
                                                    {staff.user_group} {staff.preferences?.seucheoRegion && staff.preferences.seucheoRegion !== selectedRegion && !assigned ? `(현재: ${staff.preferences.seucheoRegion})` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`transition-all ${assigned ? 'scale-110 opacity-100' : 'scale-90 opacity-0'}`}>
                                            <CheckCircle2 className="text-indigo-600" size={24} />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-white">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl font-black text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save size={18} /> 설정 저장하기
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManagerAssignmentModal;
