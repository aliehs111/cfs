// Build-time renderer: turns one URL into the page's HTML, so search engines
// and link previews get real content without running JavaScript. Called by
// scripts/prerender.mjs after `vite build --ssr`. Not used in the browser,
// so the dev-server fast-refresh rule doesn't apply.
/* eslint-disable react-refresh/only-export-components */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { AppShell } from './App.jsx'

export { PAGES, metaForPath, metaForProject, absolute, SITE_URL, SITE_NAME, DEFAULT_IMAGE } from './seo.js'

export function render(url, preload = null) {
  globalThis.__CAVALIER_PRELOAD__ = preload
  try {
    return renderToString(
      <StaticRouter location={url}>
        <AppShell />
      </StaticRouter>,
    )
  } finally {
    globalThis.__CAVALIER_PRELOAD__ = null
  }
}
