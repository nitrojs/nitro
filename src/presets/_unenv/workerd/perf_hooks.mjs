// https://github.com/unjs/unenv/blob/main/src/runtime/node/perf_hooks.ts

import {
  constants,
  createHistogram,
  monitorEventLoopDelay,
  Performance,
  PerformanceEntry,
  PerformanceMark,
  PerformanceMeasure,
  PerformanceObserver,
  PerformanceObserverEntryList,
  PerformanceResourceTiming,
  performance as unenvPerformance,
} from "unenv/node/perf_hooks";

export {
  Performance,
  PerformanceEntry,
  PerformanceMark,
  PerformanceMeasure,
  PerformanceObserverEntryList,
  PerformanceObserver,
  PerformanceResourceTiming,
  constants,
  createHistogram,
  monitorEventLoopDelay,
} from "unenv/node/perf_hooks";

const workerdGlobalPerformance = globalThis["perf" + "ormance"];

export const performance = /*@__PURE__*/ Object.assign(
  workerdGlobalPerformance,
  {
    addEventListener: unenvPerformance.addEventListener.bind(unenvPerformance),
    clearMarks: unenvPerformance.clearMarks.bind(unenvPerformance),
    clearMeasures: unenvPerformance.clearMeasures.bind(unenvPerformance),
    clearResourceTimings:
      unenvPerformance.clearResourceTimings.bind(unenvPerformance),
    dispatchEvent: unenvPerformance.dispatchEvent.bind(unenvPerformance),
    eventLoopUtilization:
      unenvPerformance.eventLoopUtilization.bind(unenvPerformance),
    getEntries: unenvPerformance.getEntries.bind(unenvPerformance),
    getEntriesByName: unenvPerformance.getEntriesByName.bind(unenvPerformance),
    getEntriesByType: unenvPerformance.getEntriesByType.bind(unenvPerformance),
    mark: unenvPerformance.mark.bind(unenvPerformance),
    markResourceTiming:
      unenvPerformance.markResourceTiming.bind(unenvPerformance),
    measure: unenvPerformance.measure.bind(unenvPerformance),
    nodeTiming: { ...unenvPerformance.nodeTiming },
    onresourcetimingbufferfull:
      typeof unenvPerformance.onresourcetimingbufferfull === "function"
        ? unenvPerformance.onresourcetimingbufferfull.bind(unenvPerformance)
        : unenvPerformance.onresourcetimingbufferfull,
    removeEventListener:
      unenvPerformance.removeEventListener.bind(unenvPerformance),
    setResourceTimingBufferSize:
      unenvPerformance.setResourceTimingBufferSize.bind(unenvPerformance),
    timerify: unenvPerformance.timerify.bind(unenvPerformance),
    toJSON: unenvPerformance.toJSON.bind(unenvPerformance),
  }
);

export default {
  Performance,
  PerformanceEntry,
  PerformanceMark,
  PerformanceMeasure,
  PerformanceObserverEntryList,
  PerformanceObserver,
  PerformanceResourceTiming,
  constants,
  createHistogram,
  monitorEventLoopDelay,
  performance,
};
