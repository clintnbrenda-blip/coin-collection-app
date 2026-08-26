import Link from "next/link";
import { signOut } from "@/app/actions";

export function AppHeader({
  title,
  fullName,
  role,
  activeTab,
}: {
  title: string;
  fullName: string;
  role?: "owner" | "employee";
  activeTab?: "dashboard" | "collection";
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
            <p className="text-xs text-neutral-500">{fullName}</p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/account"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Account
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {role === "owner" && (
          <nav className="mt-3 flex gap-1.5">
            <Link
              href="/dashboard"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === "dashboard"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/entry/new"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === "collection"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              Collection
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
