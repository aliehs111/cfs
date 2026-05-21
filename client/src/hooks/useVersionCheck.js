import { useEffect, useState } from 'react'

const POLL_INTERVAL = 2 * 60 * 1000

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { version } = await res.json()
        if (version !== __APP_VERSION__) setUpdateAvailable(true)
      } catch {
        // network error — ignore
      }
    }

    const id = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return updateAvailable
}
