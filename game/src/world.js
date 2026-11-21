// The city of Port Solana: a grid of blocks and avenues on a bay, generated from a seed.
// Buildings, parks, parking lots, piers, palms and lamps all come from here, along with the
// spatial questions every other system asks: is this road, water, sidewalk; does this point
// hit a building; which district is this.
import { CITY, COAST_Y, COLORS, DISTRICTS, PLACES, WORLD } from './config.js';

const HALF_ROAD = CITY.road / 2;

/** The centre lines of the avenues: vertical lines at every block boundary. */
export const ROAD_XS = [];
for (let i = 0; i <= CITY.cols; i += 1) ROAD_XS.push(i * CITY.block);
/** The centre lines of the streets; the last is the coast road, south of which is the beach. */
export const ROAD_YS = [];
for (let i = 0; i < CITY.rows; i += 1) ROAD_YS.push(i * CITY.block);

/** Which district a world point falls in. */
export function districtAt(x, y) {
  const col = Math.min(CITY.cols - 1, Math.max(0, Math.floor(x / CITY.block)));
  const row = Math.min(CITY.rows - 1, Math.max(0, Math.floor(y / CITY.block)));
  return DISTRICTS[row][col];
}

/** True when the point is on a road surface (either direction of avenue or street). */
export function isRoad(x, y) {
  if (y > COAST_Y) return false;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= HALF_ROAD) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= HALF_ROAD) return true;
  return false;
}

/** True when the point is on a sidewalk: the ring between a road's edge and the block inside. */
export function isSidewalk(x, y) {
  const inner = HALF_ROAD + CITY.sidewalk;
  for (const rx of ROAD_XS) {
    const d = Math.abs(x - rx);
    if (d > HALF_ROAD && d <= inner && y < COAST_Y) return true;
  }
  for (const ry of ROAD_YS) {
    const d = Math.abs(y - ry);
    if (d > HALF_ROAD && d <= inner) return true;
  }
  return false;
}

/** Piers reach into the bay at the marina and the seaplane dock: ground, not water. */
const PIERS = [
  { x: 120, y: COAST_Y - 40, w: 90, h: 240 },
  { x: 330, y: COAST_Y - 40, w: 90, h: 240 },
  { x: WORLD.width - 420, y: COAST_Y - 40, w: 90, h: 240 },
  { x: WORLD.width - 210, y: COAST_Y - 40, w: 90, h: 240 },
];

export function onPier(x, y) {
  return PIERS.some((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
}

/** True when the point is open water (the bay, south of the coast, off a pier). */
export function isWater(x, y) {
  return y > COAST_Y && !onPier(x, y);
}

/** The inside of one block: the land between its surrounding sidewalks. */
function blockInterior(col, row) {
  const x0 = col * CITY.block + HALF_ROAD + CITY.sidewalk;
  const y0 = row * CITY.block + HALF_ROAD + CITY.sidewalk;
  const x1 = (col + 1) * CITY.block - HALF_ROAD - CITY.sidewalk;
  const y1 = (row + 1) * CITY.block - HALF_ROAD - CITY.sidewalk;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Landmark buildings the story names, keyed by their PLACES key. */
const LANDMARKS = {
  garage: { name: "Mara's Garage", roof: '#6a7a8a', sign: 'GARAGE' },
  chopshop: { name: 'Portside Chop Shop', roof: '#5d6a72', sign: 'CHOP SHOP' },
  hotel: { name: 'Hotel Solana', roof: '#e0cfa8', sign: 'HOTEL SOLANA' },
  arcade: { name: 'Neon Mile Arcade', roof: '#7a3ad9', sign: 'ARCADE' },
  marina: { name: 'Marina Verde Docks', roof: '#7a6a58', sign: 'MARINA' },
  port: { name: 'Port Solana Terminal', roof: '#7a6a58', sign: 'TERMINAL' },
  supply: { name: 'Solana Supply', roof: '#8a4a3a', sign: 'SUPPLY' },
  airport: { name: 'Cay Seaplane Dock', roof: '#6a7a8a', sign: 'SEAPLANES' },
};

/** Build the whole city from a seeded generator. Deterministic for a given seed. */
export function createWorld(rng) {
  const buildings = [];
  const props = [];
  const lots = [];
  const parks = [];
  const places = {};

  const addBuilding = (rect, kind, roof, floors, name = '', sign = '') => {
    const building = { ...rect, kind, roof, floors, name, sign };
    buildings.push(building);
    return building;
  };

  for (let row = 0; row < CITY.rows; row += 1) {
    for (let col = 0; col < CITY.cols; col += 1) {
      const district = DISTRICTS[row][col];
      const inner = blockInterior(col, row);
      const isCoastBlock = row === CITY.rows - 1;

      // A landmark sits at the north-west building slot of its anchor block.
      let landmarkKey = null;
      for (const [key, place] of Object.entries(PLACES)) {
        if (place.col === col && place.row === row && LANDMARKS[key]) landmarkKey = key;
      }

      if (isCoastBlock && col > 0 && col < CITY.cols - 1 && !landmarkKey) {
        // Beachfront: open sand and palms, a park by the water.
        parks.push({ ...inner, kind: 'beach' });
        for (let i = 0; i < 7; i += 1) {
          props.push({ kind: 'palm', x: inner.x + rng.range(20, inner.w - 20), y: inner.y + rng.range(20, inner.h - 20), lean: rng.range(-0.2, 0.2) });
        }
        continue;
      }

      const roll = rng.next();
      if (roll < 0.12 && !landmarkKey) {
        parks.push({ ...inner, kind: 'park' });
        for (let i = 0; i < 12; i += 1) {
          props.push({ kind: rng.chance(0.5) ? 'palm' : 'tree', x: inner.x + rng.range(24, inner.w - 24), y: inner.y + rng.range(24, inner.h - 24), lean: rng.range(-0.15, 0.15) });
        }
        continue;
      }
      if (roll < 0.24 && !landmarkKey) {
        // A parking lot: rows of marked bays the parked-car spawner fills.
        const lot = { ...inner, bays: [] };
        for (let bx = inner.x + 26; bx < inner.x + inner.w - 40; bx += 56) {
          for (let by = inner.y + 30; by < inner.y + inner.h - 50; by += 92) {
            lot.bays.push({ x: bx + 20, y: by + 24, angle: Math.PI / 2 });
          }
        }
        lots.push(lot);
        continue;
      }

      // Built-up block: subdivide into 2x2 plots with alleys between.
      const plotW = (inner.w - 36) / 2;
      const plotH = (inner.h - 36) / 2;
      for (let px = 0; px < 2; px += 1) {
        for (let py = 0; py < 2; py += 1) {
          const rect = {
            x: inner.x + px * (plotW + 36) + rng.range(2, 10),
            y: inner.y + py * (plotH + 36) + rng.range(2, 10),
            w: plotW - rng.range(4, 16),
            h: plotH - rng.range(4, 16),
          };
          if (landmarkKey && px === 0 && py === 0) {
            const mark = LANDMARKS[landmarkKey];
            const building = addBuilding(rect, 'landmark', mark.roof, 3, mark.name, mark.sign);
            places[landmarkKey] = {
              x: rect.x + rect.w / 2,
              y: rect.y + rect.h + 44,
              label: PLACES[landmarkKey].label,
              building,
            };
            continue;
          }
          if (district === 'Downtown' || district === 'Cielo District') {
            addBuilding(rect, 'tower', rng.chance(0.45) ? COLORS.glassRoof : rng.pick(COLORS.buildingRoof), rng.int(9, 22));
          } else if (district === 'Portside') {
            addBuilding(rect, 'warehouse', COLORS.warehouseRoof, rng.int(1, 2));
            if (rng.chance(0.6)) props.push({ kind: 'container', x: rect.x + rng.range(0, rect.w - 44), y: rect.y - 30, color: rng.pick(['#c45a2d', '#3a7a8a', '#8a4a6a', '#4a7a4a']) });
          } else if (district === 'Neon Mile' || district === 'Little Cay') {
            addBuilding(rect, 'block', rng.pick(COLORS.buildingRoof), rng.int(3, 7));
            if (rng.chance(0.55)) props.push({ kind: 'sign', x: rect.x + rect.w / 2, y: rect.y - 8, text: rng.pick(['NEON', 'BAR SOL', 'CAY CLUB', 'HOTEL', '24H', 'PALMS']) });
          } else {
            addBuilding(rect, 'house', rng.pick(COLORS.houseRoof), rng.int(1, 2));
            if (rng.chance(0.5)) props.push({ kind: 'palm', x: rect.x - 14, y: rect.y + rect.h + 12, lean: rng.range(-0.2, 0.2) });
          }
        }
      }
    }
  }

  // The start place is a curb in Mercado Viejo, not a building.
  const startBlock = blockInterior(PLACES.start.col, PLACES.start.row);
  places.start = { x: startBlock.x - 60, y: startBlock.y + 60, label: PLACES.start.label, building: null };
  // The marina and airport places sit on their piers when their landmark fell elsewhere.
  if (!places.marina) places.marina = { x: 165, y: COAST_Y + 130, label: PLACES.marina.label, building: null };
  if (!places.airport) places.airport = { x: WORLD.width - 165, y: COAST_Y + 130, label: PLACES.airport.label, building: null };

  // Street lamps along every avenue, both sides, spaced out.
  for (const rx of ROAD_XS) {
    for (let y = 90; y < COAST_Y - 40; y += 210) {
      props.push({ kind: 'lamp', x: rx - HALF_ROAD - 8, y });
      props.push({ kind: 'lamp', x: rx + HALF_ROAD + 8, y: y + 105 > COAST_Y - 40 ? y : y + 105 });
    }
  }

  return { buildings, props, lots, parks, places, piers: PIERS };
}

/** True when a circle at (x, y) with radius r overlaps any building. */
export function hitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** The building a point stands inside, or null. */
export function buildingAt(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** Clamp a point into the world, keeping it out of the water unless on a pier. */
export function clampToLand(x, y, r) {
  const nx = Math.min(WORLD.width - r, Math.max(r, x));
  let ny = Math.min(WORLD.height - r, Math.max(r, y));
  if (ny > COAST_Y + r && !onPier(nx, ny)) ny = COAST_Y + r;
  return { x: nx, y: ny };
}
