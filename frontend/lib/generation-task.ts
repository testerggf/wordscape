export interface ActiveGeneration {
  taskId: string;
  name: string;
  startedAt: number;
}

const ACTIVE_KEY = "wordscape:active-generation";
const TASK_COURSE_MAP_KEY = "wordscape:task-course-map";

export function loadActiveGeneration(): ActiveGeneration | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = localStorage.getItem(ACTIVE_KEY);
    return saved ? (JSON.parse(saved) as ActiveGeneration) : null;
  } catch {
    return null;
  }
}

export function saveActiveGeneration(active: ActiveGeneration) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  window.dispatchEvent(new CustomEvent("wordscape:generation-changed"));
}

export function clearActiveGeneration(taskId?: string) {
  if (taskId) {
    const current = loadActiveGeneration();
    if (current && current.taskId !== taskId) return;
  }
  localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new CustomEvent("wordscape:generation-changed"));
}

/** 任务 → 已保存课程的映射，避免进度页刷新后重复保存课程。 */
export function getSavedCourseId(taskId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(TASK_COURSE_MAP_KEY) ?? "{}") as Record<string, string>;
    return map[taskId] ?? null;
  } catch {
    return null;
  }
}

export function markCourseSaved(taskId: string, courseId: string) {
  let map: Record<string, string> = {};
  try {
    map = JSON.parse(localStorage.getItem(TASK_COURSE_MAP_KEY) ?? "{}") as Record<string, string>;
  } catch {
    map = {};
  }
  map[taskId] = courseId;
  localStorage.setItem(TASK_COURSE_MAP_KEY, JSON.stringify(map));
}
