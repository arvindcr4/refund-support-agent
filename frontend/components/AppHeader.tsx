import Link from "next/link";

export default function AppHeader({
  subtitle,
  active,
}: {
  subtitle?: string;
  active?: "console" | "admin";
}) {
  return (
    <header className="flex h-[3.25rem] items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-600 text-xs font-bold text-white">
          SW
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            ShopWell Refund Agent
          </h1>
          {subtitle && (
            <p className="text-[11px] leading-tight text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <nav className="flex items-center gap-1 text-xs">
        <Link
          href="/"
          className={`rounded-md px-2.5 py-1 transition ${
            active === "console"
              ? "bg-slate-800 text-slate-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Console
        </Link>
        <Link
          href="/admin"
          className={`rounded-md px-2.5 py-1 transition ${
            active === "admin"
              ? "bg-slate-800 text-slate-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Admin
        </Link>
      </nav>
    </header>
  );
}
