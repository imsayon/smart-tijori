import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[#dcd6c9] bg-[#f3eee5] px-6 py-5 text-sm text-[#152a21]">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3">
        <span className="font-semibold">SmartTijori</span>
        <Link href="/ops" className="underline underline-offset-4">Merchant workspace</Link>
      </div>
    </footer>
  );
}
