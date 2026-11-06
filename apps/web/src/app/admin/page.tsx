import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="detail-page admin-page">
      <p className="eyebrow">REEL. OPERATIONS</p>
      <h1>Admin shell<span className="accent-dot">.</span></h1>
      <p className="detail-synopsis">A scoped starting point for the future cinema operations console.</p>
      <div className="admin-notice">
        <span aria-hidden="true">⌁</span>
        <div><h2>Protected admin access is not connected</h2><p>This shell intentionally exposes no administrative data or actions. Phase 3 must add authenticated staff roles, authorization, audit logging, and backend management endpoints before this route is enabled for operators.</p><Link className="text-link" href="/">Return to customer experience <span aria-hidden="true">→</span></Link></div>
      </div>
    </main>
  );
}
