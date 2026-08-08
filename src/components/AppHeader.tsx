import { signOut } from "@/app/actions";

export function AppHeader({
  title,
  fullName,
}: {
  title: string;
  fullName: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
          <p className="text-xs text-neutral-500">{fullName}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
