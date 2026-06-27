import {
  Activity,
  Boxes,
  BriefcaseBusiness,
  FileUp,
  ListChecks,
  Network,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navigationItems: NavItem[] = [
  { href: "/", label: "Home", icon: FileUp },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/parser-registry", label: "Parser Registry", icon: Network },
  { href: "/skills-registry", label: "Skills Registry", icon: ShieldCheck },
  { href: "/review-queue", label: "Review Queue", icon: ListChecks },
  { href: "/assets", label: "Asset Viewer", icon: Boxes },
  { href: "/observability", label: "Observability", icon: Activity },
];
