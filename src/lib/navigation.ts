export type NavItem = {
  label: string;
  href: string;
  icon: string;
  children?: { label: string; href: string }[];
};
const department = (
  label: string,
  slug: string,
  icon: string,
  children: string[],
): NavItem => ({
  label,
  href: `/modules/${slug}/overview`,
  icon,
  children: children.map((label) => ({
    label,
    href: `/modules/${slug}/${label.toLowerCase().replaceAll(" ", "-")}`,
  })),
});
export const navigation: { label: string; items: NavItem[] }[] = [
  {
    label: "Home",
    items: [
      { label: "Dashboard", href: "/", icon: "home" },
      { label: "Accounts & Contacts", href: "/directory", icon: "accounts" },
    ],
  },
  {
    label: "Justech",
    items: [
      department("Sales", "justech-sales", "sales", [
        "Overview",
        "Opportunities",
        "Quotations",
        "Subscriptions",
        "Renewals",
      ]),
      department("Marketing", "justech-marketing", "marketing", [
        "Overview",
        "Campaigns",
        "Content Calendar",
        "Marketing Assets",
      ]),
      {
        label: "Operations",
        href: "/modules/justech-operations/overview",
        icon: "operations",
        children: [
          { label: "Overview", href: "/modules/justech-operations/overview" },
          { label: "Tasks", href: "/modules/justech-operations/tasks" },
          {
            label: "Projects & Delivery",
            href: "/modules/justech-operations/projects-delivery",
          },
          {
            label: "Quality Control",
            href: "/modules/justech-operations/quality-control",
          },
          {
            label: "Follow-ups",
            href: "/modules/justech-operations/follow-ups",
          },
        ],
      },
      department("Training", "justech-training", "training", [
        "Overview",
        "Training Sessions",
        "Registrations",
        "Training History",
      ]),
    ],
  },
  {
    label: "Al-Fikr",
    items: [
      department("Sales", "alfikr-sales", "sales", [
        "Overview",
        "Opportunities",
        "Quotations",
        "Subscriptions",
      ]),
      department("Marketing", "alfikr-marketing", "marketing", [
        "Overview",
        "Campaigns",
        "Content Calendar",
      ]),
      department("Content Management", "alfikr-content", "content", [
        "Overview",
        "Content Catalog",
        "Content Workflow",
      ]),
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        label: "Team Priorities",
        href: "/modules/workspace/priorities",
        icon: "priorities",
      },
      {
        label: "IT & Platform Management",
        href: "/modules/workspace/platform",
        icon: "platform",
      },
      {
        label: "Conferences & Events",
        href: "/modules/workspace/events",
        icon: "events",
      },
    ],
  },
];
export const bottomNavigation: NavItem[] = [
  { label: "Team Management", href: "/team", icon: "team" },
  { label: "Settings", href: "/settings", icon: "settings" },
  { label: "My Profile", href: "/profile", icon: "profile" },
];
export const allPages = [
  ...navigation.flatMap((s) =>
    s.items.flatMap((i) => i.children ?? [{ label: i.label, href: i.href }]),
  ),
  ...bottomNavigation,
];
export function pageTitle(path: string) {
  if (path.startsWith("/directory/")) return "Accounts & Contacts";
  return allPages.find((i) => i.href === path)?.label ?? "Workspace";
}
export function activeDepartment(path: string) {
  return (
    navigation
      .flatMap((s) => s.items)
      .find((i) => i.children?.some((c) => c.href === path))?.href ?? null
  );
}
export function safeReturnPath(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/";
}
