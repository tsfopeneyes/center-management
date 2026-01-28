import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MapPin, LogIn, LogOut, ArrowRightLeft, Camera, X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

const CheckIn = () => {
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [phoneInput, setPhoneInput] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
    const [lastScan, setLastScan] = useState({ code: '', time: 0 }); // For debouncing continuous scans

    useEffect(() => {
        const fetchLocs = async () => {
            const { data } = await supabase.from('locations').select('*');
            if (data) setLocations(data);
        };
        fetchLocs();

        const savedLoc = localStorage.getItem('kiosk_location');
        if (savedLoc) setSelectedLocation(JSON.parse(savedLoc));
    }, []);

    const handleSetLocation = (loc) => {
        setSelectedLocation(loc);
        localStorage.setItem('kiosk_location', JSON.stringify(loc));
        setMessage(`위치가 '${loc.name}'(으)로 설정되었습니다.`);
        setTimeout(() => setMessage(''), 3000);
    };

    const processCheckIn = async (inputCode) => {
        // Input could be phone_back4 (4 digits) OR full ID from QR
        // Logic: Try to find by phone_back4 first.
        // If QR contains Full UUID, find by ID.

        setLoading(true);
        let user = null;

        try {
            // 1. Identify User
            if (inputCode.length === 4) {
                const { data, error } = await supabase.from('users').select('*').eq('phone_back4', inputCode);
                if (data && data.length > 0) user = data[0]; // Assuming unique or first
            } else {
                // Assume it's a UUID or Phone Back 4 inside QR
                // If QR just has "1234", treat as back 4.
                if (inputCode.length === 4) {
                    const { data } = await supabase.from('users').select('*').eq('phone_back4', inputCode);
                    if (data && data.length > 0) user = data[0];
                } else {
                    // Maybe it is a full ID?
                    const { data } = await supabase.from('users').select('*').eq('id', inputCode); // Try ID
                    if (!data || data.length === 0) {
                        // Try Phone Back 4 again just in case QR has it
                        const { data: d2 } = await supabase.from('users').select('*').eq('phone_back4', inputCode);
                        if (d2 && d2.length > 0) user = d2[0];
                    } else {
                        user = data[0];
                    }
                }
            }

            if (!user) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            // 2. Get Last Log
            const { data: lastLogs } = await supabase
                .from('logs')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            let nextType = 'CHECKIN';
            let statusMessage = '입실';

            if (lastLogs && lastLogs.length > 0) {
                const lastLog = lastLogs[0];
                if (lastLog.type === 'CHECKOUT') {
                    nextType = 'CHECKIN'; statusMessage = '입실';
                } else {
                    if (lastLog.location_id === selectedLocation.id) {
                        nextType = 'CHECKOUT'; statusMessage = '퇴실';
                    } else {
                        nextType = 'MOVE'; statusMessage = '이동';
                    }
                }
            }

            // 3. Insert Log
            const { error: insertError } = await supabase.from('logs').insert([{
                user_id: user.id,
                location_id: selectedLocation.id,
                type: nextType
            }]);
            if (insertError) throw insertError;

            setMessage(`${user.name}님 ${statusMessage} 처리되었습니다.`);

        } catch (err) {
            console.error(err);
            setMessage(err.message || '오류가 발생했습니다.');
        } finally {
            setLoading(false);
            setPhoneInput('');
            // setShowScanner(false); // REMOVED: Keep scanner open for continuous mode
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!selectedLocation) return alert('장소 설정 필요');
        if (phoneInput.length !== 4) return;
        processCheckIn(phoneInput);
    };

    const handleScan = (result) => {
        if (result && result.length > 0) {
            const val = result[0]?.rawValue || result;
            if (!val) return;

            // Debounce: prevent same code scan within 5 seconds
            const now = Date.now();
            if (val === lastScan.code && (now - lastScan.time < 5000)) {
                return;
            }

            console.log('Scanned:', val);
            setLastScan({ code: val, time: now });
            processCheckIn(val);
        }
    };

    const handleError = (error) => {
        console.log(error);
    };

    if (!selectedLocation) {
        /* Initial Location Select UI (Same as before) */
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-md">
                <h1 className="text-xl font-bold text-gray-800 mb-4">키오스크 위치 설정</h1>
                <div className="grid grid-cols-1 gap-3">
                    {locations.map(loc => (
                        <button key={loc.id} onClick={() => handleSetLocation(loc)} className="p-4 border hover:bg-blue-50 text-left font-medium rounded-lg">
                            {loc.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto mt-4 pb-20">
            {/* Header Info */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6">
                <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="text-blue-600" size={20} />
                    <span className="font-semibold">{selectedLocation.name}</span>
                </div>
                <button onClick={() => { localStorage.removeItem('kiosk_location'); setSelectedLocation(null); }} className="text-xs text-gray-400 underline">
                    위치 변경
                </button>
            </div>

            {/* Scanner Mode */}
            {showScanner ? (
                <div className="bg-black p-4 rounded-3xl shadow-xl relative overflow-hidden h-96 flex flex-col items-center justify-center">
                    <Scanner
                        onScan={handleScan}
                        onError={handleError}
                        constraints={{ facingMode }}
                        components={{ audio: false, torch: false }}
                        styles={{ container: { width: '100%', height: '100%' } }}
                    />

                    {/* Control Buttons */}
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button
                            onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                            className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/40 transition"
                            title="카메라 전환"
                        >
                            <ArrowRightLeft size={20} />
                        </button>
                        <button
                            onClick={() => setShowScanner(false)}
                            className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/40 transition"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {message && (
                        <div className={`absolute top-20 left-4 right-4 p-3 rounded-xl font-bold text-center z-30 animate-fade-in
                            ${message.includes('오류') || message.includes('없습니다') ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                            {message}
                        </div>
                    )}

                    <p className="absolute bottom-6 text-white bg-black/50 px-4 py-2 rounded-full text-sm">QR 코드를 비쳐주세요</p>
                </div>
            ) : (
                /* Manual Mode */
                <div className="bg-white p-8 rounded-3xl shadow-xl text-center border border-gray-100 relative">
                    {/* QR Toggle Button */}
                    <button
                        onClick={() => setShowScanner(true)}
                        className="absolute top-4 right-4 p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
                        title="QR 스캔 모드"
                    >
                        <Camera size={24} />
                    </button>

                    <h2 className="text-2xl font-bold text-gray-800 npmmb-2">입실 / 퇴실</h2>
                    <p className="text-gray-400 text-sm mb-8">번호 4자리 입력 또는 QR 스캔</p>

                    <form onSubmit={handleManualSubmit}>
                        <input
                            type="text"
                            maxLength="4"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full text-5xl tracking-[0.5em] text-center p-6 border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none mb-8 font-mono bg-transparent"
                            placeholder="0000"
                            autoFocus={!showScanner}
                        />
                        <button
                            type="submit"
                            disabled={phoneInput.length !== 4 || loading}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition shadow-lg
                 ${phoneInput.length === 4
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                        >
                            {loading ? '처리 중...' : '확인'}
                        </button>
                    </form>

                    {message && (
                        <div className={`mt-6 p-4 rounded-xl font-bold animate-bounce-short
               ${message.includes('오류') || message.includes('없습니다') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {message}
                        </div>
                    )}
                </div>
            )}

            {/* Guide */}
            {!showScanner && (
                <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs text-gray-400">
                    <div className="flex flex-col items-center gap-1"><div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600"><LogIn size={18} /></div><p>입실</p></div>
                    <div className="flex flex-col items-center gap-1"><div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><ArrowRightLeft size={18} /></div><p>이동</p></div>
                    <div className="flex flex-col items-center gap-1"><div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600"><LogOut size={18} /></div><p>퇴실</p></div>
                </div>
            )}
        </div>
    );
};

export default CheckIn;
