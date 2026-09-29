// Compatibility boundary for the existing guest application questions stored
// in notices.guest_properties.custom_fields. Keep historical field IDs intact.
export const readLegacyGuestFields = (guestProperties) => (
    Array.isArray(guestProperties?.custom_fields) ? guestProperties.custom_fields : []
);

export const listVisibleLegacyGuestFields = (guestProperties) => (
    readLegacyGuestFields(guestProperties)
        .filter(field => field?.id && String(field?.label || '').trim())
);

export const serializeLegacyGuestFields = (fields) => (
    (Array.isArray(fields) ? fields : [])
        .filter(field => String(field?.label || '').trim())
        .map(field => ({
            id: field.id,
            label: String(field.label).trim(),
            type: ['text', 'textarea', 'select'].includes(field.type) ? field.type : 'text',
            required: field.required === true,
            options: field.type === 'select' ? (field.options || []).filter(Boolean) : [],
        }))
);

export const findMissingRequiredField = (fields, answers) => (
    fields.find(field => field.required === true && !String(answers?.[field.id] || '').trim())
);
