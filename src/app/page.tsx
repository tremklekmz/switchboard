"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  Pause,
  Plus,
  Trash2,
  Settings,
  Clock,
  BarChart3,
  X,
  Timer,
} from "lucide-react";
import { useLocalStorage, useHydrated } from "@/lib/useLocalStorage";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  name: string;
  elapsed: number; // milliseconds
  isDevOps: boolean;
}

interface AccentOption {
  name: string;
  h: number;
  s: string;
  l: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT_OPTIONS: AccentOption[] = [
  { name: "Emerald", h: 160, s: "84%", l: "39%" },
  { name: "Blue", h: 217, s: "91%", l: "60%" },
  { name: "Purple", h: 271, s: "81%", l: "56%" },
  { name: "Orange", h: 25, s: "95%", l: "53%" },
  { name: "Rose", h: 347, s: "77%", l: "50%" },
  { name: "Cyan", h: 187, s: "85%", l: "43%" },
];

const QUICK_TASKS = ["Meeting", "Admin", "Email"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Switchboard() {
  // Persisted state
  const [tasks, setTasks] = useLocalStorage<Task[]>("switchboard-tasks", []);
  const [accentIndex, setAccentIndex] = useLocalStorage<number>(
    "switchboard-accent",
    0
  );
  const [activeTaskId, setActiveTaskId] = useLocalStorage<string | null>(
    "switchboard-active",
    null
  );

  // Local UI state
  const [newTaskName, setNewTaskName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const mounted = useHydrated();

  // Ref for tracking when the active task started
  const activeStartRef = useRef<number | null>(null);

  // ─── Apply accent CSS variables ──────────────────────────────────────────

  useEffect(() => {
    const accent = ACCENT_OPTIONS[accentIndex] ?? ACCENT_OPTIONS[0];
    const root = document.documentElement;
    root.style.setProperty("--accent-h", String(accent.h));
    root.style.setProperty("--accent-s", accent.s);
    root.style.setProperty("--accent-l", accent.l);
  }, [accentIndex]);

  // ─── Timer interval ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeTaskId) {
      activeStartRef.current = null;
      return;
    }

    activeStartRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - (activeStartRef.current ?? now);
      activeStartRef.current = now;

      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTaskId ? { ...t, elapsed: t.elapsed + delta } : t
        )
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTaskId, setTasks]);

  // ─── Task actions ────────────────────────────────────────────────────────

  const startTask = useCallback(
    (taskId: string) => {
      // Exclusive timer: starting one pauses any other
      setActiveTaskId(taskId);
    },
    [setActiveTaskId]
  );

  const pauseTask = useCallback(() => {
    setActiveTaskId(null);
  }, [setActiveTaskId]);

  const toggleTask = useCallback(
    (taskId: string) => {
      if (activeTaskId === taskId) {
        pauseTask();
      } else {
        startTask(taskId);
      }
    },
    [activeTaskId, startTask, pauseTask]
  );

  const addTask = useCallback(
    (name: string, isDevOps = false) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      // Don't add duplicates
      const exists = tasks.some(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) return;

      const task: Task = {
        id: generateId(),
        name: trimmed,
        elapsed: 0,
        isDevOps,
      };
      setTasks((prev) => [...prev, task]);
    },
    [tasks, setTasks]
  );

  const removeTask = useCallback(
    (taskId: string) => {
      if (activeTaskId === taskId) {
        setActiveTaskId(null);
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    [activeTaskId, setActiveTaskId, setTasks]
  );

  const handleAddCustomTask = useCallback(() => {
    if (newTaskName.trim()) {
      // Detect if it looks like a DevOps work item (numeric or #-prefixed)
      const isDevOps = /^#?\d+$/.test(newTaskName.trim());
      addTask(
        isDevOps ? `WI #${newTaskName.trim().replace(/^#/, "")}` : newTaskName,
        isDevOps
      );
      setNewTaskName("");
    }
  }, [newTaskName, addTask]);

  // ─── Derived data ───────────────────────────────────────────────────────

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;
  const totalTime = tasks.reduce((sum, t) => sum + t.elapsed, 0);

  // ─── Accent color helpers ───────────────────────────────────────────────

  const accent = ACCENT_OPTIONS[accentIndex] ?? ACCENT_OPTIONS[0];
  const accentColor = `hsl(${accent.h}, ${accent.s}, ${accent.l})`;
  const accentBg = `hsl(${accent.h}, ${accent.s}, 15%)`;
  const accentBorder = `hsl(${accent.h}, ${accent.s}, 25%)`;
  const accentGlow = `hsl(${accent.h}, ${accent.s}, 50%, 0.15)`;

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!mounted) {
    return (
      <main className="h-screen bg-slate-950 flex items-center justify-center">
        <Timer className="w-8 h-8 text-slate-600 animate-spin" />
      </main>
    );
  }

  return (
    <main className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5" style={{ color: accentColor }} />
          <h1 className="text-lg font-bold text-white tracking-tight">
            Switchboard
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSummary(true)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-none"
            aria-label="Daily summary"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-none"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ─── Active Task Banner ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-3">
        <div
          className="rounded-2xl p-4 border transition-all duration-300"
          style={{
            backgroundColor: activeTask ? accentBg : "rgb(15 23 42)",
            borderColor: activeTask ? accentBorder : "rgb(30 41 59)",
            boxShadow: activeTask ? `0 0 24px ${accentGlow}` : "none",
          }}
        >
          {activeTask ? (
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Active
                </p>
                <p className="text-white font-semibold text-lg truncate">
                  {activeTask.name}
                </p>
                <p
                  className="font-timer text-2xl font-bold mt-1"
                  style={{ color: accentColor }}
                >
                  {formatTime(activeTask.elapsed)}
                </p>
              </div>
              <button
                onClick={pauseTask}
                className="ml-4 w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-all touch-none active:scale-95"
                style={{ backgroundColor: accentColor }}
                aria-label="Pause active task"
              >
                <Pause className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <Clock className="w-5 h-5 text-slate-500" />
              <p className="text-slate-500 text-sm">
                No active task — tap a task below to start tracking
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Scrollable Content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* Quick-Switch Buttons */}
        <section>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
            Quick Switch
          </p>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_TASKS.map((name) => {
              const existing = tasks.find(
                (t) => t.name.toLowerCase() === name.toLowerCase()
              );
              const isActive = existing?.id === activeTaskId && !!activeTaskId;

              return (
                <button
                  key={name}
                  onClick={() => {
                    if (existing) {
                      toggleTask(existing.id);
                    } else {
                      addTask(name);
                    }
                  }}
                  className="h-12 rounded-xl font-medium text-sm transition-all touch-none active:scale-95 border"
                  style={{
                    backgroundColor: isActive ? accentBg : "rgb(15 23 42)",
                    borderColor: isActive ? accentBorder : "rgb(30 41 59)",
                    color: isActive ? accentColor : "rgb(203 213 225)",
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Add Task Input */}
        <section>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
            Add Task / DevOps Work Item
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomTask()}
              placeholder="Task name or #12345"
              className="flex-1 h-12 px-4 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-slate-600 transition-colors"
            />
            <button
              onClick={handleAddCustomTask}
              disabled={!newTaskName.trim()}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white transition-all touch-none active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: newTaskName.trim()
                  ? accentColor
                  : "rgb(30 41 59)",
              }}
              aria-label="Add task"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* Task List */}
        {tasks.length > 0 && (
          <section>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Tasks ({tasks.length})
            </p>
            <div className="space-y-2">
              {tasks.map((task) => {
                const isActive = task.id === activeTaskId;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                    style={{
                      backgroundColor: isActive
                        ? accentBg
                        : "rgb(15 23 42)",
                      borderColor: isActive
                        ? accentBorder
                        : "rgb(30 41 59)",
                    }}
                  >
                    {/* Play/Pause Toggle */}
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all touch-none active:scale-95"
                      style={{
                        backgroundColor: isActive
                          ? accentColor
                          : "rgb(30 41 59)",
                        color: isActive ? "white" : "rgb(148 163 184)",
                      }}
                      aria-label={isActive ? "Pause task" : "Start task"}
                    >
                      {isActive ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </button>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-sm truncate"
                        style={{
                          color: isActive ? "white" : "rgb(203 213 225)",
                        }}
                      >
                        {task.name}
                      </p>
                      <p
                        className="font-timer text-xs mt-0.5"
                        style={{
                          color: isActive ? accentColor : "rgb(100 116 139)",
                        }}
                      >
                        {formatTime(task.elapsed)}
                      </p>
                    </div>

                    {/* DevOps badge */}
                    {task.isDevOps && (
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: accentBg,
                          color: accentColor,
                        }}
                      >
                        DevOps
                      </span>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => removeTask(task.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors touch-none flex-shrink-0"
                      aria-label="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Total Time */}
        {tasks.length > 0 && (
          <div className="text-center py-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Total Today
            </p>
            <p
              className="font-timer text-xl font-bold mt-1"
              style={{ color: accentColor }}
            >
              {formatTime(totalTime)}
            </p>
          </div>
        )}
      </div>

      {/* ─── Settings Modal ──────────────────────────────────────────────── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-slate-900 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-none"
                aria-label="Close settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
              Accent Color
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ACCENT_OPTIONS.map((opt, i) => {
                const isSelected = i === accentIndex;
                const color = `hsl(${opt.h}, ${opt.s}, ${opt.l})`;
                return (
                  <button
                    key={opt.name}
                    onClick={() => setAccentIndex(i)}
                    className="h-12 rounded-xl font-medium text-sm transition-all touch-none active:scale-95 border flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: isSelected
                        ? `hsl(${opt.h}, ${opt.s}, 15%)`
                        : "rgb(15 23 42)",
                      borderColor: isSelected
                        ? `hsl(${opt.h}, ${opt.s}, 30%)`
                        : "rgb(30 41 59)",
                      color: isSelected ? color : "rgb(148 163 184)",
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {opt.name}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Clear all tasks and reset timers? This cannot be undone."
                    )
                  ) {
                    setTasks([]);
                    setActiveTaskId(null);
                    setShowSettings(false);
                  }
                }}
                className="w-full h-12 rounded-xl bg-red-500/10 text-red-400 font-medium text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors touch-none active:scale-[0.98]"
              >
                Clear All Tasks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Daily Summary Modal ─────────────────────────────────────────── */}
      {showSummary && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setShowSummary(false)}
        >
          <div
            className="bg-slate-900 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-8 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Daily Summary</h2>
              <button
                onClick={() => setShowSummary(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-none"
                aria-label="Close summary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                No tasks tracked yet today.
              </p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3">
                {tasks
                  .filter((t) => t.elapsed > 0)
                  .sort((a, b) => b.elapsed - a.elapsed)
                  .map((task) => {
                    const pct =
                      totalTime > 0
                        ? Math.round((task.elapsed / totalTime) * 100)
                        : 0;
                    return (
                      <div key={task.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 truncate flex-1">
                            {task.name}
                          </span>
                          <span
                            className="font-timer text-sm font-medium ml-3"
                            style={{ color: accentColor }}
                          >
                            {formatTime(task.elapsed)}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: accentColor,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {pct}% of total
                        </p>
                      </div>
                    );
                  })}

                <div className="pt-3 mt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      Total
                    </span>
                    <span
                      className="font-timer text-lg font-bold"
                      style={{ color: accentColor }}
                    >
                      {formatTime(totalTime)}
                    </span>
                  </div>
                </div>

                {/* Copy-paste friendly text */}
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Copy for Billing
                  </p>
                  <div className="bg-slate-950 rounded-xl p-3 font-timer text-xs text-slate-300 space-y-1 select-all">
                    {tasks
                      .filter((t) => t.elapsed > 0)
                      .map((t) => (
                        <div key={t.id}>
                          {t.name}: {formatTime(t.elapsed)}
                        </div>
                      ))}
                    <div className="border-t border-slate-800 pt-1 mt-1 text-white font-bold">
                      Total: {formatTime(totalTime)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
