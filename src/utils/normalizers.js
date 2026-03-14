/**
 * Normaliza un Part Number: quita espacios y convierte a mayúsculas
 * @param {string} pn - Part Number sin normalizar
 * @returns {string} Part Number normalizado
 */
export function normalizePartNumber(pn) {
    return String(pn || 'S/N').replace(/\s+/g, '').toUpperCase();
}

/**
 * Extrae la "raíz" de un nombre de proveedor para comparación.
 * Quita sufijos legales comunes (S.A., S.A. de C.V., Inc., etc.)
 * y toma la primera palabra significativa (antes de punto o espacio).
 * Usa mínimo las primeras 5 letras.
 * 
 * Ejemplos:
 *   "Elvatron S.A."     → "elvatron"
 *   "Elvatron"          → "elvatron"
 *   "Digi-Key Corp."    → "digi-key"
 *   "Mouser Electronics"→ "mouser"
 * 
 * @param {string} name - Nombre del proveedor
 * @returns {string} Raíz normalizada en lowercase
 */
export function extractProviderRoot(name) {
    if (!name || typeof name !== 'string') return '';

    // 1. Quitar sufijos legales comunes
    let clean = name.trim().replace(
        /\s*(,?\s*S\.?\s*A\.?\s*(de\s*C\.?\s*V\.?)?|,?\s*S\.?\s*de\s*R\.?\s*L\.?|,?\s*Inc\.?|,?\s*LLC\.?|,?\s*Corp\.?|,?\s*Ltd\.?|,?\s*Co\.?).*$/i,
        ''
    ).trim();

    // 2. Tomar hasta el primer punto o espacio (si queda algo útil ≥ 5 chars)
    const beforeSeparator = clean.split(/[.\s]/)[0];

    // 3. Usar la parte antes del separador si es ≥ 5 chars, sino usar más del nombre
    const root = beforeSeparator.length >= 5 ? beforeSeparator : clean.substring(0, Math.max(5, clean.length));

    return root.toLowerCase();
}

/**
 * Busca proveedores existentes que sean similares al nombre extraído.
 * Compara las raíces de los nombres.
 * 
 * @param {string} extractedName - Nombre del proveedor extraído del PDF
 * @param {Array} existingProviders - Lista de proveedores existentes [{id, name}]
 * @returns {{ exactMatch: object|null, similarMatches: Array }}
 */
export function findSimilarProviders(extractedName, existingProviders) {
    if (!extractedName || !existingProviders) {
        return { exactMatch: null, similarMatches: [] };
    }

    // Buscar match exacto primero (case insensitive)
    const exactMatch = existingProviders.find(
        p => p.name.toLowerCase().trim() === extractedName.toLowerCase().trim()
    );

    if (exactMatch) {
        return { exactMatch, similarMatches: [] };
    }

    // Buscar similares por raíz del nombre
    const extractedRoot = extractProviderRoot(extractedName);

    if (!extractedRoot) {
        return { exactMatch: null, similarMatches: [] };
    }

    const similarMatches = existingProviders.filter(provider => {
        const providerRoot = extractProviderRoot(provider.name);
        return providerRoot && providerRoot === extractedRoot;
    });

    return { exactMatch: null, similarMatches };
}
