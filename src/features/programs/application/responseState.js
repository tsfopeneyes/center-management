// Retained cancellations remain application history, not current attendance.
export const isCurrentProgramAttendee = response =>
    response?.status === 'JOIN' && response?.is_attended === true;
