import { useVersionCheck } from '../hooks/useVersionCheck'

export default function UpdateBanner() {
  const updateAvailable = useVersionCheck()
  if (!updateAvailable) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        backgroundColor: 'var(--charcoal)',
        borderBottom: '1px solid rgba(236,228,215,0.12)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
      }}
    >
      <p
        className="font-body"
        style={{ color: 'rgba(236,228,215,0.6)', fontSize: '13px', margin: 0 }}
      >
        A new version is available.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="font-body"
        style={{
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--maroon)',
          color: 'var(--maroon)',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          padding: '0 0 2px 0',
        }}
      >
        Refresh
      </button>
    </div>
  )
}
