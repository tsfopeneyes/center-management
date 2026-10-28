import { AnalysisError, kstDay, validDay } from './contracts.mjs';
import { dataset, immutableRows, inPeriod } from './normalize.mjs';

const optionalRows = (snapshot, key, fields, identity) => {
    const rows = dataset(snapshot, key, { required: false });
    return rows === null ? null : immutableRows(rows, fields, identity);
};

const scopedByDate = (rows, field, period) => rows.filter(row => {
    const day = validDay(row[field]) ? row[field] : typeof row[field] === 'string' && Number.isFinite(Date.parse(row[field])) ? kstDay(row[field]) : null;
    if (!day) throw new AnalysisError('source_incomplete');
    return inPeriod(day, period);
});

// These domains deliberately expose only aggregate counts.  They do not join a
// booking/order/survey back to a person because those links are not yet a
// verified analytic identity contract.
export function summarizeOperations(snapshot, period) {
    const rentals = optionalRows(snapshot, 'rentalBookings', ['id', 'booking_date', 'status'], ['id']);
    const store = optionalRows(snapshot, 'storeOrders', ['id', 'created_at', 'status'], ['id']);
    const surveys = optionalRows(snapshot, 'checkinSurveys', ['id', 'created_at', 'survey_type'], ['id']);
    return Object.freeze({
        rentals: rentals === null ? null : Object.freeze({ rental_bookings: scopedByDate(rentals, 'booking_date', period).length }),
        store: store === null ? null : Object.freeze({ store_orders: scopedByDate(store, 'created_at', period).length }),
        surveys: surveys === null ? null : Object.freeze({ survey_submissions: scopedByDate(surveys, 'created_at', period).length }),
    });
}
