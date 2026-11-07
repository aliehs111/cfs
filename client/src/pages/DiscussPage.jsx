import ProjectIntake from '../components/ProjectIntake'
import hero from '../../assets/discuss_hero.jpg'

// "How can we help?" sits over a filtered photo of an empty commercial space
// (web copy of "assets/Sunlit Modern Industrial Interior.png"). The photo
// covers the first screen and fades into the page colour; how strongly it's
// darkened is set by --discuss-photo-* in index.css.
export default function DiscussPage() {
  return (
    // overflow-hidden + min height: the photo stays inside this page and never
    // runs behind the footer.
    <div className="discuss-over-photo relative overflow-hidden" style={{ minHeight: 'calc(100vh - 74px)' }}>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden"
        style={{ height: '100vh' }}
      >
        <img
          src={hero}
          alt=""
          className="w-full h-full"
          style={{ objectFit: 'cover', objectPosition: '55% 60%', filter: 'var(--discuss-photo-filter)' }}
        />
        <div className="absolute inset-0" style={{ background: 'var(--discuss-photo-overlay)' }} />
      </div>
      <div className="relative">
        <ProjectIntake />
      </div>
    </div>
  )
}
