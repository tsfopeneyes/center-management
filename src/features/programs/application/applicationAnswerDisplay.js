// New applications carry their question definition on the response. Older
// responses may only have answer keys, so current legacy labels are a best-
// effort display and must not be described as a historical form version.
export function applicationAnswerEntries(response, legacyFields = []) {
    const answers = response?.application_answers || {};
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return [];
    const snapshotQuestions = response?.application_form_snapshot?.questions;
    const hasSnapshot = Array.isArray(snapshotQuestions);
    const fields = hasSnapshot ? snapshotQuestions : legacyFields;
    const byId = new Map(fields.map(field => [String(field.id), field]));
    return Object.entries(answers)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([id, value]) => ({
            id,
            label: byId.get(id)?.label || `질문 ${id}`,
            answer: String(value),
            revision: hasSnapshot ? response.application_form_revision : null,
            definitionKnown: hasSnapshot,
        }));
}
