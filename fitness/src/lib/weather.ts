// Brisbane forecast from Open-Meteo (free, no key). Used to move outdoor sessions indoors on hot or wet days.
export type Weather = { date: string; maxTemp: number; minTemp: number; rainChance: number; morningTemp: number; code: number };

let cache: { at: number; data: Weather } | null = null;

export async function getWeather(): Promise<Weather | null> {
  if (cache && Date.now() - cache.at < 60 * 60 * 1000) return cache.data;
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-27.47&longitude=153.03'
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'
      + '&hourly=temperature_2m&timezone=Australia%2FBrisbane&forecast_days=1';
    const res = await fetch(url);
    if (!res.ok) return cache?.data ?? null;
    const j = await res.json();
    const data: Weather = {
      date: j.daily.time[0],
      maxTemp: Math.round(j.daily.temperature_2m_max[0]),
      minTemp: Math.round(j.daily.temperature_2m_min[0]),
      rainChance: Math.round(j.daily.precipitation_probability_max[0] ?? 0),
      morningTemp: Math.round(j.hourly.temperature_2m[6] ?? j.daily.temperature_2m_min[0]),
      code: j.daily.weather_code[0],
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? null;
  }
}

export function weatherIcon(w: Weather): string {
  if (w.rainChance >= 60 || (w.code >= 51 && w.code <= 82)) return 'weather-pouring';
  if (w.code >= 95) return 'weather-lightning';
  if (w.code >= 2) return 'weather-partly-cloudy';
  return 'weather-sunny';
}
