/**
 * Peer Review Handler — functions/handlers/peerReviewHandler.js
 * ==============================================================
 * Business logic for peer review operations:
 * - requestPeerReview: creates a review and moves task to validation
 * - submitPeerReview: approves or requests changes
 * - waivePeerReview: privileged waiver with audit trail
 */

const paths = require("../automation/firestorePaths");
const { loadTask, updateTask: updateTaskSB, transitionTaskStatus } = require("../db/coreDataReader");

// ── Request Peer Review ──

async function requestPeerReview(adminDb, { taskId, reviewerId, requestedBy }) {
    if (!taskId) throw new Error("taskId is required");
    if (!reviewerId) throw new Error("reviewerId is required");
    if (!requestedBy) throw new Error("requestedBy is required");

    const task = await loadTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    // Reviewer cannot be the assignee
    if (reviewerId === task.assignedTo) {
        throw new Error("Reviewer cannot be the same as the task assignee");
    }

    // Determine discipline from taskType
    let discipline = task.peerReviewDiscipline || null;
    if (!discipline && task.taskTypeId) {
        const ttSnap = await adminDb.collection(paths.TASK_TYPES).doc(task.taskTypeId).get();
        if (ttSnap.exists) {
            discipline = ttSnap.data().peerReviewDiscipline || null;
        }
    }

    // Load checklist from the task type's embedded peerReviewSections
    let checklistItems = [];
    if (task.taskTypeId) {
        const ttSnap = await adminDb.collection(paths.TASK_TYPES).doc(task.taskTypeId).get();
        if (ttSnap.exists) {
            const ttData = ttSnap.data();
            const sections = ttData.peerReviewSections || [];
            checklistItems = sections.flatMap((section, si) =>
                (section.items || []).map((item, ii) => ({
                    id: item.id || `s${si}i${ii}`,
                    label: item.label,
                    required: item.required !== false,
                    section: section.name || 'General',
                    result: null,  // "yes" | "no" | "na" — filled by reviewer
                    comment: "",
                }))
            );
        }
    }

    const cycle = (task.peerReviewCycles || 0) + 1;
    const now = new Date().toISOString();

    // Create peer review document
    const reviewDoc = {
        taskId,
        projectId: task.projectId || null,
        cycle,
        requestedBy,
        reviewerId,
        discipline,
        status: "requested",
        checklistItems,
        decision: null,
        summary: "",
        waivedBy: null,
        waiveReason: null,
        requestedAt: now,
        startedAt: null,
        completedAt: null,
        createdAt: now,
    };

    const reviewRef = await adminDb.collection(paths.PEER_REVIEWS).add(reviewDoc);

    // Update task summary fields
    await updateTaskSB(taskId, {
        peerReviewRequired: true,
        peerReviewStatus: "requested",
        peerReviewDiscipline: discipline,
        peerReviewCycles: cycle,
        currentPeerReviewId: reviewRef.id,
        peerReviewReviewerId: reviewerId,
    });

    // Transition status to validation via RPC
    await transitionTaskStatus(taskId, "validation", requestedBy);

    // Audit event
    await adminDb.collection("auditEvents").add({
        eventType: "peer_review_requested",
        entityType: "task",
        entityId: taskId,
        userId: requestedBy,
        timestamp: now,
        source: "cloud_function",
        details: {
            reviewId: reviewRef.id,
            reviewerId,
            discipline,
            cycle,
            taskTitle: task.title || "",
        },
    });

    console.log(`[PeerReview] Requested: task=${taskId}, reviewer=${reviewerId}, cycle=${cycle}`);
    return { success: true, reviewId: reviewRef.id, cycle };
}

// ── Submit Peer Review ──

async function submitPeerReview(adminDb, { reviewId, decision, checklistItems, summary, userId }) {
    if (!reviewId) throw new Error("reviewId is required");
    if (!decision || !["approved", "changes_requested"].includes(decision)) {
        throw new Error("decision must be 'approved' or 'changes_requested'");
    }
    if (!userId) throw new Error("userId is required");

    const reviewRef = adminDb.collection(paths.PEER_REVIEWS).doc(reviewId);
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) throw new Error(`Review ${reviewId} not found`);
    const review = reviewSnap.data();

    // Only the assigned reviewer can submit
    if (review.reviewerId !== userId) {
        throw new Error("Only the assigned reviewer can submit this review");
    }

    const now = new Date().toISOString();

    // Update review document
    await reviewRef.update({
        status: decision,
        decision,
        checklistItems: checklistItems || review.checklistItems,
        summary: summary || "",
        completedAt: now,
        startedAt: review.startedAt || now,
    });

    // Update task
    const taskUpdates = {
        peerReviewStatus: decision,
        lastPeerReviewerId: userId,
        lastPeerReviewAt: now,
    };

    await updateTaskSB(review.taskId, taskUpdates);

    if (decision === "changes_requested") {
        await transitionTaskStatus(review.taskId, "in_progress", userId, "", false, "Cambios solicitados en revisión de pares");
    }

    // Audit event
    await adminDb.collection("auditEvents").add({
        eventType: `peer_review_${decision}`,
        entityType: "task",
        entityId: review.taskId,
        userId,
        timestamp: now,
        source: "cloud_function",
        details: {
            reviewId,
            decision,
            cycle: review.cycle,
            discipline: review.discipline,
            summary: summary || "",
        },
    });

    console.log(`[PeerReview] ${decision}: review=${reviewId}, task=${review.taskId}`);
    return { success: true, decision };
}

// ── Waive Peer Review ──

async function waivePeerReview(adminDb, { taskId, reason, userId, userRole }) {
    if (!taskId) throw new Error("taskId is required");
    if (!reason || !reason.trim()) throw new Error("Waive reason is required");

    // Only admin, manager, or team_lead can waive
    const privilegedRoles = ["admin", "manager", "team_lead"];
    if (!privilegedRoles.includes(userRole)) {
        throw new Error("Only admin, manager, or team_lead can waive peer review");
    }

    const task = await loadTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const now = new Date().toISOString();
    if (task.currentPeerReviewId) {
        const reviewRef = adminDb.collection(paths.PEER_REVIEWS).doc(task.currentPeerReviewId);
        await reviewRef.update({
            status: "waived",
            decision: "waived",
            waivedBy: userId,
            waiveReason: reason.trim(),
            completedAt: now,
        });
    }

    // Update task in Supabase
    await updateTaskSB(taskId, {
        peerReviewStatus: "waived",
    });

    // Audit event
    await adminDb.collection("auditEvents").add({
        eventType: "peer_review_waived",
        entityType: "task",
        entityId: taskId,
        userId,
        timestamp: now,
        source: "cloud_function",
        details: {
            reason: reason.trim(),
            userRole,
            taskTitle: task.title || "",
            currentReviewId: task.currentPeerReviewId || null,
        },
    });

    console.log(`[PeerReview] Waived: task=${taskId}, by=${userId}, reason="${reason.trim()}"`);
    return { success: true };
}

module.exports = { requestPeerReview, submitPeerReview, waivePeerReview };
