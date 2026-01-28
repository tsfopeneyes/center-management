import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { MapPin, ArrowRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [phoneInput, setPhoneInput] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            const { data, error } = await supabase.from('locations').select('*');
            if (error) throw error;
            setLocations(data || []);
        } catch (error) {
            console.error('Error fetching locations:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSearch = (e) => {
        e.preventDefault();
        if (phoneInput.length === 4) {
            // Navigate to search results or handle quick check-in
            console.log('Searching for user with phone ending in:', phoneInput);
        }
    };

    return (
        <div className="space-y-8">
            {/* Quick Access Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <User className="text-blue-600" />
                    빠른 입장 (전화번호 뒷자리)
                </h2>
                <form onSubmit={handleQuickSearch} className="flex gap-3">
                    <input
                        type="text"
                        maxLength="4"
                        placeholder="1234"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value.replace(/[^0-9]/g, ''))}
                        className="flex-1 text-2xl tracking-widest text-center p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 text-white px-6 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center"
                        disabled={phoneInput.length !== 4}
                    >
                        <ArrowRight size={24} />
                    </button>
                </form>
            </section>

            {/* Locations Status */}
            <section>
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MapPin className="text-green-600" />
                    장소별 현황
                </h2>

                {loading ? (
                    <div className="text-gray-400 text-center py-8">장소 정보를 불러오는 중...</div>
                ) : locations.length === 0 ? (
                    <div className="text-gray-400 text-center py-8 bg-gray-50 rounded-xl">등록된 장소가 없습니다.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {locations.map((loc) => (
                            <div key={loc.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition cursor-pointer">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{loc.name}</h3>
                                    <p className="text-sm text-gray-500">현재 인원: 0명</p>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
