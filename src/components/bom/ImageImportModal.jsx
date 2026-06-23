import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ImagePlus, Upload, Trash2, Loader2, Sparkles } from 'lucide-react';

// Límite de tamaño y tipos aceptados
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Modal para importar datos de cotización BOM desde imágenes.
 * Soporta pegado desde portapapeles, arrastrar y soltar, y carga de archivos.
 */
export default function ImageImportModal({ isOpen, onClose, onConfirm, isProcessing }) {
  // Estado del archivo de imagen seleccionado
  const [imageFile, setImageFile] = useState(null);
  // URL de vista previa generada con createObjectURL
  const [imagePreview, setImagePreview] = useState(null);
  // Mensaje de error de validación
  const [error, setError] = useState('');
  // Estado visual para arrastrar archivos sobre la zona
  const [isDragging, setIsDragging] = useState(false);

  // Referencia al input de archivo oculto
  const fileInputRef = useRef(null);
  // Referencia al contenedor del modal para eventos de pegado
  const modalRef = useRef(null);

  /**
   * Valida y establece el archivo de imagen seleccionado.
   * Verifica tipo MIME y tamaño máximo permitido.
   */
  const processFile = useCallback((file) => {
    setError('');

    if (!file) return;

    // Validar tipo de archivo
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.');
      return;
    }

    // Validar tamaño máximo
    if (file.size > MAX_SIZE_BYTES) {
      setError(`La imagen excede el límite de ${MAX_SIZE_MB}MB.`);
      return;
    }

    // Generar URL de vista previa y guardar el archivo
    const previewUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(previewUrl);
  }, []);

  /**
   * Maneja el evento de pegado (Ctrl+V) para capturar imágenes del portapapeles.
   */
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        // Crear un File a partir del blob con nombre descriptivo
        const file = new File(
          [blob],
          `captura-${Date.now()}.${blob.type.split('/')[1] || 'png'}`,
          { type: blob.type }
        );
        processFile(file);
        return;
      }
    }
  }, [processFile]);

  // Registrar y limpiar el listener de pegado cuando el modal está abierto
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, handlePaste]);

  // Limpiar la URL del objeto al desmontar o al cambiar la vista previa
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Reiniciar estado al abrir/cerrar el modal
  useEffect(() => {
    if (!isOpen) {
      setImageFile(null);
      setImagePreview(null);
      setError('');
      setIsDragging(false);
    }
  }, [isOpen]);

  /**
   * Limpia la imagen seleccionada y permite elegir otra.
   */
  const handleClear = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Maneja la selección de archivo desde el input oculto.
   */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  /**
   * Previene el comportamiento por defecto del drag y actualiza el estado visual.
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Maneja el soltar archivos en la zona de drop.
   */
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  /**
   * Confirma la importación enviando el archivo al callback del padre.
   */
  const handleConfirm = () => {
    if (imageFile && onConfirm) {
      onConfirm(imageFile);
    }
  };

  /**
   * Formatea el tamaño del archivo a una cadena legible (KB o MB).
   */
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // No renderizar nada si el modal está cerrado
  if (!isOpen) return null;

  return (
    // Overlay oscuro con desenfoque de fondo
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
    >
      {/* Contenedor principal del modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 transition-all duration-300 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del modal */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📷 Importar desde Imagen
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Pega una captura de pantalla (Ctrl+V), arrastra o sube una imagen de cotización.
            </p>
          </div>
          {/* Botón de cierre */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del modal */}
        <div className="px-6 pb-6 pt-2">
          {/* Zona de pegado / arrastrar / subir — solo visible si no hay imagen */}
          {!imageFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center gap-4 p-8
                border-2 border-dashed rounded-xl cursor-pointer
                transition-all duration-300 ease-in-out
                ${isDragging
                  ? 'border-amber-400 bg-amber-400/10 scale-[1.02]'
                  : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
                }
              `}
            >
              {/* Ícono central de la zona de carga */}
              <div className={`
                p-4 rounded-2xl transition-all duration-300
                ${isDragging
                  ? 'bg-amber-400/20 text-amber-400'
                  : 'bg-slate-700/50 text-slate-400'
                }
              `}>
                <ImagePlus size={40} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">
                  Arrastra una imagen aquí o{' '}
                  <span className="text-amber-400 underline underline-offset-2">
                    haz clic para subir
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-1.5">
                  También puedes pegar con <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono text-[10px]">V</kbd>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  JPG, PNG, WebP · máx. {MAX_SIZE_MB}MB
                </p>
              </div>

              {/* Input de archivo oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
                aria-label="Seleccionar imagen"
              />
            </div>
          ) : (
            /* Vista previa de la imagen seleccionada */
            <div className="space-y-3">
              {/* Contenedor de la imagen con proporción fija */}
              <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                <img
                  src={imagePreview}
                  alt="Vista previa de la imagen"
                  className="w-full max-h-64 object-contain bg-slate-950/50"
                />
                {/* Botón para eliminar la imagen — visible al hacer hover */}
                <button
                  onClick={handleClear}
                  disabled={isProcessing}
                  className="
                    absolute top-2 right-2 p-2 rounded-xl
                    bg-red-500/80 text-white opacity-0 group-hover:opacity-100
                    hover:bg-red-500 transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                  aria-label="Eliminar imagen"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Información del archivo */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2 min-w-0">
                  <Upload size={14} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-300 truncate">
                    {imageFile.name}
                  </span>
                </div>
                <span className="text-xs text-slate-500 shrink-0 ml-2">
                  {formatFileSize(imageFile.size)}
                </span>
              </div>
            </div>
          )}

          {/* Mensaje de error */}
          {error && (
            <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 mt-5">
            {/* Botón cancelar */}
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="
                px-4 py-2.5 rounded-xl text-sm font-medium
                text-slate-300 bg-slate-800 border border-slate-700
                hover:bg-slate-700 hover:text-white
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Cancelar
            </button>

            {/* Botón confirmar con gradiente ámbar/amarillo */}
            <button
              onClick={handleConfirm}
              disabled={!imageFile || isProcessing}
              className="
                relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                text-slate-900 bg-gradient-to-r from-amber-400 to-yellow-400
                hover:from-amber-300 hover:to-yellow-300
                shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                disabled:hover:from-amber-400 disabled:hover:to-yellow-400
              "
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Procesando…</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Analizar con IA</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
