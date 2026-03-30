const fs = require('fs');
const backupPath = 'd:/coding/ENTER/src/components/admin/calendar/AdminCalendar.backup.jsx';
const lines = fs.readFileSync(backupPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
const getLines = (start, end) => lines.slice(start - 1, end).join('\n');

// 1. Create Directories if not exist
const dirs = [
    'd:/coding/ENTER/src/components/admin/calendar/hooks',
    'd:/coding/ENTER/src/components/admin/calendar/modals'
];
dirs.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

// 2. Extract calendarConstants.js (Lines 18-28)
// This is needed because both the orchestrator and modals use COLOR_THEMES
const constantsContent = `export ` + getLines(19, 28);
fs.writeFileSync('d:/coding/ENTER/src/components/admin/calendar/calendarConstants.js', constantsContent);

// 3. Extract useAdminCalendar.jsx hook
const hookImports = getLines(1, 16) + `\nimport { COLOR_THEMES } from '../calendarConstants';`;
const hookBody = getLines(31, 503);
const hookFooter = `
    return {
        currentDate, setCurrentDate,
        adminSchedules, setAdminSchedules,
        dynamicCategories, setDynamicCategories,
        loading, setLoading,
        showModal, setShowModal,
        showCategoryModal, setShowCategoryModal,
        selectedEvent, setSelectedEvent,
        selectedDate, setSelectedDate,
        visibleCategories, setVisibleCategories,
        editCategory, setEditCategory,
        categoryForm, setCategoryForm,
        showDayDetail, setShowDayDetail,
        formData, setFormData,
        fetchAllData, fetchAdminSchedules,
        allEvents, isEventOnDay,
        monthStart, monthEnd, startDate, endDate, calendarDays,
        nextMonth, prevMonth, goToToday,
        handleDateClick, handleEventClick, toggleCategory,
        handleSaveEvent, handleDelete, handleSaveCategory, handleDeleteCategory
    };
};
`;
fs.writeFileSync('d:/coding/ENTER/src/components/admin/calendar/hooks/useAdminCalendar.jsx', 
    hookImports + '\nexport const useAdminCalendar = ({ notices, fetchData }) => {\n' + hookBody + hookFooter);

// 4. Extract EventEditModal.jsx (Lines 720-912 inner content of AnimatePresence wrapper)
const eventModalContent = `import React from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, Users, MapPin, Trash2, X } from 'lucide-react';
import { CATEGORIES } from '../../../../constants/appConstants';

const EventEditModal = ({ 
    formData, setFormData, 
    selectedEvent, setSelectedEvent, 
    dynamicCategories, 
    handleSaveEvent, handleDelete, 
    setShowModal 
}) => {
    return (
${getLines(720, 912)}
    );
};
export default EventEditModal;
`;
fs.writeFileSync('d:/coding/ENTER/src/components/admin/calendar/modals/EventEditModal.jsx', eventModalContent);

// 5. Extract CategorySettingsModal.jsx (Lines 917-965 inner content)
const categoryModalContent = `import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, X } from 'lucide-react';
import { COLOR_THEMES } from '../calendarConstants';

const CategorySettingsModal = ({
    showCategoryModal, setShowCategoryModal,
    dynamicCategories,
    categoryForm, setCategoryForm,
    editCategory, setEditCategory,
    handleSaveCategory, handleDeleteCategory
}) => {
    return (
${getLines(917, 965)}
    );
};
export default CategorySettingsModal;
`;
fs.writeFileSync('d:/coding/ENTER/src/components/admin/calendar/modals/CategorySettingsModal.jsx', categoryModalContent);

// 6. Extract MobileDayDetailOverlay.jsx (Lines 969-1109 inner content)
const mobileModalContent = `import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronDown, Filter, MoreVertical, Calendar as CalendarIcon, Edit2 } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { COLOR_THEMES } from '../calendarConstants';

const MobileDayDetailOverlay = ({
    selectedDate, setSelectedDate,
    showDayDetail, setShowDayDetail,
    allEvents, isEventOnDay,
    handleEventClick,
    formData, setFormData, 
    setSelectedEvent, setShowModal,
    dynamicCategories
}) => {
    return (
${getLines(969, 1109)}
    );
};
export default MobileDayDetailOverlay;
`;
fs.writeFileSync('d:/coding/ENTER/src/components/admin/calendar/modals/MobileDayDetailOverlay.jsx', mobileModalContent);

// 7. Reassemble AdminCalendar.jsx Orchestrator
const orchestratorContent = `import React from 'react';
import { format, isSameMonth, isSameDay, getDay, startOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Filter, Check, Settings, Palette } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAdminCalendar } from './hooks/useAdminCalendar';
import { COLOR_THEMES } from './calendarConstants';

import EventEditModal from './modals/EventEditModal';
import CategorySettingsModal from './modals/CategorySettingsModal';
import MobileDayDetailOverlay from './modals/MobileDayDetailOverlay';

const AdminCalendar = ({ notices, fetchData }) => {
    const hookData = useAdminCalendar({ notices, fetchData });
    const { 
        currentDate, dynamicCategories, 
        showModal, setShowModal,
        showCategoryModal, setShowCategoryModal,
        showDayDetail, setShowDayDetail,
        selectedDate, setSelectedDate,
        visibleCategories, 
        allEvents, isEventOnDay,
        monthStart, calendarDays,
        nextMonth, prevMonth, goToToday,
        handleDateClick, handleEventClick, toggleCategory,
        formData, setFormData, selectedEvent, setSelectedEvent,
        handleSaveEvent, handleDelete,
        categoryForm, setCategoryForm, editCategory, setEditCategory,
        handleSaveCategory, handleDeleteCategory
    } = hookData;

    return (
${getLines(506, 715)}

            {/* Injected Modals */}
            <AnimatePresence>
                {showModal && <EventEditModal {...hookData} />}
            </AnimatePresence>

            <AnimatePresence>
                {showCategoryModal && <CategorySettingsModal {...hookData} />}
            </AnimatePresence>

            <AnimatePresence>
                {showDayDetail && <MobileDayDetailOverlay {...hookData} />}
            </AnimatePresence>
        </div>
    );
};

export default AdminCalendar;
`;
fs.writeFileSync('d:/coding/ENTER/src/components/admin/calendar/AdminCalendar.jsx', orchestratorContent);

console.log('AdminCalendar successfully extracted and reassembled.');
