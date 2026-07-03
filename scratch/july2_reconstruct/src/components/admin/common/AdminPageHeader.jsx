import React from 'react';

const AdminPageHeader = ({ title, subtitle, icon, actions }) => {
    return (
        <div className="p-4 md:p-8 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center justify-between bg-gradient-to-r from-white to-blue-50/10">
            <div className="flex items-center justify-between w-full md:w-auto">
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="text-blue-600 shrink-0">
                            {React.cloneElement(icon, { 
                                className: 'w-6 h-6 md:w-8 md:h-8 text-blue-600 shrink-0' 
                            })}
                        </div>
                    )}
                    <div>
                        <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            
            {actions && (
                <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto justify-end">
                    {actions}
                </div>
            )}
        </div>
    );
};

export default AdminPageHeader;
