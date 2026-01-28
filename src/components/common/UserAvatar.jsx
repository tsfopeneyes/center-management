import React from 'react';
import { User } from 'lucide-react';

const UserAvatar = ({ user, size = "w-8 h-8", textSize = "text-xs" }) => {
    if (user?.profile_image_url) {
        return <img src={user.profile_image_url} alt="Profile" className={`${size} rounded-full object-cover border border-gray-100 shadow-sm`} />;
    }
    return (
        <div className={`${size} rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 shadow-sm`}>
            <User size={size.includes('w-12') ? 24 : 14} className="text-gray-300" />
        </div>
    );
};

export default UserAvatar;
