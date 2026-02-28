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
  oklch: string; // e.g., "oklch(60% 0.15 160)"
}

interface AccentState {
  presetIndex: number;
  customColor: string | null; // oklch string for custom color
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT_OPTIONS: AccentOption[] = [
  { name: "Emerald", oklch: "oklch(60% 0.15 160)" },
  { name: "Blue", oklch: "oklch(60% 0.15 250)" },
  { name: "Purple", oklch: "oklch(60% 0.18 300)" },
  { name: "Orange", oklch: "oklch(65% 0.18 50)" },
  { name: "Rose", oklch: "oklch(60% 0.18 15)" },
  { name: "Cyan", oklch: "oklch(65% 0.12 200)" },
];

const DEFAULT_CUSTOM_COLOR = "oklch(60% 0.15 160)";

const DEFAULT_QUICK_TASKS = ["Meeting", "Admin", "Email"];

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

/**
 * Convert hex color to oklch string
 * Uses a simple approximation via CSS getComputedStyle
 */
function hexToOklch(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  // Approximate oklch conversion (simplified)
  // For better accuracy, we use CSS color-mix in the actual rendering
  // but this gives us a usable oklch approximation
  const lr = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const lg = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const lb = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  const l = 0.412165612 * lr + 0.536275208 * lg + 0.0514575653 * lb;
  const m = 0.211859107 * lr + 0.6807189584 * lg + 0.107406579 * lb;
  const s = 0.0883097947 * lr + 0.2818474174 * lg + 0.6302613616 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + b_ * b_);
  let h = (Math.atan2(b_, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return `oklch(${Math.round(L * 100)}% ${Math.round(C * 1000) / 1000} ${Math.round(h)})`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Switchboard() {
  // Persisted state
  const [tasks, setTasks] = useLocalStorage<Task[]>("switchboard-tasks", []);
  const [accentState, setAccentState] = useLocalStorage<AccentState>(
    "switchboard-accent",
    { presetIndex: 0, customColor: null }
  );
  const [activeTaskId, setActiveTaskId] = useLocalStorage<string | null>(
    "switchboard-active",
    null
  );
  const [oledMode, setOledMode] = useLocalStorage<boolean>(
    "switchboard-oled",
    false
  );
  const [quickTasks, setQuickTasks] = useLocalStorage<string[]>(
    "switchboard-quick-tasks",
    DEFAULT_QUICK_TASKS
  );

  // Local UI state
  const [newTaskName, setNewTaskName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [customColorHex, setCustomColorHex] = useState("#00a884");
  const [editingQuickTasks, setEditingQuickTasks] = useState(false);
  const [quickTaskInputs, setQuickTaskInputs] = useState<string[]>(quickTasks);
  const mounted = useHydrated();

  // Ref for tracking when the active task started
  const activeStartRef = useRef<number | null>(null);

  // ─── Apply accent CSS variables + OLED body color ─────────────────────────

  useEffect(() => {
    const root = document.documentElement;
    let accentColor: string;

    if (accentState.customColor) {
      // Use custom color
      accentColor = accentState.customColor;
    } else {
      // Use preset
      const accent = ACCENT_OPTIONS[accentState.presetIndex] ?? ACCENT_OPTIONS[0];
      accentColor = accent.oklch;
    }

    root.style.setProperty("--accent-base", accentColor);

    // Update body background for OLED mode
    document.body.style.backgroundColor = oledMode ? "#000000" : "#020617";
    // Update theme-color meta tag
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", oledMode ? "#000000" : "#020617");
  }, [accentState, oledMode]);

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
  // Use CSS variables for colors now - these are for reference
  const accentColor = "var(--accent)";
  const accentBg = "var(--accent-bg)";
  const accentBorder = "oklch(from var(--accent-base) calc(l - 0.05) c h / 0.5)";
  const accentGlow = "var(--accent-glow)";

  // ─── OLED-aware surface colors ──────────────────────────────────────────

  const bgMain = oledMode ? "#000000" : "rgb(2 6 23)"; // slate-950
  const bgCard = oledMode ? "#000000" : "rgb(15 23 42)"; // slate-900
  const bgElevated = oledMode ? "#0a0a0a" : "rgb(15 23 42)"; // slightly lifted
  const bgInput = oledMode ? "#0a0a0a" : "rgb(15 23 42 / 1)";
  const borderDefault = oledMode ? "rgb(20 20 20)" : "rgb(30 41 59)";
  const borderSubtle = oledMode ? "rgb(30 30 30)" : "rgb(30 41 59)";
  const bgButton = oledMode ? "rgb(20 20 20)" : "rgb(30 41 59)";
  const bgModal = oledMode ? "#000000" : "rgb(15 23 42)";
  const borderModal = oledMode ? "rgb(30 30 30)" : "rgb(30 41 59)";
  const bgCopyBlock = oledMode ? "#0a0a0a" : "rgb(2 6 23)";

  // ─── Custom color handlers ──────────────────────────────────────────────

  const handleSaveCustomColor = useCallback(() => {
    const oklch = hexToOklch(customColorHex);
    setAccentState({ presetIndex: -1, customColor: oklch });
    setShowCustomColorPicker(false);
  }, [customColorHex, setAccentState]);

  const handleSelectPreset = useCallback((index: number) => {
    setAccentState({ presetIndex: index, customColor: null });
  }, [setAccentState]);

  const isUsingCustomColor = accentState.customColor !== null;

  // ─── Quick Tasks handlers ─────────────────────────────────────────────────

  const handleStartEditingQuickTasks = useCallback(() => {
    setQuickTaskInputs(quickTasks);
    setEditingQuickTasks(true);
  }, [quickTasks]);

  const handleSaveQuickTasks = useCallback(() => {
    const validTasks = quickTaskInputs
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 6); // Max 6 quick tasks
    setQuickTasks(validTasks.length > 0 ? validTasks : DEFAULT_QUICK_TASKS);
    setEditingQuickTasks(false);
  }, [quickTaskInputs, setQuickTasks]);

  const handleCancelEditingQuickTasks = useCallback(() => {
    setEditingQuickTasks(false);
    setQuickTaskInputs(quickTasks);
  }, [quickTasks]);

  const handleQuickTaskInputChange = useCallback((index: number, value: string) => {
    setQuickTaskInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleAddQuickTaskInput = useCallback(() => {
    if (quickTaskInputs.length < 6) {
      setQuickTaskInputs((prev) => [...prev, ""]);
    }
  }, [quickTaskInputs.length]);

  const handleRemoveQuickTaskInput = useCallback((index: number) => {
    setQuickTaskInputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!mounted) {
    return (
      <main className="h-screen bg-slate-950 flex items-center justify-center">
        <Timer className="w-8 h-8 text-slate-600 animate-spin" />
      </main>
    );
  }

  return (
    <main
      className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: bgMain }}
    >
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
            backgroundColor: activeTask ? accentBg : bgCard,
            borderColor: activeTask ? accentBorder : borderDefault,
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
          <div className="flex gap-2">
            {quickTasks.map((name) => {
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
                  className="flex-1 h-12 rounded-xl font-medium text-sm transition-all touch-none active:scale-95 border"
                  style={{
                    backgroundColor: isActive ? accentBg : bgCard,
                    borderColor: isActive ? accentBorder : borderDefault,
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
              className="flex-1 h-12 px-4 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: bgInput,
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: borderDefault,
              }}
            />
            <button
              onClick={handleAddCustomTask}
              disabled={!newTaskName.trim()}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white transition-all touch-none active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: newTaskName.trim()
                  ? accentColor
                  : bgButton,
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
                      backgroundColor: isActive ? accentBg : bgCard,
                      borderColor: isActive ? accentBorder : borderDefault,
                    }}
                  >
                    {/* Play/Pause Toggle */}
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all touch-none active:scale-95"
                      style={{
                        backgroundColor: isActive
                          ? accentColor
                          : bgButton,
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
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-8"
            style={{ backgroundColor: bgModal }}
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
                const isSelected = !isUsingCustomColor && i === accentState.presetIndex;
                return (
                  <button
                    key={opt.name}
                    onClick={() => handleSelectPreset(i)}
                    className="h-12 rounded-xl font-medium text-sm transition-all touch-none active:scale-95 border flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: isSelected
                        ? "oklch(from var(--accent-base) 0.15 c h / 0.25)"
                        : bgCard,
                      borderColor: isSelected
                        ? "oklch(from var(--accent-base) calc(l - 0.1) c h / 0.5)"
                        : borderDefault,
                      color: isSelected ? accentColor : "rgb(148 163 184)",
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: opt.oklch }}
                    />
                    {opt.name}
                  </button>
                );
              })}
            </div>

            {/* Custom Color Option */}
            <div className="mt-3">
              {showCustomColorPicker ? (
                <div className="p-3 rounded-xl border space-y-3"
                  style={{ backgroundColor: bgCard, borderColor: borderDefault }}
                >
                  <p className="text-sm text-slate-300">Pick a custom color</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={customColorHex}
                      onChange={(e) => setCustomColorHex(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Hex Color</p>
                      <input
                        type="text"
                        value={customColorHex}
                        onChange={(e) => setCustomColorHex(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-slate-500"
                        placeholder="#00a884"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveCustomColor}
                      className="flex-1 h-10 rounded-lg font-medium text-sm text-white transition-all touch-none active:scale-95"
                      style={{ backgroundColor: accentColor }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowCustomColorPicker(false)}
                      className="h-10 px-4 rounded-lg font-medium text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all touch-none active:scale-95"
                      style={{ backgroundColor: bgButton }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomColorPicker(true)}
                  className="w-full h-12 rounded-xl font-medium text-sm transition-all touch-none active:scale-95 border flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: isUsingCustomColor
                      ? "oklch(from var(--accent-base) 0.15 c h / 0.25)"
                      : bgCard,
                    borderColor: isUsingCustomColor
                      ? "oklch(from var(--accent-base) calc(l - 0.1) c h / 0.5)"
                      : borderDefault,
                    color: isUsingCustomColor ? accentColor : "rgb(148 163 184)",
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: isUsingCustomColor
                        ? accentColor
                        : "linear-gradient(135deg, #ff0000, #00ff00, #0000ff)",
                      background: isUsingCustomColor
                        ? accentColor
                        : "linear-gradient(135deg, #ff6b6b, #4ecdc4, #45b7d1)",
                    }}
                  />
                  {isUsingCustomColor ? "Custom" : "Custom Color"}
                </button>
              )}
            </div>

            {/* OLED Mode Toggle */}
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                Display
              </p>
              <button
                onClick={() => setOledMode((prev) => !prev)}
                className="w-full h-12 rounded-xl font-medium text-sm transition-all touch-none active:scale-95 border flex items-center justify-between px-4"
                style={{
                  backgroundColor: oledMode ? bgCard : bgCard,
                  borderColor: oledMode ? accentBorder : borderDefault,
                }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: oledMode ? accentColor : "rgb(100 116 139)",
                    }}
                  />
                  <span
                    style={{
                      color: oledMode ? "white" : "rgb(148 163 184)",
                    }}
                  >
                    OLED Black Mode
                  </span>
                </span>
                <span
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: oledMode ? accentColor : "rgb(51 65 85)",
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                    style={{
                      transform: oledMode
                        ? "translateX(1.375rem)"
                        : "translateX(0.25rem)",
                    }}
                  />
                </span>
              </button>
            </div>

            {/* Quick Tasks Editor */}
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                Quick Access Tasks
              </p>
              {editingQuickTasks ? (
                <div
                  className="p-3 rounded-xl border space-y-3"
                  style={{ backgroundColor: bgCard, borderColor: borderDefault }}
                >
                  <p className="text-sm text-slate-300">Edit quick tasks (max 6)</p>
                  <div className="space-y-2">
                    {quickTaskInputs.map((task, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={task}
                          onChange={(e) =>
                            handleQuickTaskInputChange(index, e.target.value)
                          }
                          placeholder={`Task ${index + 1}`}
                          className="flex-1 px-3 py-2 rounded-lg text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-slate-500"
                        />
                        <button
                          onClick={() => handleRemoveQuickTaskInput(index)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          aria-label="Remove task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {quickTaskInputs.length < 6 && (
                    <button
                      onClick={handleAddQuickTaskInput}
                      className="w-full h-10 rounded-lg font-medium text-sm border border-dashed flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
                      style={{ borderColor: borderDefault }}
                    >
                      <Plus className="w-4 h-4" />
                      Add Task
                    </button>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveQuickTasks}
                      className="flex-1 h-10 rounded-lg font-medium text-sm text-white transition-all touch-none active:scale-95"
                      style={{ backgroundColor: accentColor }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEditingQuickTasks}
                      className="h-10 px-4 rounded-lg font-medium text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all touch-none active:scale-95"
                      style={{ backgroundColor: bgButton }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleStartEditingQuickTasks}
                  className="w-full rounded-xl border p-3 transition-all touch-none active:scale-95"
                  style={{
                    backgroundColor: bgCard,
                    borderColor: borderDefault,
                  }}
                >
                  <div className="flex flex-wrap gap-2 mb-2">
                    {quickTasks.map((task) => (
                      <span
                        key={task}
                        className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{
                          backgroundColor: accentBg,
                          color: accentColor,
                        }}
                      >
                        {task}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 text-left">
                    Tap to edit quick access tasks
                  </p>
                </button>
              )}
            </div>

            <div className="mt-6 pt-4" style={{ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: borderSubtle }}>
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
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-8 max-h-[80vh] flex flex-col"
            style={{ backgroundColor: bgModal }}
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
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ backgroundColor: bgButton }}
                        >
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

                <div
                  className="pt-3 mt-3"
                  style={{ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: borderSubtle }}
                >
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
                  <div
                    className="rounded-xl p-3 font-timer text-xs text-slate-300 space-y-1 select-all"
                    style={{ backgroundColor: bgCopyBlock }}
                  >
                    {tasks
                      .filter((t) => t.elapsed > 0)
                      .map((t) => (
                        <div key={t.id}>
                          {t.name}: {formatTime(t.elapsed)}
                        </div>
                      ))}
                    <div
                      className="pt-1 mt-1 text-white font-bold"
                      style={{ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: borderSubtle }}
                    >
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
