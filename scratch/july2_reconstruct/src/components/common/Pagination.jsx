import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    // Generate page numbers (e.g., 1, 2, 3, 4, 5) with a sliding window
    const getPageNumbers = () => {
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + 4);
        
        // Adjust start if we're near the end
        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }
        
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    };

    return (
        <div className="flex items-center justify-center gap-1.5 py-6">
            <button 
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
                <ChevronLeft size={18} />
            </button>
            
            {getPageNumbers().map(pageNum => (
                <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`min-w-[36px] h-[36px] flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                        currentPage === pageNum 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200 transform scale-105' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                >
                    {pageNum}
                </button>
            ))}

            <button 
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
                <ChevronRight size={18} />
            </button>
        </div>
    );
};

export default Pagination;
