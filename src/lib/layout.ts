export interface LaidOutEvent<T> {
  event: T;
  column: number;
  columnCount: number;
}

/**
 * Assigns each event a column and the column count of its overlap cluster,
 * so overlapping events can be rendered side by side (like a calendar's
 * time grid) instead of stacked on top of each other.
 */
export function layoutOverlaps<T>(
  events: T[],
  getStart: (event: T) => number,
  getEnd: (event: T) => number
): LaidOutEvent<T>[] {
  const sorted = [...events].sort((a, b) => getStart(a) - getStart(b));
  const result: LaidOutEvent<T>[] = [];

  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;

    const columnEnds: number[] = [];
    const assigned: { event: T; column: number }[] = [];

    for (const event of cluster) {
      const start = getStart(event);
      let column = columnEnds.findIndex((end) => end <= start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(getEnd(event));
      } else {
        columnEnds[column] = getEnd(event);
      }
      assigned.push({ event, column });
    }

    const columnCount = columnEnds.length;
    for (const { event, column } of assigned) {
      result.push({ event, column, columnCount });
    }

    cluster = [];
  };

  for (const event of sorted) {
    if (cluster.length > 0 && getStart(event) >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, getEnd(event));
  }
  flushCluster();

  return result;
}
