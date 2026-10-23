// Simulated race for the timing-tower section. Deterministic: same scroll, same race.
export const LAPS = 57;

const TEAMS = {
  mcl: ['McLaren', '#FF8000'],
  rbr: ['Red Bull Racing', '#3671C6'],
  fer: ['Ferrari', '#E8002D'],
  mer: ['Mercedes', '#27F4D2'],
  ast: ['Aston Martin', '#229971'],
  alp: ['Alpine', '#0093CC'],
  wil: ['Williams', '#64C4FF'],
  rb: ['Racing Bulls', '#6692FF'],
  haa: ['Haas', '#B6BABD'],
  aud: ['Audi', '#F50537'],
  cad: ['Cadillac', '#E8E8E8'],
};

// grid order; pace = seconds per lap slower than the quickest car; stints = [compound, pit lap] ...
const GRID = [
  ['NOR', 'Lando Norris', 'mcl', 0.0, [['M', 20], ['H']]],
  ['VER', 'Max Verstappen', 'rbr', 0.05, [['M', 22], ['H']]],
  ['LEC', 'Charles Leclerc', 'fer', 0.15, [['M', 19], ['H']]],
  ['PIA', 'Oscar Piastri', 'mcl', 0.08, [['S', 13], ['H', 34], ['M']]],
  ['RUS', 'George Russell', 'mer', 0.2, [['M', 21], ['H']]],
  ['HAM', 'Lewis Hamilton', 'fer', 0.25, [['H', 34], ['M']]],
  ['ANT', 'Kimi Antonelli', 'mer', 0.35, [['M', 23], ['H']]],
  ['ALO', 'Fernando Alonso', 'ast', 0.55, [['M', 20], ['H']]],
  ['HAD', 'Isack Hadjar', 'rbr', 0.5, [['S', 14], ['H']]],
  ['SAI', 'Carlos Sainz', 'wil', 0.6, [['M', 22], ['H']]],
  ['ALB', 'Alexander Albon', 'wil', 0.65, [['M', 24], ['H']]],
  ['GAS', 'Pierre Gasly', 'alp', 0.7, [['H', 34], ['M']]],
  ['LAW', 'Liam Lawson', 'rb', 0.72, [['M', 21], ['H']]],
  ['OCO', 'Esteban Ocon', 'haa', 0.8, [['M', 19], ['H']]],
  ['BEA', 'Oliver Bearman', 'haa', 0.78, [['S', 15], ['H', 34], ['M']]],
  ['HUL', 'Nico Hülkenberg', 'aud', 0.85, [['M', 23], ['H']]],
  ['BOR', 'Gabriel Bortoleto', 'aud', 0.82, [['M', 22], ['H']]],
  ['LIN', 'Arvid Lindblad', 'rb', 0.95, [['H', 34], ['M']]],
  ['STR', 'Lance Stroll', 'ast', 0.9, [['M', 20], ['H']]],
  ['COL', 'Franco Colapinto', 'alp', 1.0, [['M', 21], ['H']]],
  ['PER', 'Sergio Pérez', 'cad', 1.15, [['M', 20], ['H']]],
  ['BOT', 'Valtteri Bottas', 'cad', 1.2, [['H', 34], ['M']]],
];

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const BASE = 91.5;
const OFFSET = { S: -0.6, M: 0, H: 0.45 };
const DEG = { S: 0.09, M: 0.06, H: 0.04 };
const PIT_LOSS = 21.5;
const SC = [33, 36]; // safety car laps (inclusive)
const DNF = { STR: 32 };
const PENALTY = { OCO: 30 }; // 5 s added from this lap
const TRACK_LIMITS = { ALB: [24, 29] };
const INVESTIGATION = { LAW: [41, 45] };
// race control messages, by lap
const MESSAGES = {
  24: 'TRACK LIMITS · ALB · TURN 4 · LAP TIME DELETED',
  27: 'BLACK AND WHITE FLAG · ALB · TRACK LIMITS',
  30: '5 SECOND TIME PENALTY · OCO · LEAVING THE TRACK AND GAINING AN ADVANTAGE',
  32: 'DOUBLE YELLOW · SECTOR 2 · STR STOPPED ON TRACK',
  33: 'SAFETY CAR DEPLOYED',
  36: 'SAFETY CAR IN THIS LAP',
  41: 'INCIDENT · LAW · UNDER INVESTIGATION',
  46: 'NO FURTHER INVESTIGATION · LAW',
  57: 'CHEQUERED FLAG',
};

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// returns laps[1..LAPS], each an array of rows sorted by position
export function simulate() {
  const rand = rng(57);
  const cars = GRID.map(([code, name, team, pace, stints], i) => ({
    code, name, team: TEAMS[team][0], color: TEAMS[team][1], pace, stints, grid: i + 1,
    total: 0, stint: 0, age: 0, pits: 0, out: false, best: Infinity,
  }));
  const laps = [];
  let fastest = null;

  for (let lap = 1; lap <= LAPS; lap++) {
    const sc = lap >= SC[0] && lap <= SC[1];
    for (const c of cars) {
      if (c.out) continue;
      if (DNF[c.code] === lap) { c.out = true; continue; }
      const comp = c.stints[c.stint][0];
      // cars get ~0.06 s/lap quicker as fuel burns off
      let t = sc ? 118 : BASE + c.pace + OFFSET[comp] + DEG[comp] * c.age - 0.06 * lap + (rand() - 0.5) * 0.6;
      if (lap === 1) t += 3.5 + c.grid * 0.35;
      c.pitted = c.stints[c.stint][1] === lap;
      if (c.pitted) {
        t += sc ? 11 : PIT_LOSS;
        c.stint++; c.pits++; c.age = 0;
      } else c.age++;
      if (PENALTY[c.code] === lap) t += 5;
      c.total += t;
      c.last = t;
      if (!sc && lap > 1 && !c.pitted && t < c.best) c.best = t;
      if (!sc && lap > 1 && !c.pitted && (!fastest || t < fastest.time)) fastest = { code: c.code, time: t, lap };
    }
    // safety car bunches the field up behind the leader
    if (sc) {
      const running = cars.filter((c) => !c.out).sort((a, b) => a.total - b.total);
      running.forEach((c, i) => { c.total = running[0].total + i * 0.7; });
    }
    const order = [...cars].sort((a, b) => (a.out - b.out) || (a.out ? 0 : a.total - b.total));
    const leader = order[0];
    laps[lap] = {
      lap,
      status: sc ? 'sc' : lap === LAPS ? 'chequered' : DNF.STR === lap ? 'yellow' : 'green',
      fastest: fastest && { ...fastest },
      message: [lap, lap - 1, lap - 2].map((l) => MESSAGES[l]).find(Boolean) ?? null,
      rows: order.map((c, i) => {
        const gap = c.total - leader.total;
        const ahead = order[i - 1];
        const interval = ahead && !c.out ? c.total - ahead.total : 0;
        const flags = [];
        if (lap === LAPS && !c.out && i < 10) flags.push(['pts', `+${POINTS[i]} PTS`]);
        if (c.out) flags.push(['out', 'OUT']);
        if (c.pitted && !c.out) flags.push(['pit', 'PIT']);
        if (PENALTY[c.code] <= lap) flags.push(['pen', '+5s PEN']);
        const tl = TRACK_LIMITS[c.code];
        if (tl && lap >= tl[0] && lap <= tl[1]) flags.push(['warn', 'TRACK LIMITS']);
        const inv = INVESTIGATION[c.code];
        if (inv && lap >= inv[0] && lap <= inv[1]) flags.push(['inv', 'INVESTIGATION']);
        return {
          code: c.code, name: c.name, team: c.team, color: c.color, grid: c.grid, pos: i + 1,
          gap, interval, out: c.out,
          lapped: gap > BASE ? Math.floor(gap / BASE) : 0,
          comp: c.stints[Math.min(c.stint, c.stints.length - 1)][0], age: c.age, pits: c.pits,
          overtake: !sc && lap > 2 && lap < LAPS && !c.out && i > 0 && interval < 1, // off for the first two laps, like DRS was // 2026 Overtake Mode: within 1 s
          flags,
        };
      }),
    };
  }
  return laps;
}
