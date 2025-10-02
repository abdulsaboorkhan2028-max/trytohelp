const totals = {
  total: 0,
  successes: 0,
  failures: 0,
  intents: new Map(),
  latencyMs: []
};

export function recordMetric({ intent, success, latencyMs }) {
  totals.total += 1;
  if (success) totals.successes += 1;
  else totals.failures += 1;
  if (intent) {
    const current = totals.intents.get(intent) || 0;
    totals.intents.set(intent, current + 1);
  }
  if (typeof latencyMs === 'number') {
    totals.latencyMs.push(latencyMs);
    if (totals.latencyMs.length > 500) {
      totals.latencyMs.shift();
    }
  }
}

export function snapshotMetrics() {
  const averageLatency = totals.latencyMs.length
    ? Math.round(totals.latencyMs.reduce((a, b) => a + b, 0) / totals.latencyMs.length)
    : 0;
  const intents = {};
  totals.intents.forEach((count, intent) => {
    intents[intent] = count;
  });
  return {
    totalInteractions: totals.total,
    successRate: totals.total ? Number((totals.successes / totals.total).toFixed(2)) : 0,
    averageLatencyMs: averageLatency,
    intents
  };
}
