import type { ForecastWeatherSignal } from '@/types'

export function isWeatherAvailable(
  weather: ForecastWeatherSignal | null | undefined,
): weather is ForecastWeatherSignal & { temp: number; condition: string } {
  return Boolean(
    weather &&
    weather.available !== false &&
    typeof weather.temp === 'number' &&
    Number.isFinite(weather.temp) &&
    typeof weather.condition === 'string' &&
    weather.condition.trim()
  )
}

export function weatherUnavailableReason(weather: ForecastWeatherSignal | null | undefined) {
  return weather?.unavailableReason || 'Weather data is unavailable for this forecast.'
}

interface LoadSheddingSignal {
  loadSheddingStage: number | null
  loadSheddingAvailable?: boolean | null
  loadSheddingUnavailableReason?: string | null
}

export function isLoadSheddingAvailable(
  signal: LoadSheddingSignal,
): signal is LoadSheddingSignal & { loadSheddingStage: number } {
  return signal.loadSheddingAvailable !== false && Number.isFinite(signal.loadSheddingStage)
}

export function loadSheddingUnavailableReason(signal: LoadSheddingSignal) {
  return signal.loadSheddingUnavailableReason || 'Load-shedding data is unavailable for this forecast.'
}
