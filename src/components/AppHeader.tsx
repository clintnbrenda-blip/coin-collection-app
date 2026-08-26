import Image from "next/image";
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
  activeTab?: "dashboard" | "collection" | "deposits";
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/icon-mark-96.png"
              alt=""
              width={36}
              height={36}
              className="shrink-0"
            />
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
              <p className="text-xs text-neutral-500">{fullName}</p>
            </div>
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

        {role && (
          <nav className="mt-3 flex flex-wrap gap-1.5">
            {role === "owner" && (
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
            )}
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
            <Link
              href="/deposits"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === "deposits"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              Deposits
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
