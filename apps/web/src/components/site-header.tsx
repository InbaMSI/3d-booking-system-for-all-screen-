import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link aria-label="Reel home" className="brand" href="/">
        <span aria-hidden="true" className="brand-mark">R</span>
        <span>reel<span className="brand-dot">.</span></span>
      </Link>
      <nav aria-label="Main navigation" className="main-nav">
        <Link href="/">Films</Link>
        <Link href="/cinemas">Cinemas</Link>
        <Link href="/account/bookings">My bookings</Link>
      </nav>
      <Link className="location-pill" href="/cinemas">
        <span aria-hidden="true">⌖</span> Chennai
      </Link>
    </header>
  );
}
