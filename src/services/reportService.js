/**
 * Report Service
 * ==============
 * Utility functions to generate daily and weekly reports from raw engineering data.
 */

import { format, startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { TASK_STATUS } from '../models/schemas';

/**
 * Generate a daily report for a specific user on a specific date.
 * 
 * @param {string} date - Date to generate the report for (ISO string or JS Date)
 * @param {string} userId - ID of the user
 * @param {Array} timeLogs - All time logs
 * @param {Array} tasks - All tasks
 * @param {Array} projects - All projects
 * @param {Array} delays - All delays
 * @returns {Object} Report data
 */
export function generateDailyReport(date, userId, timeLogs, tasks, projects, delays) {
    const targetDate = new Date(date);
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    // Filter time logs for this user on this day
    const userLogsToday = timeLogs.filter(log => {
        if (log.userId !== userId) return false;
        if (!log.startTime) return false;
        const logStart = new Date(log.startTime);
        return isWithinInterval(logStart, { start, end });
    });

    let totalHours = 0;
    let overtimeHours = 0;
    const tasksWorkedMap = new Map();
    const notesArr = [];

    userLogsToday.forEach(log => {
        totalHours += (log.totalHours || 0);
        if (log.overtime) {
            overtimeHours += (log.overtimeHours || log.totalHours || 0);
        }

        if (log.notes) {
            notesArr.push(log.notes);
        }

        if (log.taskId) {
            if (!tasksWorkedMap.has(log.taskId)) {
                const task = tasks.find(t => t.id === log.taskId);
                const project = projects.find(p => p.id === log.projectId) || (task && projects.find(p => p.id === task.projectId));

                tasksWorkedMap.set(log.taskId, {
                    taskId: log.taskId,
                    taskTitle: task ? task.title : 'Tarea eliminada/desconocida',
                    projectName: project ? project.name : 'Proyecto general',
                    hours: 0,
                    logCount: 0
                });
            }
            const tData = tasksWorkedMap.get(log.taskId);
            tData.hours += (log.totalHours || 0);
            tData.logCount += 1;
        }
    });

    // Check tasks completed by this user today
    const tasksCompletedToday = tasks.filter(task => {
        if (task.status !== TASK_STATUS.COMPLETED) return false;
        if (task.assignedTo !== userId) return false;
        if (!task.completedDate) return false;
        const completedDate = new Date(task.completedDate);
        return isWithinInterval(completedDate, { start, end });
    }).length;

    // Check delays reported by this user today
    const delaysReportedToday = delays.filter(delay => {
        if (delay.createdBy !== userId) return false;
        if (!delay.createdAt) return false;
        const createdDate = new Date(delay.createdAt);
        return isWithinInterval(createdDate, { start, end });
    }).length;

    const tasksWorked = Array.from(tasksWorkedMap.values());

    return {
        date: format(targetDate, 'yyyy-MM-dd'),
        userId,
        totalHours: parseFloat(totalHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        tasksCompleted: tasksCompletedToday,
        delaysReported: delaysReportedToday,
        tasksWorked,
        notesSummary: notesArr.join(' | ') || 'Sin notas.'
    };
}

/**
 * Generate a weekly summary spanning multiple days for a user.
 */
export function generateWeeklyReport(baseDate, userId, timeLogs, tasks, projects, delays) {
    const targetDate = new Date(baseDate);
    const start = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday start
    const end = endOfWeek(targetDate, { weekStartsOn: 1 });

    const dailyReports = [];
    let currentDate = new Date(start);

    let weekTotalHours = 0;
    let weekOvertimeHours = 0;
    let weekTasksCompleted = 0;
    let weekDelaysReported = 0;

    while (currentDate <= end) {
        const daily = generateDailyReport(currentDate, userId, timeLogs, tasks, projects, delays);
        dailyReports.push(daily);

        weekTotalHours += daily.totalHours;
        weekOvertimeHours += daily.overtimeHours;
        weekTasksCompleted += daily.tasksCompleted;
        weekDelaysReported += daily.delaysReported;

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        userId,
        totalHours: parseFloat(weekTotalHours.toFixed(2)),
        overtimeHours: parseFloat(weekOvertimeHours.toFixed(2)),
        tasksCompleted: weekTasksCompleted,
        delaysReported: weekDelaysReported,
        dailyReports,
    };
}
