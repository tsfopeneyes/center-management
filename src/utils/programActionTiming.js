import { isRecurringProgram } from './dailyProgramSessions.js';

// Ordinary programs switch participant actions at their scheduled start.
// Multi-day challenges and recurring programs keep their existing lifecycle.
export const usesProgramStartActions = program => program?.category === 'PROGRAM'
    && program.is_recruiting === true && !program.is_challenge && !isRecurringProgram(program);

export const programActionStartAt = program => {
    if (!program?.program_date) return null;
    const value = String(program.program_date);
    const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T${program.program_time || '00:00'}+09:00` : value);
    return Number.isFinite(time) ? time : null;
};

export const hasProgramStartActions = (program, now = Date.now()) => {
    if (!usesProgramStartActions(program)) return false;
    if (program.program_status === 'CANCELLED') return false;
    if (program.program_status === 'COMPLETED' || (program.guest_properties?.is_ended ?? program.is_ended) === true) return true;
    const start = programActionStartAt(program);
    return start != null && Number(now) >= start;
};
