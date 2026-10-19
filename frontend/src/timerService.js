// Precision timestamp/deadline-based Focus Timer Service for PulseBox Cyber Desk
// Decoupled from rendering; operates 100% offline with zero backend API dependencies.
// Persists minimal state to localStorage with robust validation and stale-data safety.

import {
  playClickSound,
  playBeepSound,
  playSuccessChime,
  playLevelUpSound,
  isSoundEnabled,
  setSoundEnabled
} from "./audio.js";

export const STORAGE_KEY = "pulsebox_focus_timer_v1";

export const DEFAULT_FOCUS_PRESET = 25; // minutes
export const DEFAULT_BREAK_PRESET = 5;  // minutes
export const FOCUS_PRESETS = [15, 25, 45]; // minutes

export class FocusTimerService {
  constructor(storage = null) {
    this._storage = storage !== null ? storage : (typeof localStorage !== "undefined" ? localStorage : null);
    this._listeners = new Set();
    this._globalTicker = null;

    this.state = this._loadInitialState();
    this.sync();
  }

  _getStorage() {
    return this._storage;
  }

  _getDefaultState() {
    return {
      mode: "focus",                 // "focus" | "break"
      focusPresetMinutes: DEFAULT_FOCUS_PRESET,
      breakPresetMinutes: DEFAULT_BREAK_PRESET,
      durationMinutes: DEFAULT_FOCUS_PRESET,
      remainingSeconds: DEFAULT_FOCUS_PRESET * 60,
      targetDeadline: null,          // ms epoch timestamp or null
      isRunning: false,
      pausedAt: null,                // ms epoch timestamp or null
      sessionNumber: 1,
      completedSessions: 0,
      lastCompletedMode: null,       // "focus" | "break" | null
      completionNotice: null,        // human readable banner message
      pendingConfirm: null,          // { action: 'reset'|'skip'|'preset', payload?: any }
    };
  }

  _loadInitialState() {
    const defaults = this._getDefaultState();
    const storage = this._getStorage();
    if (!storage) return defaults;

    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") return defaults;

      // Validate mode
      const mode = (parsed.mode === "break" || parsed.mode === "focus") ? parsed.mode : defaults.mode;

      // Validate presets
      const focusPresetMinutes = Number.isInteger(parsed.focusPresetMinutes) && parsed.focusPresetMinutes > 0 && parsed.focusPresetMinutes <= 180
        ? parsed.focusPresetMinutes
        : defaults.focusPresetMinutes;

      const breakPresetMinutes = Number.isInteger(parsed.breakPresetMinutes) && parsed.breakPresetMinutes > 0 && parsed.breakPresetMinutes <= 60
        ? parsed.breakPresetMinutes
        : defaults.breakPresetMinutes;

      const durationMinutes = Number.isInteger(parsed.durationMinutes) && parsed.durationMinutes > 0 && parsed.durationMinutes <= 180
        ? parsed.durationMinutes
        : (mode === "focus" ? focusPresetMinutes : breakPresetMinutes);

      const sessionNumber = Number.isInteger(parsed.sessionNumber) && parsed.sessionNumber >= 1
        ? parsed.sessionNumber
        : 1;

      const completedSessions = Number.isInteger(parsed.completedSessions) && parsed.completedSessions >= 0
        ? parsed.completedSessions
        : 0;

      const isRunning = Boolean(parsed.isRunning);
      const targetDeadline = (Number.isFinite(parsed.targetDeadline) && parsed.targetDeadline > 0)
        ? parsed.targetDeadline
        : null;

      const pausedAt = (Number.isFinite(parsed.pausedAt) && parsed.pausedAt > 0)
        ? parsed.pausedAt
        : null;

      let remainingSeconds = Number.isInteger(parsed.remainingSeconds) && parsed.remainingSeconds >= 0
        ? parsed.remainingSeconds
        : durationMinutes * 60;

      // Compute recovery if was running across reload
      const now = Date.now();
      let lastCompletedMode = null;
      let completionNotice = null;

      if (isRunning && targetDeadline) {
        if (now >= targetDeadline) {
          // Timer finished while page was closed/refreshed
          const elapsedPastDeadline = now - targetDeadline;
          // If expired recently (under 24 hours), mark session as completed
          if (elapsedPastDeadline < 24 * 60 * 60 * 1000) {
            if (mode === "focus") {
              return {
                mode: "break",
                focusPresetMinutes,
                breakPresetMinutes,
                durationMinutes: breakPresetMinutes,
                remainingSeconds: breakPresetMinutes * 60,
                targetDeadline: null,
                isRunning: false,
                pausedAt: null,
                sessionNumber,
                completedSessions: completedSessions + 1,
                lastCompletedMode: "focus",
                completionNotice: "FOCUS SESSION COMPLETED WHILE AWAY! TAKE A BREAK.",
                pendingConfirm: null,
              };
            } else {
              return {
                mode: "focus",
                focusPresetMinutes,
                breakPresetMinutes,
                durationMinutes: focusPresetMinutes,
                remainingSeconds: focusPresetMinutes * 60,
                targetDeadline: null,
                isRunning: false,
                pausedAt: null,
                sessionNumber: sessionNumber + 1,
                completedSessions,
                lastCompletedMode: "break",
                completionNotice: "BREAK COMPLETED WHILE AWAY! READY TO FOCUS.",
                pendingConfirm: null,
              };
            }
          } else {
            // Stale beyond 24 hours - reset cleanly to idle
            remainingSeconds = durationMinutes * 60;
            return {
              ...defaults,
              focusPresetMinutes,
              breakPresetMinutes,
              durationMinutes,
              remainingSeconds,
              sessionNumber,
              completedSessions,
            };
          }
        } else {
          // Still active within current deadline!
          remainingSeconds = Math.max(0, Math.ceil((targetDeadline - now) / 1000));
        }
      }

      return {
        mode,
        focusPresetMinutes,
        breakPresetMinutes,
        durationMinutes,
        remainingSeconds,
        targetDeadline: isRunning ? targetDeadline : null,
        isRunning,
        pausedAt,
        sessionNumber,
        completedSessions,
        lastCompletedMode,
        completionNotice,
        pendingConfirm: null,
      };
    } catch {
      // Corrupted JSON or error reading localStorage
      return defaults;
    }
  }

  saveState() {
    const storage = this._getStorage();
    if (!storage) return;

    try {
      const dataToSave = {
        mode: this.state.mode,
        focusPresetMinutes: this.state.focusPresetMinutes,
        breakPresetMinutes: this.state.breakPresetMinutes,
        durationMinutes: this.state.durationMinutes,
        remainingSeconds: this.state.remainingSeconds,
        targetDeadline: this.state.targetDeadline,
        isRunning: this.state.isRunning,
        pausedAt: this.state.pausedAt,
        sessionNumber: this.state.sessionNumber,
        completedSessions: this.state.completedSessions,
        savedAt: Date.now(),
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch {
      // Storage quota exceeded or disabled
    }
  }

  getState(now = Date.now()) {
    this.sync(now);
    return {
      ...this.state,
      soundEnabled: isSoundEnabled(),
    };
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    const s = this.getState();
    this._listeners.forEach(fn => {
      try {
        fn(s);
      } catch (err) {
        console.error("Timer listener error:", err);
      }
    });
  }

  isSessionActive() {
    this.sync();
    if (this.state.isRunning) return true;
    const totalSecs = this.state.durationMinutes * 60;
    return this.state.remainingSeconds < totalSecs && this.state.remainingSeconds > 0;
  }

  sync(now = Date.now()) {
    if (!this.state.isRunning) return this.state.remainingSeconds;

    if (!this.state.targetDeadline) {
      this.state.isRunning = false;
      return this.state.remainingSeconds;
    }

    const diffMs = this.state.targetDeadline - now;
    const remaining = Math.ceil(diffMs / 1000);

    if (remaining <= 0) {
      this._handleCompletion(now);
      return 0;
    }

    this.state.remainingSeconds = remaining;
    return remaining;
  }

  start() {
    this.sync();
    if (this.state.isRunning) return;

    // If remainingSeconds is 0, reset to current preset duration
    if (this.state.remainingSeconds <= 0) {
      this.state.remainingSeconds = this.state.durationMinutes * 60;
    }

    const now = Date.now();
    this.state.isRunning = true;
    this.state.targetDeadline = now + (this.state.remainingSeconds * 1000);
    this.state.pausedAt = null;
    this.state.completionNotice = null;
    this.state.pendingConfirm = null;

    this.saveState();
    this._notify();
  }

  pause() {
    if (!this.state.isRunning) return;

    const now = Date.now();
    if (this.state.targetDeadline) {
      const remaining = Math.max(0, Math.ceil((this.state.targetDeadline - now) / 1000));
      this.state.remainingSeconds = remaining;
    }

    this.state.isRunning = false;
    this.state.targetDeadline = null;
    this.state.pausedAt = now;
    this.state.pendingConfirm = null;

    this.saveState();
    this._notify();
  }

  resume() {
    this.start();
  }

  requestReset(force = false) {
    if (!force && this.isSessionActive()) {
      this.state.pendingConfirm = { action: "reset" };
      this._notify();
      return { requiresConfirmation: true, action: "reset" };
    }

    this._executeReset();
    return { success: true };
  }

  _executeReset() {
    this.state.isRunning = false;
    this.state.targetDeadline = null;
    this.state.pausedAt = null;
    this.state.remainingSeconds = this.state.durationMinutes * 60;
    this.state.completionNotice = null;
    this.state.pendingConfirm = null;

    this.saveState();
    this._notify();
  }

  requestSkip(force = false) {
    if (!force && this.isSessionActive()) {
      this.state.pendingConfirm = { action: "skip" };
      this._notify();
      return { requiresConfirmation: true, action: "skip" };
    }

    this._executeSkip();
    return { success: true };
  }

  _executeSkip() {
    this.state.isRunning = false;
    this.state.targetDeadline = null;
    this.state.pausedAt = null;
    this.state.completionNotice = null;
    this.state.pendingConfirm = null;

    if (this.state.mode === "focus") {
      this.state.mode = "break";
      this.state.durationMinutes = this.state.breakPresetMinutes;
      this.state.remainingSeconds = this.state.breakPresetMinutes * 60;
    } else {
      this.state.mode = "focus";
      this.state.sessionNumber += 1;
      this.state.durationMinutes = this.state.focusPresetMinutes;
      this.state.remainingSeconds = this.state.focusPresetMinutes * 60;
    }

    this.saveState();
    this._notify();
  }

  requestPreset(minutes, force = false) {
    if (!FOCUS_PRESETS.includes(minutes)) return { error: "Invalid preset" };

    if (!force && this.isSessionActive()) {
      this.state.pendingConfirm = { action: "preset", payload: minutes };
      this._notify();
      return { requiresConfirmation: true, action: "preset", payload: minutes };
    }

    this._executePreset(minutes);
    return { success: true };
  }

  _executePreset(minutes) {
    this.state.focusPresetMinutes = minutes;
    this.state.pendingConfirm = null;

    if (this.state.mode === "focus") {
      this.state.isRunning = false;
      this.state.targetDeadline = null;
      this.state.pausedAt = null;
      this.state.durationMinutes = minutes;
      this.state.remainingSeconds = minutes * 60;
      this.state.completionNotice = null;
    }

    this.saveState();
    this._notify();
  }

  confirmPendingAction() {
    const pending = this.state.pendingConfirm;
    if (!pending) return;

    if (pending.action === "reset") {
      this._executeReset();
    } else if (pending.action === "skip") {
      this._executeSkip();
    } else if (pending.action === "preset") {
      this._executePreset(pending.payload);
    }
  }

  cancelPendingAction() {
    this.state.pendingConfirm = null;
    this._notify();
  }

  _handleCompletion(now = Date.now()) {
    this.state.isRunning = false;
    this.state.targetDeadline = null;
    this.state.pausedAt = null;
    this.state.remainingSeconds = 0;
    this.state.pendingConfirm = null;

    if (this.state.mode === "focus") {
      this.state.completedSessions += 1;
      this.state.lastCompletedMode = "focus";
      this.state.completionNotice = "FOCUS SESSION COMPLETE! TIME FOR A 5M BREAK.";
      this.state.mode = "break";
      this.state.durationMinutes = this.state.breakPresetMinutes;
      this.state.remainingSeconds = this.state.breakPresetMinutes * 60;

      // Play Level-Up Celebratory Synth Sound
      try {
        playLevelUpSound();
      } catch {}
    } else {
      this.state.sessionNumber += 1;
      this.state.lastCompletedMode = "break";
      this.state.completionNotice = "BREAK COMPLETE! READY FOR NEXT FOCUS SESSION.";
      this.state.mode = "focus";
      this.state.durationMinutes = this.state.focusPresetMinutes;
      this.state.remainingSeconds = this.state.focusPresetMinutes * 60;

      // Play Break Complete Alert/Beep
      try {
        playBeepSound(980, 0.16, "triangle");
      } catch {}
    }

    this.saveState();
    this._notify();
  }

  dismissNotice() {
    this.state.completionNotice = null;
    this._notify();
  }

  toggleSound(enabled = null) {
    const next = enabled !== null ? Boolean(enabled) : !isSoundEnabled();
    setSoundEnabled(next);
    this._notify();
    return next;
  }
}

// Global singleton instance for the app lifecycle
export const focusTimerService = new FocusTimerService();
