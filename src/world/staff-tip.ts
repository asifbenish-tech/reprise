// src/world/staff-tip.ts: where the Distaff's tip is, from Bobbin's feet, per sprite frame (0 idle, 9 lifting,
// 10 held high). The sprite painter (tools/figures.ts BOBBIN_TIP) draws it there; a unit test keeps them equal.
export const STAFF_TIP: Record<number, [number, number]> = { 0: [13, -60], 9: [17, -76], 10: [11, -79] };
