/*
  Minimal binary min-heap of integer ids keyed by a number priority (CLAUDE.md §12).
  Used by the hydrology priority-flood. Priorities are captured at push time.
*/
export class MinHeap {
  private ids: number[] = [];
  private pri: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, priority: number): void {
    this.ids.push(id);
    this.pri.push(priority);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.pri[parent]! <= this.pri[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Remove and return the id with the smallest priority (−1 if empty). */
  pop(): number {
    const n = this.ids.length;
    if (n === 0) return -1;
    const topId = this.ids[0]!;
    const lastId = this.ids.pop()!;
    const lastPri = this.pri.pop()!;
    if (n > 1) {
      this.ids[0] = lastId;
      this.pri[0] = lastPri;
      let i = 0;
      const len = this.ids.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < len && this.pri[l]! < this.pri[smallest]!) smallest = l;
        if (r < len && this.pri[r]! < this.pri[smallest]!) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return topId;
  }

  private swap(a: number, b: number): void {
    const ti = this.ids[a]!;
    this.ids[a] = this.ids[b]!;
    this.ids[b] = ti;
    const tp = this.pri[a]!;
    this.pri[a] = this.pri[b]!;
    this.pri[b] = tp;
  }
}
