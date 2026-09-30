"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const LINKS = [
  { href: "/", label: "Get started" },
  { href: "/deploy", label: "Deploy" },
  { href: "/playground", label: "Playground" },
  { href: "/address", label: "Address" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cx(
            "rounded-md px-2.5 py-1",
            pathname === l.href ? "bg-panel-2 text-fg" : "text-muted hover:text-fg",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
