/**
 * Task Manager
 * Mini-Task and Focus Goals linked to Pomodoro Sessions.
 */

const STORAGE_KEY = 'pomodoro_tasks';
const ACTIVE_TASK_KEY = 'pomodoro_active_task_id';

export class TaskManager {
  constructor() {
    this.tasks = [];
    this.activeTaskId = null;
    this.onChange = () => {};
    this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      this.tasks = data ? JSON.parse(data) : [];
      this.activeTaskId = localStorage.getItem(ACTIVE_TASK_KEY) || null;

      // Verify active task still exists and is not completed
      const active = this.tasks.find(t => t.id === this.activeTaskId);
      if (!active || active.completed) {
        this.activeTaskId = null;
        localStorage.removeItem(ACTIVE_TASK_KEY);
      }
    } catch (e) {
      console.error('Failed to load tasks from localStorage', e);
      this.tasks = [];
      this.activeTaskId = null;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
      if (this.activeTaskId) {
        localStorage.setItem(ACTIVE_TASK_KEY, this.activeTaskId);
      } else {
        localStorage.removeItem(ACTIVE_TASK_KEY);
      }
    } catch (e) {
      console.error('Failed to save tasks to localStorage', e);
    }
    this.onChange();
  }

  add(title, estimatedPomodoros = 2) {
    const trimmed = (title || '').trim();
    if (!trimmed) return null;

    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: trimmed,
      estimatedPomodoros: Math.max(1, parseInt(estimatedPomodoros, 10) || 1),
      completedPomodoros: 0,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.tasks.unshift(newTask);

    // If no active task currently, select this one automatically
    if (!this.activeTaskId) {
      this.activeTaskId = newTask.id;
    }

    this.save();
    return newTask;
  }

  toggle(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    if (task.completed && this.activeTaskId === id) {
      // Find next uncompleted task or clear
      const next = this.tasks.find(t => !t.completed && t.id !== id);
      this.activeTaskId = next ? next.id : null;
    }

    this.save();
  }

  delete(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    if (this.activeTaskId === id) {
      const next = this.tasks.find(t => !t.completed);
      this.activeTaskId = next ? next.id : null;
    }
    this.save();
  }

  setActive(id) {
    if (id === null || id === undefined) {
      this.activeTaskId = null;
    } else {
      const task = this.tasks.find(t => t.id === id);
      if (task && !task.completed) {
        this.activeTaskId = id;
      }
    }
    this.save();
  }

  getActive() {
    if (!this.activeTaskId) return null;
    return this.tasks.find(t => t.id === this.activeTaskId && !t.completed) || null;
  }

  incrementActivePomodoro() {
    const active = this.getActive();
    if (active) {
      active.completedPomodoros = (active.completedPomodoros || 0) + 1;
      this.save();
      return active;
    }
    return null;
  }

  clearCompleted() {
    this.tasks = this.tasks.filter(t => !t.completed);
    this.save();
  }

  getFiltered(filter = 'all') {
    if (filter === 'active') {
      return this.tasks.filter(t => !t.completed);
    }
    if (filter === 'completed') {
      return this.tasks.filter(t => t.completed);
    }
    return [...this.tasks];
  }

  getPendingCount() {
    return this.tasks.filter(t => !t.completed).length;
  }
}
