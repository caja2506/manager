import React, { useState, useEffect, useRef } from 'react';
import {
    MessageCircle, Send, Pencil, Trash2, X, Check, CornerDownRight
} from 'lucide-react';
import {
    subscribeToComments, addComment, updateComment, deleteComment
} from '../../services/commentService';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * TaskComments — real-time comment list with add/edit/delete.
 * Pattern mirrors SubtaskList: always-visible input, inline editing.
 */
export default function TaskComments({
    taskId, readOnly = false, userId = null, userName = null
}) {
    const [comments, setComments] = useState([]);
    const [newText, setNewText] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const inputRef = useRef(null);
    const editRef = useRef(null);
    const listEndRef = useRef(null);

    // Real-time subscription
    useEffect(() => {
        if (!taskId) return;
        const unsub = subscribeToComments(taskId, setComments);
        return unsub;
    }, [taskId]);

    // Scroll to bottom on new comment
    useEffect(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments.length]);

    // Focus edit input
    useEffect(() => {
        if (editingId && editRef.current) {
            editRef.current.focus();
            editRef.current.select();
        }
    }, [editingId]);

    // ── Add ──
    const handleAdd = async () => {
        if (!newText.trim() || isSending) return;
        setIsSending(true);
        try {
            await addComment(taskId, newText, userId, userName);
            setNewText('');
            inputRef.current?.focus();
        } catch (err) {
            console.error('[TaskComments] Error adding comment:', err);
        }
        setIsSending(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAdd();
        }
    };

    // ── Edit ──
    const startEditing = (comment) => {
        setEditingId(comment.id);
        setEditText(comment.text);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const trimmed = editText.trim();
        if (trimmed && trimmed !== comments.find(c => c.id === editingId)?.text) {
            await updateComment(taskId, editingId, trimmed);
        }
        setEditingId(null);
        setEditText('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditText('');
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    };

    // ── Delete ──
    const handleDelete = async (commentId) => {
        try {
            await deleteComment(taskId, commentId);
        } catch (err) {
            console.error('[TaskComments] Error deleting comment:', err);
        }
    };

    // ── Helpers ──
    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    };

    const getAvatarColor = (uid) => {
        if (!uid) return 'bg-slate-600';
        const colors = [
            'bg-indigo-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
            'bg-rose-600', 'bg-cyan-600', 'bg-fuchsia-600', 'bg-teal-600',
        ];
        const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3" />
                    Comentarios {comments.length > 0 && `(${comments.length})`}
                </h4>
            </div>

            {/* Comment list */}
            {comments.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                    {comments.map((comment) => {
                        const isOwn = comment.userId === userId;
                        const isEditing = editingId === comment.id;
                        const timeAgo = comment.createdAt
                            ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })
                            : '';

                        return (
                            <div
                                key={comment.id}
                                className="group flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-slate-700/30 transition-colors"
                            >
                                {/* Avatar */}
                                <div className={`w-7 h-7 rounded-full ${getAvatarColor(comment.userId)} flex items-center justify-center shrink-0 mt-0.5`}>
                                    <span className="text-[9px] font-black text-white">{getInitials(comment.userName)}</span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-300">
                                            {comment.userName || 'Desconocido'}
                                        </span>
                                        <span className="text-[9px] text-slate-600">
                                            {timeAgo}
                                        </span>
                                        {comment.edited && (
                                            <span className="text-[8px] text-slate-600 italic">(editado)</span>
                                        )}
                                    </div>

                                    {isEditing ? (
                                        <div className="mt-1 flex items-start gap-1">
                                            <textarea
                                                ref={editRef}
                                                value={editText}
                                                onChange={e => setEditText(e.target.value)}
                                                onKeyDown={handleEditKeyDown}
                                                className="flex-1 px-2 py-1.5 border border-indigo-500 rounded-lg text-xs bg-slate-800 text-slate-200 outline-none resize-none"
                                                rows={2}
                                            />
                                            <button onClick={saveEdit} className="p-1 text-emerald-400 hover:text-emerald-300">
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={cancelEdit} className="p-1 text-slate-500 hover:text-slate-300">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                                            {comment.text}
                                        </p>
                                    )}
                                </div>

                                {/* Actions — only for own comments */}
                                {isOwn && !readOnly && !isEditing && (
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={() => startEditing(comment)}
                                            className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={listEndRef} />
                </div>
            )}

            {/* Empty state */}
            {comments.length === 0 && (
                <div className="text-center py-3">
                    <CornerDownRight className="w-4 h-4 text-slate-700 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-600">Sin comentarios aún</p>
                </div>
            )}

            {/* Always-visible input */}
            {!readOnly && (
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe un comentario... (Enter para enviar)"
                            className="w-full px-3 py-2 border border-slate-700 border-dashed rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-800/50 text-slate-200 placeholder-slate-500 resize-none"
                            rows={1}
                        />
                    </div>
                    {newText.trim() && (
                        <button
                            onClick={handleAdd}
                            disabled={isSending}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:scale-90 transition-all shrink-0 disabled:opacity-50"
                            title="Enviar comentario"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
