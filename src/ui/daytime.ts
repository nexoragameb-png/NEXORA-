// Automatic day / night: the phase comes from the device's local clock and drives the hub sky,
// stadium floodlights, backdrop tint and the match-field ambience. Weather is a deterministic
// "forecast" per calendar day (same for everyone that day, no network needed).
import { useEffect, useState } from 'react';

export type PhaseK = 'dawn' | 'day' | 'dusk' | 'night';
export type Weather = 'clear' | 'clouds' | 'rain';
export type Sky = {
  k: PhaseK; weather: Weather;
  top: string; mid: string; low: string;      // sky gradient (zenith → horizon)
  ground: string; groundHi: string;           // pitch base colours
  lights: number;                              // floodlight intensity 0..1
  stars: number;                               // star alpha 0..1
  sun: number;                                 // sun / moon disc alpha
  tint: string;                                // UI scrim tint (rgba)
  accent: string;                              // UI accent for this phase
  fieldDim: number;                            // extra darkening of the match backdrop
  label: [string, string];                     // [fa, en]
};

const SKY: Record<PhaseK, Omit<Sky, 'k' | 'weather'>> = {
  dawn: { top: '#1b1650', mid: '#7a4a8c', low: '#ff9a6b', ground: '#0f3b2a', groundHi: '#1d5a3c', lights: .45, stars: .25, sun: .9, tint: 'rgba(30,14,40,.35)', accent: '#ffb37a', fieldDim: .08, label: ['سپیده‌دم', 'Dawn'] },
  day: { top: '#1d5fd1', mid: '#4fa3f0', low: '#bfe6ff', ground: '#16653c', groundHi: '#2a8a52', lights: .08, stars: 0, sun: 1, tint: 'rgba(4,20,48,.28)', accent: '#27e6ff', fieldDim: 0, label: ['روز', 'Day'] },
  dusk: { top: '#130a3a', mid: '#5a2a7a', low: '#ff6a4d', ground: '#0e3424', groundHi: '#1a4f36', lights: .8, stars: .35, sun: .8, tint: 'rgba(24,8,40,.4)', accent: '#ff7ae0', fieldDim: .12, label: ['غروب', 'Dusk'] },
  night: { top: '#02010a', mid: '#0a0626', low: '#1d1150', ground: '#08261b', groundHi: '#10392a', lights: 1, stars: 1, sun: .85, tint: 'rgba(2,1,10,.5)', accent: '#a43bff', fieldDim: .2, label: ['شب', 'Night'] },
};

export function phaseAt(d = new Date()): PhaseK {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= 5 && h < 7.5 ? 'dawn' : h >= 7.5 && h < 17.5 ? 'day' : h >= 17.5 && h < 19.5 ? 'dusk' : 'night';
}
export function weatherAt(d = new Date()): Weather {
  const seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const r = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  return r < .58 ? 'clear' : r < .84 ? 'clouds' : 'rain';
}
export const skyAt = (d = new Date()): Sky => { const k = phaseAt(d); return { k, weather: weatherAt(d), ...SKY[k] }; };

// re-evaluates once a minute; components re-render only when the phase/weather actually changes
export function useSky(): Sky {
  const [s, setS] = useState(skyAt);
  useEffect(() => {
    const id = setInterval(() => { const n = skyAt(); setS(o => (o.k === n.k && o.weather === n.weather ? o : n)); }, 60000);
    return () => clearInterval(id);
  }, []);
  return s;
}
