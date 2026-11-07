import { useCallback, useEffect, useState } from 'react'

// Account sessions (specs.md §1). The server issues a signed token at sign-in;
// we keep it in localStorage and send it as `Authorization: Bearer …`.
// Not a cookie: the site and API are on different domains until the domain
// move, and iPhone Safari blocks cross-site cookies.

const API_BASE = import.meta.env.VITE_API_URL || ''
const KEY = 'cavalier_session'

export const ROLE_LABELS = {
  dev_admin: 'Developer admin',
  admin: 'Admin',
  poster: 'Poster',
  user: 'User',
}

export const isAdmin = (user) => !!user && (user.role === 'admin' || user.role === 'dev_admin')
export const canPost = (user) => isAdmin(user) || user?.role === 'poster'

export function getToken() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode etc. — the session just won't survive a reload */
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401) setToken(null)
  return res
}

export async function readError(res, fallback) {
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') return data.detail
  } catch {
    /* not JSON */
  }
  return fallback
}

// Where someone lands after signing in.
export function homeFor(user) {
  if (isAdmin(user)) return '/admin'
  if (canPost(user)) return '/in-the-field/post'
  return '/in-the-field'
}

// The signed-in account, or null. Someone who still has to replace their
// temporary password counts as signed out here; /login finishes that step.
export function useCurrentUser() {
  const [state, setState] = useState(() => ({ user: null, loading: !!getToken() }))

  useEffect(() => {
    if (!getToken()) return
    let cancelled = false
    apiFetch('/api/auth/me')
      .then(async (res) => {
        const user = res.ok ? (await res.json()).user : null
        if (!cancelled) setState({ user: user && !user.must_change_password ? user : null, loading: false })
      })
      .catch(() => !cancelled && setState({ user: null, loading: false }))
    return () => {
      cancelled = true
    }
  }, [])

  const signOut = useCallback(() => {
    setToken(null)
    setState({ user: null, loading: false })
  }, [])

  return { ...state, signOut }
}
