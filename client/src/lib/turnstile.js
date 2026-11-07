// Cloudflare Turnstile (specs.md §5): a free bot check that is invisible to
// almost everyone. A visitor only sees it in the rare case Cloudflare wants
// them to tick a box.
//
// Usage:
//   const { containerRef, getToken } = useTurnstile()
//   <div ref={containerRef} />            // where a challenge would appear
//   const token = await getToken()        // fresh one-time token per submit
//
// Without VITE_TURNSTILE_SITE_KEY (local dev), getToken() returns null and the
// server skips the check when it has no secret either.

import { useCallback, useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise = null

function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_URL
      script.async = true
      script.onload = () => resolve(window.turnstile)
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('turnstile_unavailable'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function useTurnstile() {
  const containerRef = useRef(null)
  const widgetId = useRef(null)
  const pending = useRef(null)

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    loadScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return
        widgetId.current = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          execution: 'execute', // get a token only when the form is submitted
          appearance: 'interaction-only', // hidden unless a person must click
          callback: (token) => {
            pending.current?.resolve(token)
            pending.current = null
          },
          'error-callback': () => {
            pending.current?.reject(new Error('turnstile_failed'))
            pending.current = null
          },
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (widgetId.current != null && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [])

  const getToken = useCallback(async () => {
    if (!SITE_KEY) return null
    const turnstile = await loadScript()
    for (let i = 0; i < 50 && widgetId.current == null; i++) await sleep(100)
    if (widgetId.current == null) throw new Error('turnstile_unavailable')
    return new Promise((resolve, reject) => {
      pending.current = { resolve, reject }
      turnstile.reset(widgetId.current)
      turnstile.execute(widgetId.current)
      // Allow time for the rare visible challenge.
      setTimeout(() => {
        if (pending.current) {
          pending.current.reject(new Error('turnstile_timeout'))
          pending.current = null
        }
      }, 60000)
    })
  }, [])

  return { containerRef, getToken }
}

export const BOT_CHECK_FAILED =
  "We couldn't confirm you're not a bot. Please refresh the page and try again, or call us."
