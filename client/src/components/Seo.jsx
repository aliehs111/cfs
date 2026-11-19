import { SITE_NAME, DEFAULT_IMAGE, absolute } from '../seo'

// Page title, description and link-preview tags. React 19 moves these into
// <head> by itself. During the build-time render (import.meta.env.SSR) it
// renders nothing: scripts/prerender.mjs writes the same tags into <head>.
export default function Seo({ title, description, path, image = DEFAULT_IMAGE, type = 'website', noindex = false }) {
  if (import.meta.env.SSR) return null
  const url = noindex ? '' : absolute(path)
  const imageUrl = absolute(image)
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex" />}
      {url && <link rel="canonical" href={url} />}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {url && <meta property="og:url" content={url} />}
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
    </>
  )
}
