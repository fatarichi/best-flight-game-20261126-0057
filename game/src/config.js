// Coral Coast Run — tuning constants and course definitions.
// One job: every number the flight model, the world and the HUD agree on.

export const TUNING = {
  maxSpeed: 96, // m/s at full throttle (~346 km/h)
  minSpeed: 16, // m/s at idle
  stallSpeed: 27, // m/s — below this the wing stops flying
  accel: 7, // m/s^2 toward the throttle's target speed
  brakeDecel: 14, // m/s^2 with the airbrake held
  maxRoll: 1.15, // rad of bank at full stick
  rollRate: 2.6, // rad/s toward the commanded bank
  maxPitch: 0.52, // rad of pitch at full stick
  pitchRate: 1.9, // rad/s toward the commanded pitch
  turnFactor: 0.0052, // heading rate per (sin roll * speed)
  fuelBurn: 0.24, // %/s at full throttle
  fuelRingBonus: 6, // % fuel back for each ring flown
  ringScore: 1000,
  landingScore: 2000,
  maxLandingBonus: 1500,
  seaLevel: 0,
  runwayElevation: 9, // metres above the sea
  crashDescent: -7, // m/s — hitting ground harder than this is a crash
  hardLandingDescent: -4.5, // m/s — a landing harder than this takes damage
  gearSpeedLimit: 55, // m/s — fastest safe touchdown
  cameraDistance: 15, // metres behind the aircraft
  cameraHeight: 5.5, // metres above the aircraft
};

// A course is one sortie: a sky, a ring route and a home runway.
export const COURSES = [
  {
    id: 'emerald',
    name: 'Emerald Coast',
    sub: 'Day patrol — 8 rings, land runway 07',
    difficulty: 'Easy',
    palette: {
      skyTop: '#2f7fd0', skyMid: '#7ec3ee', skyLow: '#cfeefb',
      fog: '#bcd9ea', seaDeep: '#0b5e8a', seaShallow: '#2fb3a3',
      sun: '#fff3c4', sunX: 0.72, sunY: 0.16, cloud: '#ffffff',
    },
    start: { x: -2600, y: 320, z: 1500, heading: 1.15, speed: 58, throttle: 0.62 },
    runway: { heading: 1.22, direction: '07' },
    rings: [
      { x: -1700, y: 300, z: 900, r: 42 },
      { x: -900, y: 260, z: 250, r: 40 },
      { x: -150, y: 300, z: -450, r: 42 },
      { x: 700, y: 220, z: -950, r: 38 },
      { x: 1500, y: 260, z: -500, r: 40 },
      { x: 1900, y: 180, z: 350, r: 38 },
      { x: 1300, y: 240, z: 1050, r: 42 },
      { x: 450, y: 200, z: 1250, r: 40 },
    ],
  },
  {
    id: 'amber',
    name: 'Amber Strait',
    sub: 'Sunset run — 8 tight rings, land runway 25',
    difficulty: 'Medium',
    palette: {
      skyTop: '#3a3f7d', skyMid: '#c96a4a', skyLow: '#f7b267',
      fog: '#e8a97e', seaDeep: '#274b6d', seaShallow: '#3f8f7a',
      sun: '#ffd98a', sunX: 0.24, sunY: 0.2, cloud: '#ffd9b0',
    },
    start: { x: 2400, y: 300, z: -1600, heading: 2.6, speed: 62, throttle: 0.66 },
    runway: { heading: 1.22 + Math.PI, direction: '25' },
    rings: [
      { x: 1700, y: 280, z: -1100, r: 38 },
      { x: 900, y: 230, z: -700, r: 36 },
      { x: 250, y: 270, z: -150, r: 38 },
      { x: -350, y: 200, z: 350, r: 34 },
      { x: -1050, y: 250, z: 800, r: 36 },
      { x: -1750, y: 180, z: 500, r: 34 },
      { x: -2100, y: 240, z: -350, r: 38 },
      { x: -1500, y: 210, z: -1100, r: 36 },
    ],
  },
  {
    id: 'mist',
    name: 'Mist Peaks',
    sub: 'Dawn valley — 8 high rings, land runway 07',
    difficulty: 'Hard',
    palette: {
      skyTop: '#5a6d94', skyMid: '#a8b8cc', skyLow: '#e8d9bd',
      fog: '#c3ccd4', seaDeep: '#33566e', seaShallow: '#4d8a86',
      sun: '#ffe9b8', sunX: 0.5, sunY: 0.12, cloud: '#f4ede0',
    },
    start: { x: -2400, y: 420, z: -600, heading: 0.6, speed: 60, throttle: 0.64 },
    runway: { heading: 1.22, direction: '07' },
    rings: [
      { x: -1600, y: 430, z: -250, r: 36 },
      { x: -800, y: 480, z: 150, r: 34 },
      { x: -100, y: 380, z: 500, r: 36 },
      { x: 600, y: 460, z: 150, r: 34 },
      { x: 1150, y: 400, z: -450, r: 36 },
      { x: 900, y: 330, z: -1050, r: 34 },
      { x: 100, y: 380, z: -1250, r: 36 },
      { x: -700, y: 300, z: -950, r: 38 },
    ],
  },
];

export const RUNWAY = {
  x: 0, // centre of the strip, metres
  z: 0,
  length: 760,
  width: 30,
  heading: 1.22, // radians — runway 07
};
