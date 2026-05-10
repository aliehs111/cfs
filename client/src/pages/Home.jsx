import adhesive from '../../assets/adhesive_trowel.jpg'

export default function Home() {
  return (
    <section
      className="relative overflow-hidden w-full"
      style={{
        flex: 1,
        minHeight: 'calc(100vh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingBottom: '30vh',
      }}
    >
      {/* desktop: image bleeds across right ~65%, fades through charcoal so wordmark sits over the dim end of the image */}
      <div
        className="hidden md:block absolute right-0 top-0 bottom-0 pointer-events-none"
        style={{ width: '65%' }}
      >
        <img
          src={adhesive}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background:
              'linear-gradient(to right, var(--charcoal) 0%, rgba(26,24,22,0.78) 28%, rgba(26,24,22,0.15) 100%)',
          }}
        />
      </div>

      {/* mobile: image strip at top fades into charcoal */}
      <div
        className="md:hidden absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height: '40vh' }}
      >
        <img
          src={adhesive}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(26,24,22,0) 30%, var(--charcoal) 100%)',
          }}
        />
      </div>

      {/* content */}
      <div className="max-w-7xl mx-auto w-full relative z-10 px-6">
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(4rem, 18vw, 13rem)',
            lineHeight: 0.85,
            letterSpacing: '-0.03em',
            color: 'var(--off-white)',
          }}
        >
          Cavalier
        </h1>
        <p
          className="uppercase mt-1"
          style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 2rem)',
            letterSpacing: '0.32em',
            color: 'var(--off-white)',
            opacity: 0.7,
            marginLeft: 'calc(0.13 * clamp(4rem, 18vw, 13rem))',
          }}
        >
          Flooring Systems
        </p>
        <p
          className="mt-12 md:mt-16"
          style={{
            fontSize: '1rem',
            letterSpacing: '0.28em',
            color: 'var(--off-white)',
            opacity: 0.65,
            marginLeft: 'calc(0.13 * clamp(4rem, 18vw, 13rem))',
          }}
        >
          Since 1981
        </p>
      </div>
    </section>
  )
}
