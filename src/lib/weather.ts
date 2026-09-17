// Live weather via Open-Meteo's UK Met Office (UKMO) model. No API key
// required. Docs: https://open-meteo.com/en/docs/ukmo-api
//
// Open-Meteo returns hourly timestamps as naive "YYYY-MM-DDTHH:mm" strings
// in whatever `timezone` param is requested. To keep this composable with
// the rest of the app (Google Calendar / Supabase timestamps are all real
// UTC, rendered in the browser's local time), we request `timezone=UTC`
// and normalize every timestamp to a real UTC ISO string ("...:00Z") so a
// plain `new Date(...)` works everywhere, same as elsewhere in the app.

const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_SECONDS = 1800; // 30 min — "reasonable" per spec, avoids hammering the API.
const MAX_FORECAST_DAYS = 8; // Open-Meteo's hard cap.
const MAX_PAST_DAYS = 3; // Keep it light; this is "current/forecast", not historical.

// South East London (near Greenwich) — a sensible default until the app
// stores a real per-user location.
export const DEFAULT_LATITUDE = 51.46;
export const DEFAULT_LONGITUDE = -0.01;

export interface HourlyWeather {
  /** Real UTC ISO timestamp, e.g. "2026-09-16T06:00:00Z". */
  time: string;
  temperatureC: number | null;
  precipitationProbability: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  showersMm: number | null;
  weatherCode: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  cloudCoverPct: number | null;
  isDay: boolean | null;
}

const HOURLY_FIELDS = [
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "cloud_cover",
  "is_day",
] as const;

/**
 * Fetches an hourly forecast from Open-Meteo's UKMO model covering
 * (roughly) the given week. The request window is clamped to what the
 * endpoint actually supports (8 days ahead, a few days of "past" for
 * same-week lookups) rather than the exact requested range — a week
 * outside that window just comes back with no matching hours, which the
 * caller renders as "no weather" rather than an error.
 *
 * Throws on a genuine fetch/parse failure; callers should catch this and
 * continue without weather rather than block the calendar.
 */
export async function fetchWeekWeather({
  weekStart,
  weekEnd,
  latitude = DEFAULT_LATITUDE,
  longitude = DEFAULT_LONGITUDE,
}: {
  weekStart: Date;
  weekEnd: Date;
  latitude?: number;
  longitude?: number;
}): Promise<HourlyWeather[]> {
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysAhead = Math.ceil((weekEnd.getTime() - now) / msPerDay);
  const daysBehind = Math.ceil((now - weekStart.getTime()) / msPerDay);

  const forecastDays = Math.min(MAX_FORECAST_DAYS, Math.max(1, daysAhead));
  const pastDays = Math.min(MAX_PAST_DAYS, Math.max(0, daysBehind));

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: HOURLY_FIELDS.join(","),
    timezone: "UTC",
    forecast_days: String(forecastDays),
    past_days: String(pastDays),
    models: "ukmo_seamless",
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    next: { revalidate: CACHE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo request failed with status ${res.status}`);
  }

  return normalizeHourly(await res.json());
}

function normalizeHourly(data: unknown): HourlyWeather[] {
  if (!data || typeof data !== "object") return [];
  const hourly = (data as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") return [];

  const h = hourly as Record<string, unknown>;
  const times = Array.isArray(h.time) ? h.time : [];

  const num = (key: string, i: number): number | null => {
    const arr = h[key];
    const v = Array.isArray(arr) ? arr[i] : undefined;
    return typeof v === "number" ? v : null;
  };

  const result: HourlyWeather[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (typeof t !== "string") continue;
    const isDayRaw = num("is_day", i);
    result.push({
      time: `${t}:00Z`,
      temperatureC: num("temperature_2m", i),
      precipitationProbability: num("precipitation_probability", i),
      precipitationMm: num("precipitation", i),
      rainMm: num("rain", i),
      showersMm: num("showers", i),
      weatherCode: num("weather_code", i),
      windSpeedKmh: num("wind_speed_10m", i),
      windGustsKmh: num("wind_gusts_10m", i),
      cloudCoverPct: num("cloud_cover", i),
      isDay: isDayRaw === null ? null : isDayRaw === 1,
    });
  }
  return result;
}

const CONDITION_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Light snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

const ICY_CODES = new Set([56, 57, 66, 67, 71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);
const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82]);
const FOG_CODES = new Set([45, 48]);

export function weatherConditionLabel(code: number | null): string {
  if (code === null) return "Weather unavailable";
  return CONDITION_LABELS[code] ?? "Unsettled";
}

/** Per the spec's simple emoji mapping: clear/partly/overcast/rain/storm/snow/fog. */
export function weatherEmoji(code: number | null): string {
  if (code === null) return "❔";
  if (code === 0 || code === 1) return "☀️";
  if (code === 2) return "⛅";
  if (FOG_CODES.has(code)) return "🌫️";
  if (STORM_CODES.has(code)) return "⛈️";
  if (ICY_CODES.has(code)) return "❄️";
  if (RAIN_CODES.has(code)) return "🌧️";
  return "☁️"; // 3 = overcast, and anything unmapped defaults to cloudy.
}

// A rough "how bad is this hour" ordering, used to pick the single most
// representative condition across a multi-hour window (so a 20-minute
// shower inside an otherwise-clear window isn't averaged away).
function weatherSeverity(code: number): number {
  if (STORM_CODES.has(code)) return 5;
  if (code === 65 || code === 67 || code === 75 || code === 82 || code === 86) return 4;
  if (RAIN_CODES.has(code) || ICY_CODES.has(code)) return 3;
  if (FOG_CODES.has(code)) return 2;
  if (code === 3) return 1;
  if (code === 2) return 0.5;
  return 0;
}

export const WIND_WARNING_KMH = 30;
export const GUST_WARNING_KMH = 40;

export function isWindy(
  hour: Pick<HourlyWeather, "windSpeedKmh" | "windGustsKmh">
): boolean {
  return (
    (hour.windSpeedKmh ?? 0) >= WIND_WARNING_KMH ||
    (hour.windGustsKmh ?? 0) >= GUST_WARNING_KMH
  );
}

export interface WindowWeatherSummary {
  conditionLabel: string;
  emoji: string;
  minTempC: number | null;
  maxTempC: number | null;
  maxPrecipProbability: number | null;
  maxWindKmh: number | null;
  maxGustKmh: number | null;
  rainy: boolean;
  windy: boolean;
  mostlyNight: boolean;
}

/**
 * Summarizes the hourly readings overlapping [startIso, endIso) into one
 * compact object for a free window or suggestion. Used both for the
 * planner prompt and could be reused for a richer tooltip later.
 */
export function summarizeWindowWeather(
  hourly: HourlyWeather[],
  startIso: string,
  endIso: string
): WindowWeatherSummary | null {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  // Hourly buckets are instants; include an hour if its reading falls
  // within an hour of the window on either side so short windows still
  // pick up their nearest reading.
  const inWindow = hourly.filter((h) => {
    const t = new Date(h.time).getTime();
    return t >= start - 3600_000 && t <= end + 3600_000;
  });
  if (inWindow.length === 0) return null;

  const nums = (pick: (h: HourlyWeather) => number | null): number[] =>
    inWindow.map(pick).filter((v): v is number => v !== null);

  const temps = nums((h) => h.temperatureC);
  const precipProbs = nums((h) => h.precipitationProbability);
  const winds = nums((h) => h.windSpeedKmh);
  const gusts = nums((h) => h.windGustsKmh);
  const rainAmounts = inWindow.map(
    (h) => (h.rainMm ?? 0) + (h.showersMm ?? 0) + (h.precipitationMm ?? 0)
  );
  const codes = nums((h) => h.weatherCode);
  const dayFlags = inWindow.map((h) => h.isDay).filter((v): v is boolean => v !== null);

  const worstCode =
    codes.length > 0
      ? codes.reduce((worst, c) => (weatherSeverity(c) > weatherSeverity(worst) ? c : worst))
      : null;

  const maxWind = winds.length ? Math.max(...winds) : null;
  const maxGust = gusts.length ? Math.max(...gusts) : null;
  const maxPrecipProbability = precipProbs.length ? Math.max(...precipProbs) : null;

  return {
    conditionLabel: weatherConditionLabel(worstCode),
    emoji: weatherEmoji(worstCode),
    minTempC: temps.length ? Math.min(...temps) : null,
    maxTempC: temps.length ? Math.max(...temps) : null,
    maxPrecipProbability,
    maxWindKmh: maxWind,
    maxGustKmh: maxGust,
    rainy: rainAmounts.some((mm) => mm > 0.2) || (maxPrecipProbability ?? 0) >= 50,
    windy: isWindy({ windSpeedKmh: maxWind, windGustsKmh: maxGust }),
    mostlyNight: dayFlags.length > 0 && dayFlags.filter((d) => !d).length >= dayFlags.length / 2,
  };
}

export function formatWindowWeather(summary: WindowWeatherSummary | null): string {
  if (!summary) return "forecast unavailable";
  const parts = [summary.conditionLabel];
  if (summary.minTempC !== null && summary.maxTempC !== null) {
    parts.push(
      Math.round(summary.minTempC) === Math.round(summary.maxTempC)
        ? `${Math.round(summary.minTempC)}°C`
        : `${Math.round(summary.minTempC)}–${Math.round(summary.maxTempC)}°C`
    );
  }
  if (summary.maxPrecipProbability !== null) {
    parts.push(`${Math.round(summary.maxPrecipProbability)}% rain chance`);
  }
  if (summary.maxWindKmh !== null) {
    const gust = summary.maxGustKmh !== null ? `, gusts ${Math.round(summary.maxGustKmh)}km/h` : "";
    parts.push(`wind ~${Math.round(summary.maxWindKmh)}km/h${gust}`);
  }
  if (summary.mostlyNight) parts.push("before sunrise/after sunset");
  return parts.join(", ");
}
