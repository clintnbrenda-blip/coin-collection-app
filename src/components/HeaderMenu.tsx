"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions";

// Consolidates everything that used to be scattered across the header
// (Account, Sign out) and the dashboard body (Manage machine groups,
// Manage employees) into one hamburger menu, top-right.
export function HeaderMenu({ role }: { role?: "owner" | "employee" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {role === "owner" && (
            <>
              <Link
                href="/dashboard/machine-groups"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Manage machine groups
              </Link>
              <Link
                href="/dashboard/employees"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Manage employees
              </Link>
              <div className="my-1 border-t border-neutral-100" />
            </>
          )}
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Account
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
