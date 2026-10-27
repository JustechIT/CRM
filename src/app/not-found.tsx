import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <div className="eyebrow">404 · Page not found</div>
      <h1>Let’s get you back on track.</h1>
      <p>This page is not part of your workspace.</p>
      <Link href="/" className="button primary">
        Return to dashboard
      </Link>
    </main>
  );
}
