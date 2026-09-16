import React from 'react';

const sizeClasses = {
    sm: 'h-4 w-4 text-[9px]',
    md: 'h-5 w-5 text-[11px]',
    lg: 'h-6 w-6 text-[12px]',
};

const HaifnPointIcon = ({ size = 'md', className = '' }) => (
    <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#CF3A27] font-black leading-none text-white ${sizeClasses[size] || sizeClasses.md} ${className}`}
    >
        <span className="translate-y-px">H</span>
    </span>
);

export default HaifnPointIcon;
