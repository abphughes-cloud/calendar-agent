import { isWindy, weatherConditionLabel, weatherEmoji, type HourlyWeather } from "@/lib/weather";

// A dedicated per-day lane rather than an overlay behind event tiles: at
// one marker per hour, an overlay would constantly be hidden behind
// whatever's scheduled that hour. A fixed-width lane keeps weather visible
// at a glance no matter how busy the day is.
export const WEATHER_COLUMN_WIDTH = 36;

export default function WeatherColumn({
  hourly,
  hours,
  startHour,
  hourPx,
}: {
  hourly: HourlyWeather[];
  hours: number[];
  startHour: number;
  hourPx: number;
}) {
  const byHour = new Map<number, HourlyWeather>();
  for (const h of hourly) {
    byHour.set(new Date(h.time).getHours(), h);
  }

  return (
    <div
      className="relative flex-shrink-0 border-r border-gray-200 bg-slate-50"
      style={{ width: WEATHER_COLUMN_WIDTH, height: hours.length * hourPx }}
    >
      {hours.map((hour) => {
        const weather = byHour.get(hour);
        const top = (hour - startHour) * hourPx;

        if (!weather) {
          return (
            <div
              key={hour}
              className="absolute inset-x-0 border-t border-gray-100"
              style={{ top, height: hourPx }}
            />
          );
        }

        const windy = isWindy(weather);
        const temp =
          weather.temperatureC !== null ? `${Math.round(weather.temperatureC)}°` : null;
        const windKmh = Math.round(
          Math.max(weather.windSpeedKmh ?? 0, weather.windGustsKmh ?? 0)
        );

        const tooltip = [
          weatherConditionLabel(weather.weatherCode),
          temp ? `${temp}C` : null,
          weather.precipitationProbability !== null
            ? `${Math.round(weather.precipitationProbability)}% rain chance`
            : null,
          weather.windSpeedKmh !== null
            ? `wind ${Math.round(weather.windSpeedKmh)}km/h`
            : null,
          weather.windGustsKmh !== null
            ? `gusts ${Math.round(weather.windGustsKmh)}km/h`
            : null,
          weather.isDay === false ? "before sunrise/after sunset" : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <div
            key={hour}
            title={tooltip}
            className="absolute inset-x-0 flex flex-col items-center justify-center border-t border-gray-100 leading-none text-gray-700"
            style={{ top, height: hourPx }}
          >
            <span className="text-sm">{weatherEmoji(weather.weatherCode)}</span>
            {temp && <span className="mt-0.5 text-[11px] font-semibold">{temp}</span>}
            {windy && (
              <span className="mt-0.5 text-[9px] font-medium text-sky-600">
                💨{windKmh}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
