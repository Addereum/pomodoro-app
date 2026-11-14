/**
 * Statistics and Productivity Tracker
 * Calculates streaks, daily focus time, 7-day trend chart, and session history.
 */

const STATS_STORAGE_KEY = 'pomodoro_stats_log';

export class StatsTracker {
  constructor() {
    this.logs = [];
    this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(STATS_STORAGE_KEY);
      this.logs = data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load stats', e);
      this.logs = [];
    }
  }

  save() {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save stats', e);
    }
  }

  recordSession({ phase, durationMinutes, taskTitle = null, note = null }) {
    if (phase !== 'focus') return; // Only count productive focus blocks

    const now = new Date();
    const dateStr = this.formatDateKey(now);

    const entry = {
      id: 'session_' + Date.now(),
      timestamp: now.toISOString(),
      date: dateStr,
      phase,
      durationMinutes: durationMinutes || 25,
      taskTitle: taskTitle || null,
      note: note || null
    };

    this.logs.unshift(entry);
    this.save();
    return entry;
  }

  updateNote(sessionId, note) {
    const entry = this.logs.find(l => l.id === sessionId);
    if (entry) {
      entry.note = (note || '').trim() || null;
      this.save();
    }
  }

  hasLogs() {
    return Array.isArray(this.logs) && this.logs.length > 0;
  }

  exportCSV() {
    if (!this.hasLogs()) {
      return false;
    }

    const headers = ['Datum', 'Uhrzeit', 'Dauer (Minuten)', 'Phase', 'Aufgabe', 'Notiz'];
    const rows = this.logs.map(l => {
      const d = new Date(l.timestamp);
      const date = l.date || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const task = (l.taskTitle || '').replace(/"/g, '""');
      const note = (l.note || '').replace(/"/g, '""');
      return [
        `"${date}"`,
        `"${time}"`,
        l.durationMinutes || 25,
        `"${l.phase || 'focus'}"`,
        `"${task}"`,
        `"${note}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pomodoro-sessions-${this.formatDateKey(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportJSON() {
    if (!this.hasLogs()) {
      return false;
    }

    const jsonStr = JSON.stringify(this.logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pomodoro-sessions-${this.formatDateKey(new Date())}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getTodayStats() {
    const todayKey = this.formatDateKey(new Date());
    const todayLogs = this.logs.filter(l => l.date === todayKey && l.phase === 'focus');

    const count = todayLogs.length;
    const minutes = todayLogs.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

    return { count, minutes };
  }

  getAllTimeStats() {
    const focusLogs = this.logs.filter(l => l.phase === 'focus');
    const count = focusLogs.length;
    const minutes = focusLogs.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
    return { count, minutes };
  }

  getStreakDays() {
    // Collect set of unique dates with completed focus sessions
    const dateSet = new Set(this.logs.filter(l => l.phase === 'focus').map(l => l.date));
    if (dateSet.size === 0) return 0;

    let streak = 0;
    const cursor = new Date();
    const todayKey = this.formatDateKey(cursor);

    // If today has sessions, start counting from today.
    // If not, start counting from yesterday (streak not broken yet today).
    if (dateSet.has(todayKey)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      cursor.setDate(cursor.getDate() - 1);
      const yesterdayKey = this.formatDateKey(cursor);
      if (!dateSet.has(yesterdayKey)) {
        return 0;
      }
    }

    while (true) {
      const key = this.formatDateKey(cursor);
      if (dateSet.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  getLast7Days() {
    const days = [];
    const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = this.formatDateKey(d);
      const dayLogs = this.logs.filter(l => l.date === key && l.phase === 'focus');
      const count = dayLogs.length;
      const minutes = dayLogs.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

      days.push({
        date: key,
        label: i === 0 ? 'Heute' : weekdays[d.getDay()],
        count,
        minutes
      });
    }

    return days;
  }

  getRecentSessions(limit = 10) {
    return this.logs.slice(0, limit);
  }

  clearStats() {
    this.logs = [];
    this.save();
  }

  renderChart(container) {
    if (!container) return;
    const days = this.getLast7Days();
    const maxCount = Math.max(4, ...days.map(d => d.count));

    container.innerHTML = days.map(d => {
      const heightPercent = d.count > 0 ? Math.max(8, Math.round((d.count / maxCount) * 100)) : 0;
      return `
        <div class="bar-column">
          <span class="bar-val">${d.count > 0 ? d.count : ''}</span>
          <div class="bar-fill-track" title="${d.label} (${d.date}): ${d.count} Pomodoro(s), ${d.minutes} Min.">
            <div class="bar-fill" style="height: ${heightPercent}%;"></div>
          </div>
          <span class="bar-label">${d.label}</span>
        </div>
      `;
    }).join('');
  }
}
