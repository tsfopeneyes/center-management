import { engagementFixture } from '../engagement-fixture.mjs';

// Wholly synthetic.  This is deliberately separate from the legacy fixture so
// new contracts do not accidentally treat fixture-only fields as production DB
// columns.
export function createCenterAnalysisFixture() {
    const source = structuredClone(engagementFixture);
    source.as_of = '2026-02-01T00:00:00+09:00';
    source.datasets.satisfactionResponses = [
        { id: 'synthetic-rating-1', program_ref: 'P1', value: 4, submitted_at: '2026-01-02T09:00:00+09:00' },
        { id: 'synthetic-rating-2', program_ref: 'P1', value: 5, submitted_at: '2026-01-03T09:00:00+09:00' },
        { id: 'synthetic-rating-3', program_ref: 'P2', value: 3, submitted_at: '2026-01-16T09:00:00+09:00' },
    ];
    source.datasets.rentalBookings = [
        { id: 'synthetic-rental-1', booking_date: '2026-01-10', status: 'CONFIRMED' },
        { id: 'synthetic-rental-2', booking_date: '2025-12-31', status: 'CONFIRMED' },
    ];
    source.datasets.storeOrders = [
        { id: 'synthetic-store-1', created_at: '2026-01-12T10:00:00+09:00', status: 'APPROVED' },
        { id: 'synthetic-store-2', created_at: '2026-02-01T10:00:00+09:00', status: 'PENDING' },
    ];
    source.datasets.checkinSurveys = [
        { id: 'synthetic-survey-1', created_at: '2026-01-05T10:00:00+09:00', survey_type: 'CHECKIN' },
        { id: 'synthetic-survey-2', created_at: '2026-01-20T10:00:00+09:00', survey_type: 'CHECKOUT' },
    ];
    return source;
}

export const syntheticActor = Object.freeze({ active: true, capabilities: Object.freeze(['analytics.read', 'programs.read']) });
