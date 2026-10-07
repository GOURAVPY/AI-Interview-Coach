export default function ComingSoon({ title }: { title: string }) {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 16px' }}>
      <span className="cap">{title}</span>
      <h1 style={{ fontWeight: 400, fontSize: 40, letterSpacing: '-0.045em', marginTop: 8 }}>Coming soon.</h1>
    </main>
  );
}
