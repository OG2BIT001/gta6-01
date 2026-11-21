// Port Solana: Neon Heat — shared constants: the world grid, the palette, vehicle and
// pedestrian tuning, and the numbers the wanted system runs on. Everything original:
// the city of Port Solana, its districts, people and cars are this game's own.

/** The fixed simulation step, in seconds: the world advances in 1/60 s ticks. */
export const STEP = 1 / 60;

/** The logical size of the canvas the game draws to (scaled to the window by CSS). */
export const VIEW = { width: 1280, height: 720 };

/**
 * The city grid. Blocks are square plots of land; a road runs along every grid line.
 * The world is (COLS * BLOCK) by (ROWS * BLOCK) pixels, with the bay along the south edge.
 */
export const CITY = {
  cols: 8,
  rows: 6,
  block: 600,
  road: 132,
  sidewalk: 26,
};
export const WORLD = { width: CITY.cols * CITY.block, height: CITY.rows * CITY.block };

/** The bay: open water south of this y, with a beach strip just north of it. */
export const COAST_Y = WORLD.height - 300;
/** The coast road's centre line: the last east-west road before the beach. */
export const COAST_ROAD_Y = WORLD.height - CITY.block + CITY.block / 2;

/** District names by grid position, west to east, north to south: the city's own quarters. */
export const DISTRICTS = [
  ['Palms Heights', 'Palms Heights', 'Old Solana', 'Downtown', 'Downtown', 'Cielo District', 'Airport Flats', 'Airport Flats'],
  ['Palms Heights', 'Mercado Viejo', 'Old Solana', 'Downtown', 'Downtown', 'Cielo District', 'Portside', 'Portside'],
  ['Marina Verde', 'Mercado Viejo', 'Neon Mile', 'Neon Mile', 'Downtown', 'Cielo District', 'Portside', 'Portside'],
  ['Marina Verde', 'Marina Verde', 'Neon Mile', 'Neon Mile', 'Little Cay', 'Little Cay', 'Portside', 'Portside'],
  ['Marina Verde', 'Marina Verde', 'Neon Mile', 'Neon Mile', 'Little Cay', 'Little Cay', 'Portside', 'Portside'],
  ['Marina Verde', 'Marina Verde', 'Neon Mile', 'Neon Mile', 'Little Cay', 'Little Cay', 'Portside', 'Portside'],
];

/** The palette: sun-soaked days, neon nights. */
export const COLORS = {
  grass: '#57a05a',
  grassDark: '#4c8f52',
  park: '#63ad5e',
  sand: '#ecd39a',
  water: '#2e7fa8',
  waterDeep: '#256a8f',
  asphalt: '#3c4048',
  asphaltDark: '#34373f',
  laneMark: '#e8e4d2',
  sidewalk: '#b9b3a4',
  sidewalkEdge: '#a39c8a',
  crosswalk: '#d9d5c8',
  buildingRoof: ['#c96f4a', '#b85c48', '#d9a05b', '#9fb4bd', '#7d8fa3', '#c4c9cd', '#a26769', '#e0cfa8'],
  buildingWall: '#8d8578',
  glassRoof: '#5d7d94',
  warehouseRoof: '#7a6a58',
  houseRoof: ['#b5523c', '#c97b4a', '#a85f43', '#bf6a4a'],
  palmTrunk: '#7a5c3e',
  palmLeaf: '#3e8e4f',
  treeLeaf: '#3f9142',
};

/** Vehicle types: name, size, speed, grip, value at the chop shop, and how it is painted. */
export const CAR_TYPES = {
  coupe: { name: 'Solana Coupe', length: 46, width: 22, topSpeed: 342, accel: 260, grip: 5.2, value: 420, colors: ['#d94f3d', '#3d7bd9', '#e8b83a', '#37b06b', '#e8e8ec', '#22242a'] },
  sedan: { name: 'Meridian Sedan', length: 48, width: 23, topSpeed: 288, accel: 205, grip: 4.6, value: 260, colors: ['#c8ccd2', '#5a6270', '#7a4a3a', '#3a5a7a', '#20242c', '#8a8f96'] },
  wagon: { name: 'Voyager Wagon', length: 50, width: 23, topSpeed: 262, accel: 185, grip: 4.3, value: 230, colors: ['#9aa48e', '#6a7a8a', '#b0a58e', '#4a4f57', '#7a3a4a'] },
  pickup: { name: 'Bravo Pickup', length: 52, width: 24, topSpeed: 268, accel: 195, grip: 4.2, value: 300, colors: ['#c45a2d', '#4a6a8a', '#d8d3c3', '#5a7a4a', '#333a42'] },
  van: { name: 'Cargo Van', length: 54, width: 25, topSpeed: 238, accel: 165, grip: 3.9, value: 340, colors: ['#e3e6e8', '#b9c0c7', '#7a8894', '#4f5a63'] },
  armored: { name: 'Bulwark Armored Van', length: 56, width: 26, topSpeed: 252, accel: 170, grip: 3.9, value: 1500, colors: ['#3d454e'] },
  taxi: { name: 'Solana Cab', length: 48, width: 23, topSpeed: 292, accel: 210, grip: 4.6, value: 240, colors: ['#f2b63a'] },
  copcar: { name: 'PSPD Interceptor', length: 49, width: 23, topSpeed: 356, accel: 285, grip: 5.4, value: 0, colors: ['#eceef0'] },
  racer: { name: 'Vela GT', length: 47, width: 22, topSpeed: 398, accel: 320, grip: 5.8, value: 950, colors: ['#e83a7a', '#7a3ad9', '#2ad9c9', '#e86a2a'] },
};

/** How many traffic cars and pedestrians the city keeps alive at once. */
export const POPULATION = { traffic: 26, parked: 30, peds: 42 };

/** The wanted system: heat points per star, and what each crime is worth. */
export const WANTED = {
  starHeat: [0, 30, 80, 160, 280, 440],
  decayPerSecond: 3.2,
  decayHiddenPerSecond: 9,
  crimes: {
    stealCar: 22,
    hitPed: 30,
    downPed: 55,
    hitCar: 8,
    hitCopCar: 45,
    assault: 26,
    shoot: 20,
    downCop: 130,
    hitBuilding: 4,
    missionAlarm: 60,
  },
  /** How close a witness must be to report a crime. */
  witnessRadius: 340,
  copSight: 380,
};

/** The player's own numbers. */
export const PLAYER = {
  radius: 11,
  walkSpeed: 148,
  runSpeed: 238,
  health: 100,
  punchRange: 30,
  punchDamage: 34,
  pistolDamage: 46,
  pistolRange: 460,
  pistolAmmoPrice: 2,
};

/** Named places the story and side work use, as block-grid anchors (col, row, and a label). */
export const PLACES = {
  garage: { col: 6, row: 1, label: "Mara's Garage" },
  chopshop: { col: 7, row: 3, label: 'Portside Chop Shop' },
  hotel: { col: 3, row: 2, label: 'Hotel Solana' },
  arcade: { col: 2, row: 2, label: 'Neon Mile Arcade' },
  marina: { col: 0, row: 5, label: 'Marina Verde Docks' },
  port: { col: 7, row: 2, label: 'Port Solana Terminal' },
  supply: { col: 4, row: 1, label: 'Solana Supply' },
  airport: { col: 7, row: 5, label: 'Cay Seaplane Dock' },
  start: { col: 1, row: 2, label: 'Mercado Viejo' },
};

/** localStorage keys for the save and the best-cash record. */
export const SAVE_KEY = 'port-solana-neon-heat-save-v1';
