/**
 * milestoneService — Direct Supabase export
 */
export {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getMilestonesByProject,
  getAllMilestones,
  createProjectMilestones,
  computeFullScore,
  applyTrafficLightOverride,
  captureScoreSnapshot,
  getScoreSnapshots,
} from './milestoneService.supabase.js';
