import React from 'react';
import { motion } from 'framer-motion';
import { School, Users } from 'lucide-react';

const SchoolCard = ({ group, onClick }) => {
    const meta = group.metadata;
    return (
        <motion.div
            whileHover={{ y: -5, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
            onClick={onClick}
            className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm cursor-pointer transition-all hover:border-indigo-200"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <School size={24} />
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${meta?.region === '강동' ? 'bg-blue-100 text-blue-600' : meta?.region === '강서' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                    {meta?.region || '지역 미지정'}
                </span>
            </div>

            <h3 className="text-lg font-black text-gray-800 mb-1 truncate">{group.name}</h3>
            <p className="text-xs font-bold text-gray-400 mb-4">{meta?.club_name || '동아리 정보 없음'}</p>

            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-gray-500">
                    <Users size={14} />
                    <span className="text-xs font-bold">{group.students.length}명</span>
                </div>
                <div className="flex -space-x-2">
                    {group.students.slice(0, 3).map((s, i) => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 overflow-hidden">
                            {s.profile_image_url ? <img src={s.profile_image_url} className="w-full h-full object-cover" alt={s.name} /> : s.name?.charAt(0)}
                        </div>
                    ))}
                    {group.students.length > 3 && (
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-400">
                            +{group.students.length - 3}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default SchoolCard;
