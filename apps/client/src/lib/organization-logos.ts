import {
  Boxes,
  Briefcase,
  Building2,
  Globe,
  GraduationCap,
  HeartPulse,
  Landmark,
  Leaf,
  type LucideIcon,
  Palette,
  Rocket,
} from "lucide-react";

/** Stored in `organization.logo`; the key is the icon name. */
export const organizationLogos = {
  building: Building2,
  rocket: Rocket,
  briefcase: Briefcase,
  graduation: GraduationCap,
  health: HeartPulse,
  leaf: Leaf,
  palette: Palette,
  globe: Globe,
  boxes: Boxes,
  landmark: Landmark,
} satisfies Record<string, LucideIcon>;

export type OrganizationLogoName = keyof typeof organizationLogos;

export const organizationLogoOptions = Object.entries(organizationLogos).map(
  ([name, Icon]) => ({
    name: name as OrganizationLogoName,
    label: name.charAt(0).toUpperCase() + name.slice(1),
    Icon,
  }),
);

export function getOrganizationLogo(name?: string | null): LucideIcon {
  return organizationLogos[name as OrganizationLogoName] ?? Building2;
}
