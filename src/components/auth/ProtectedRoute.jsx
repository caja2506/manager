/**
 * ProtectedRoute — RBAC Route Guard
 * ====================================
 * Restricts route access based on the user's RBAC role.
 * If the user doesn't have the required role, redirects to "/".
 * 
 * Usage:
 *   <Route element={<ProtectedRoute requiredRole="admin" />}>
 *     <Route path="/settings" element={<SettingsPage />} />
 *   </Route>
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useRole } from '../../contexts/RoleContext';

/**
 * @param {Object} props
 * @param {'admin'|'editor'} props.requiredRole - Minimum role required
 */
export default function ProtectedRoute({ requiredRole = 'admin' }) {
    const { role, roleLoading } = useRole();

    // While role is loading, show nothing (parent already shows loading screen)
    if (roleLoading) return null;

    const hasAccess = (() => {
        if (!role) return false;
        if (requiredRole === 'admin') return role === 'admin';
        if (requiredRole === 'editor') return role === 'admin' || role === 'editor';
        return true; // viewer or unspecified
    })();

    if (!hasAccess) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
