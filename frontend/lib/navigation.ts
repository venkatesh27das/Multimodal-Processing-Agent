import {
  Activity,
  Boxes,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  Home,
  ListChecks,
  Network,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: "main" | "admin";
};

export const navigationItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, section: "main" },
  { href: "/parse", label: "Parse", icon: ClipboardCheck, section: "main" },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness, section: "main" },
  { href: "/review-queue", label: "Review Queue", icon: ListChecks, section: "main" },
  { href: "/assets", label: "Assets", icon: Boxes, section: "main" },
  { href: "/observability", label: "Observability", icon: Activity, section: "main" },
  { href: "/parsers", label: "Parsers", icon: Network, section: "admin" },
  { href: "/skills", label: "Skills", icon: ShieldCheck, section: "admin" },
  { href: "/settings", label: "Settings", icon: Settings, section: "admin" },
];

export function titleForPath(pathname: string) {
  if (pathname === "/home") return "Home";
  if (pathname.startsWith("/create-run")) return "Parse";
  if (pathname.startsWith("/run-monitor")) return "Jobs";
  if (pathname.startsWith("/jobs/")) return "Job Detail";
  const active =
    navigationItems.find((item) =>
      isActivePath(pathname, item.href),
    ) ?? navigationItems[0];
  return active.label;
}

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}
