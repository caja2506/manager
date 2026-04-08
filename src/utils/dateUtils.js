export function isDateOverdue(dateStr) {
    if (!dateStr) return false;
    // Extract YYYY-MM-DD
    const datePart = typeof dateStr === 'string' ? dateStr.substring(0, 10) : new Date(dateStr).toISOString().substring(0, 10);
    // Parse as local midnight (T00:00:00 avoids UTC parsing on some browsers if we just use YYYY-MM-DD)
    const due = new Date(`${datePart}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
}

export function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const datePart = typeof dateStr === 'string' ? dateStr.substring(0, 10) : new Date(dateStr).toISOString().substring(0, 10);
    return new Date(`${datePart}T00:00:00`);
}

export function getDaysUntil(dateStr) {
    if (!dateStr) return null;
    const datePart = typeof dateStr === 'string' ? dateStr.substring(0, 10) : new Date(dateStr).toISOString().substring(0, 10);
    const due = new Date(`${datePart}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / (1000 * 60 * 60 * 24));
}
