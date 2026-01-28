import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Search, RefreshCw } from 'lucide-react';

const Admin = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('name');

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error.message);
            alert('사용자 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.name.includes(searchTerm) ||
        (user.phone_back4 && user.phone_back4.includes(searchTerm))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">사용자 관리</h1>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition">
                    <UserPlus size={20} />
                    신규 등록
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="이름 또는 전화번호 뒷자리 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition"
                        />
                    </div>
                    <button onClick={fetchUsers} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition">
                        <RefreshCw size={20} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-sm font-medium">
                            <tr>
                                <th className="p-4">이름</th>
                                <th className="p-4">학교</th>
                                <th className="p-4">성별</th>
                                <th className="p-4">전화번호(뒷자리)</th>
                                <th className="p-4">상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">로딩 중...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">검색 결과가 없습니다.</td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition">
                                        <td className="p-4 font-medium text-gray-800">{user.name}</td>
                                        <td className="p-4 text-gray-600">{user.school}</td>
                                        <td className="p-4 text-gray-600">{user.gender}</td>
                                        <td className="p-4 text-gray-600">{user.phone_back4}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                활동 중
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Admin;
