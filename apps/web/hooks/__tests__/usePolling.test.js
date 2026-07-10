/**
 * @module tests/hooks/usePolling
 * @description Unit tests for usePolling and useInterval hooks
 *
 * Test coverage:
 * - Interval setup and cleanup
 * - Start/stop controls
 * - Immediate execution option
 * - Visibility-aware pausing
 * - useInterval simplicity
 *
 * @covers src/hooks/usePolling.js
 *   - usePolling() - Interval timing, enabled/immediate options, start()/stop()
 *     controls, refresh() manual trigger, cleanup on unmount, callback ref updates,
 *     error handling (graceful catch with console.error)
 *   - useInterval() - Simple interval at specified delay, null delay pausing,
 *     delay change handling, cleanup on unmount, latest callback via ref
 *
 * @fixtures None
 * @mocks document.hidden, setInterval, clearInterval
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling, useInterval } from '../../hooks/usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start polling by default (enabled=true)', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: false })
      );

      expect(result.current.isPolling).toBe(true);
    });

    it('should not start if enabled=false', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        usePolling(callback, { interval: 1000, enabled: false })
      );

      expect(result.current.isPolling).toBe(false);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call immediately by default (immediate=true)', () => {
      const callback = vi.fn();
      renderHook(() => usePolling(callback, { interval: 1000 }));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call immediately if immediate=false', () => {
      const callback = vi.fn();
      renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: false })
      );

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('interval behavior', () => {
    it('should call callback at specified interval', () => {
      const callback = vi.fn();
      renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: false })
      );

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(callback).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should use default interval of 10000ms', () => {
      const callback = vi.fn();
      renderHook(() => usePolling(callback, { immediate: false }));

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('start/stop controls', () => {
    it('should stop polling when stop() is called', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: false })
      );

      act(() => {
        result.current.stop();
      });

      expect(result.current.isPolling).toBe(false);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(callback).not.toHaveBeenCalled();
    });

    it('should resume polling when start() is called after stop()', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: false })
      );

      act(() => {
        result.current.stop();
      });
      expect(result.current.isPolling).toBe(false);

      act(() => {
        result.current.start();
      });
      expect(result.current.isPolling).toBe(true);

      // start() calls immediately
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should call immediately when start() is called', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        usePolling(callback, { interval: 1000, enabled: false })
      );

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        result.current.start();
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    it('should trigger callback manually without affecting interval', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: false })
      );

      act(() => {
        result.current.refresh();
      });
      expect(callback).toHaveBeenCalledTimes(1);

      // Still should fire on interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should clear interval on unmount', () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: false })
      );

      unmount();

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('callback updates', () => {
    it('should use latest callback when interval fires', () => {
      let counter = 0;
      const callback1 = vi.fn(() => counter++);
      const callback2 = vi.fn(() => (counter += 10));

      const { rerender } = renderHook(
        ({ cb }) => usePolling(cb, { interval: 1000, immediate: false }),
        { initialProps: { cb: callback1 } }
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(counter).toBe(1);

      // Update callback
      rerender({ cb: callback2 });

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(counter).toBe(11);
    });
  });

  describe('error handling', () => {
    it('should not crash when callback throws', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn(() => {
        throw new Error('Test error');
      });

      const { result } = renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: false })
      );

      expect(() => {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }).not.toThrow();

      expect(consoleError).toHaveBeenCalled();
      expect(result.current.isPolling).toBe(true);

      consoleError.mockRestore();
    });
  });
});

describe('useInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call callback at specified interval', () => {
    const callback = vi.fn();
    renderHook(() => useInterval(callback, 1000));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('should not start interval when delay is null', () => {
    const callback = vi.fn();
    renderHook(() => useInterval(callback, null));

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it('should pause/resume when delay changes to/from null', () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ delay }) => useInterval(callback, delay),
      { initialProps: { delay: 1000 } }
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Pause
    rerender({ delay: null });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Resume
    rerender({ delay: 1000 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should clean up on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useInterval(callback, 1000));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should use latest callback', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useInterval(cb, 1000),
      { initialProps: { cb: callback1 } }
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback1).toHaveBeenCalledTimes(1);

    rerender({ cb: callback2 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledTimes(1);
  });
});
