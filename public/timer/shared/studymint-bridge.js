/* public/timer/shared/studymint-bridge.js — StudyMint shell-earning bridge for the lock-in timer */
(function () {
  'use strict';

  const API_URL = '';

  function getToken() {
    return localStorage.getItem('token');
  }

  async function api(path, options = {}) {
    const url = `${API_URL}/api${path}`;
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      console.error('[StudyMint Bridge] API error:', err);
      throw err;
    }
  }

  let studySessionId = null;
  let studySecondsWorked = 0;
  let studyPendingAward = null;
  let bridgeRunning = false;
  let bridgeStartTime = 0;
  let bridgeInterval = null;

  function messageEl() {
    return document.getElementById('message');
  }

  function isPomodoroBreak() {
    return window.pomodoro && window.pomodoro.enabled && window.pomodoro.mode === 'break';
  }

  async function refundSession() {
    if (studySessionId) {
      const sessionId = studySessionId;
      studySessionId = null;
      try {
        return await api(`/study/session/${sessionId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('[StudyMint Bridge] refund failed', err);
      }
    }
    return null;
  }

  async function awardMinute() {
    const expectedSessionId = studySessionId;
    try {
      if (expectedSessionId) {
        const data = await api(`/study/session/${expectedSessionId}`, { method: 'PUT' });
        if (bridgeRunning && studySessionId === expectedSessionId) {
          const el = messageEl();
          if (el) el.textContent = `+${data.session.currency_earned} 🐚 earned this run (pause to lose it)`;
        }
        return data;
      } else {
        const data = await api('/study/session', {
          method: 'POST',
          body: JSON.stringify({ duration_minutes: 1 })
        });
        // Only adopt the new session id if the timer is still running.
        // If the timer completed or was paused while the request was in flight,
        // the server has already recorded the minute and the shell is kept.
        if (bridgeRunning && studySessionId === expectedSessionId) {
          studySessionId = data.session.id;
          const el = messageEl();
          if (el) el.textContent = `+${data.session.currency_earned} 🐚 earned this run (pause to lose it)`;
        }
        return data;
      }
    } catch (err) {
      console.error('[StudyMint Bridge] awardMinute failed', err);
      throw err;
    }
  }

  function addMinuteToSession() {
    studyPendingAward = awardMinute()
      .catch(() => {})
      .finally(() => {
        studyPendingAward = null;
      });
  }

  function bridgeTick() {
    if (!bridgeRunning) return;
    // Respect the actual timer state (handles Focus Lock pauses and completion gaps)
    if (typeof window.isRunning !== 'undefined' && !window.isRunning) return;

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - bridgeStartTime) / 1000);
    if (elapsedSeconds <= studySecondsWorked) return;

    studySecondsWorked = elapsedSeconds;
    if (studySecondsWorked > 0 && studySecondsWorked % 60 === 0) {
      addMinuteToSession();
    }
  }

  function startBridge() {
    if (isPomodoroBreak()) return;
    bridgeRunning = true;
    bridgeStartTime = Date.now() - studySecondsWorked * 1000;
    if (!bridgeInterval) {
      bridgeInterval = setInterval(bridgeTick, 250);
    }
  }

  async function pauseBridge() {
    bridgeRunning = false;
    bridgeTick(); // flush any elapsed seconds up to the pause moment

    const secondsWorked = studySecondsWorked;
    studySecondsWorked = 0;

    if (studyPendingAward) {
      try { await studyPendingAward; } catch {}
    }

    const refunded = await refundSession();
    const el = messageEl();
    if (el) {
      if (refunded && secondsWorked >= 60) {
        const minutes = Math.floor(secondsWorked / 60);
        el.textContent = `Paused. ${minutes} 🐚 taken back.`;
      } else if (!el.textContent || el.textContent.includes('earned')) {
        el.textContent = 'Paused.';
      }
    }
  }

  async function resetBridge() {
    bridgeRunning = false;
    studySecondsWorked = 0;
    if (studyPendingAward) {
      try { await studyPendingAward; } catch {}
    }
    await refundSession();
    const el = messageEl();
    if (el) el.textContent = '';
  }

  async function completeBridge() {
    bridgeRunning = false;
    const minutes = Math.floor(studySecondsWorked / 60);
    const wasPomodoroBreak = isPomodoroBreak();
    studySecondsWorked = 0;

    // Wait for any in-flight minute award to finish so the server records the
    // final minute before we clear the local session id.
    if (studyPendingAward) {
      try { await studyPendingAward; } catch {}
    }
    studySessionId = null;

    // In Pomodoro mode, the work phase just finished and a break is starting.
    // Keep the shells earned and let timer.js show its own break message.
    if (wasPomodoroBreak) return;

    const el = messageEl();
    if (el && minutes > 0) {
      el.textContent = `Session complete! +${minutes} 🐚 kept.`;
    }
  }

  function wrapLifecycle() {
    if (typeof startTimer === 'function') {
      const orig = startTimer;
      startTimer = function () {
        const ret = orig.apply(this, arguments);
        startBridge();
        return ret;
      };
    }

    if (typeof pauseTimer === 'function') {
      const orig = pauseTimer;
      pauseTimer = function () {
        pauseBridge();
        return orig.apply(this, arguments);
      };
    }

    if (typeof resetTimer === 'function') {
      const orig = resetTimer;
      resetTimer = function () {
        resetBridge();
        return orig.apply(this, arguments);
      };
    }

    if (typeof onTimerComplete === 'function') {
      const orig = onTimerComplete;
      onTimerComplete = function () {
        const ret = orig.apply(this, arguments);
        completeBridge();
        return ret;
      };
    }
  }

  // Best-effort refund if the user closes the tab while a session is active
  window.addEventListener('beforeunload', () => {
    if (studySessionId) {
      try {
        fetch(`/api/study/session/${studySessionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getToken() || ''}` },
          keepalive: true
        }).catch(() => {});
      } catch (err) {}
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapLifecycle);
  } else {
    wrapLifecycle();
  }
})();
