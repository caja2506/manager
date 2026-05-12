/**
 * Storage Service — src/services/storageService.js
 * ===================================================
 * Firebase Storage operations for task file attachments.
 * Supports upload, delete, and listing of files.
 */

import {
    ref, uploadBytesResumable, getDownloadURL,
    deleteObject, listAll,
} from 'firebase/storage';
import { storage } from '../firebase';

// ── Config ──

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_EXTENSIONS = [
    '.pdf', '.stl', '.step', '.stp', '.iges', '.igs',
    '.sldprt', '.sldasm', '.slddrw',
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.dwg', '.dxf',
];

const FILE_TYPE_MAP = {
    '.pdf': { type: 'pdf', icon: '📄', label: 'PDF', viewable: true },
    '.stl': { type: 'stl', icon: '🔧', label: 'STL 3D', viewable: true },
    '.step': { type: 'cad', icon: '⚙️', label: 'STEP', viewable: false },
    '.stp': { type: 'cad', icon: '⚙️', label: 'STEP', viewable: false },
    '.iges': { type: 'cad', icon: '⚙️', label: 'IGES', viewable: false },
    '.igs': { type: 'cad', icon: '⚙️', label: 'IGES', viewable: false },
    '.sldprt': { type: 'solidworks', icon: '⚙️', label: 'SolidWorks Part', viewable: false },
    '.sldasm': { type: 'solidworks', icon: '⚙️', label: 'SolidWorks Assy', viewable: false },
    '.slddrw': { type: 'solidworks', icon: '⚙️', label: 'SolidWorks Dwg', viewable: false },
    '.png': { type: 'image', icon: '🖼️', label: 'Imagen', viewable: true },
    '.jpg': { type: 'image', icon: '🖼️', label: 'Imagen', viewable: true },
    '.jpeg': { type: 'image', icon: '🖼️', label: 'Imagen', viewable: true },
    '.gif': { type: 'image', icon: '🖼️', label: 'Imagen', viewable: true },
    '.webp': { type: 'image', icon: '🖼️', label: 'Imagen', viewable: true },
    '.dwg': { type: 'cad', icon: '📐', label: 'AutoCAD', viewable: false },
    '.dxf': { type: 'cad', icon: '📐', label: 'DXF', viewable: false },
};

// ── Helpers ──

function getFileExtension(filename) {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.substring(dot).toLowerCase() : '';
}

export function getFileTypeInfo(filename) {
    const ext = getFileExtension(filename);
    return FILE_TYPE_MAP[ext] || { type: 'other', icon: '📁', label: 'Archivo', viewable: false };
}

export function validateFile(file) {
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 50 MB.` };
    }
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: `Tipo de archivo no soportado: ${ext}. Tipos permitidos: ${ALLOWED_EXTENSIONS.join(', ')}` };
    }
    return { valid: true };
}

export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Upload ──

/**
 * Upload a file to Firebase Storage for a task.
 * @param {string} taskId
 * @param {File} file
 * @param {function} onProgress — callback(percent: number)
 * @returns {Promise<{name, url, size, type, uploadedAt}>}
 */
export async function uploadTaskFile(taskId, file, onProgress = () => {}) {
    const validation = validateFile(file);
    if (!validation.valid) throw new Error(validation.error);

    // Sanitize filename: replace spaces, add timestamp to avoid collisions
    const timestamp = Date.now();
    const safeName = file.name.replace(/\s+/g, '_');
    const storagePath = `tasks/${taskId}/attachments/${timestamp}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, file, {
        customMetadata: {
            originalName: file.name,
            taskId,
            uploadedAt: new Date().toISOString(),
        },
    });

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                onProgress(percent);
            },
            (error) => reject(error),
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                const typeInfo = getFileTypeInfo(file.name);
                resolve({
                    name: file.name,
                    storagePath,
                    url,
                    size: file.size,
                    type: typeInfo.type,
                    viewable: typeInfo.viewable,
                    uploadedAt: new Date().toISOString(),
                });
            }
        );
    });
}

// ── Delete ──

export async function deleteTaskFile(storagePath) {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
}

// ── List ──

export async function listTaskFiles(taskId) {
    const folderRef = ref(storage, `tasks/${taskId}/attachments`);
    try {
        const result = await listAll(folderRef);
        const files = await Promise.all(
            result.items.map(async (itemRef) => {
                const url = await getDownloadURL(itemRef);
                const name = itemRef.name.replace(/^\d+_/, ''); // Remove timestamp prefix
                const typeInfo = getFileTypeInfo(name);
                return {
                    name,
                    storagePath: itemRef.fullPath,
                    url,
                    type: typeInfo.type,
                    viewable: typeInfo.viewable,
                    icon: typeInfo.icon,
                    label: typeInfo.label,
                };
            })
        );
        return files;
    } catch (err) {
        // Folder may not exist yet
        if (err.code === 'storage/object-not-found') return [];
        throw err;
    }
}
