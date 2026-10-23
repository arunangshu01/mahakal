import { useEffect, useState } from 'react'
import { getHealth } from '../api'

// Which AI providers the backend has keys for; null until the first response.
export function useHealth() {
  const [providers, setProviders] = useState(null)
  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((res) => !cancelled && setProviders(res.providers))
      .catch(() => !cancelled && setProviders({ groq: false, gemini: false }))
    return () => {
      cancelled = true
    }
  }, [])
  return providers
}
