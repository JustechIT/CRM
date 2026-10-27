"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Home,
  Building2,
  TrendingUp,
  Megaphone,
  Layers,
  GraduationCap,
  BookOpen,
  ListTodo,
  Monitor,
  CalendarDays,
  Users,
  Settings,
  UserRound,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  X,
  Menu,
  Pin,
  LogOut,
  ArrowUpRight,
  Command,
  Moon,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  navigation,
  bottomNavigation,
  allPages,
  pageTitle,
  activeDepartment,
} from "@/lib/navigation";
import { signOut } from "@/app/login/actions";
const icons: Record<string, LucideIcon> = {
  home: Home,
  accounts: Building2,
  sales: TrendingUp,
  marketing: Megaphone,
  operations: Layers,
  training: GraduationCap,
  content: BookOpen,
  priorities: ListTodo,
  platform: Monitor,
  events: CalendarDays,
  team: Users,
  settings: Settings,
  profile: UserRound,
};
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("preferences", callback);
  };
};
function usePreference(key: string, initial: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? initial;
      } catch {
        return initial;
      }
    },
    () => initial,
  );
  return [
    value,
    (next: string) => {
      try {
        localStorage.setItem(key, next);
        window.dispatchEvent(new Event("preferences"));
      } catch {
        /* Preferences remain optional. */
      }
    },
  ] as const;
}
export function Shell({
  children,
  name,
  preview,
}: {
  children: React.ReactNode;
  name: string;
  preview: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = usePreference(
    "justech.sidebar",
    "expanded",
  );
  const [pinsValue, setPins] = usePreference("justech.pins", "[]");
  const [theme, setTheme] = usePreference("justech.theme", "light");
  let pins: string[] = [];
  try {
    const raw: unknown = JSON.parse(pinsValue);
    if (Array.isArray(raw))
      pins = raw.filter(
        (v): v is string =>
          typeof v === "string" && allPages.some((p) => p.href === v),
      );
  } catch {}
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const department = expanded ?? activeDepartment(pathname);
  const isCollapsed = collapsed === "collapsed";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; label: string; type: string }[]
  >([]);
  const [searchState, setSearchState] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const mobileDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (mobile) mobileDialog.current?.showModal();
    else mobileDialog.current?.close();
  }, [mobile]);
  useEffect(() => {
    if (search) dialog.current?.showModal();
    else dialog.current?.close();
  }, [search]);
  useEffect(() => {
    if (!search || query.trim().length < 2) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setSearchState("Searching…");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: abort.signal,
        });
        if (!res.ok)
          throw new Error(
            "Search is unavailable. Check your connection and permissions.",
          );
        const data = await res.json();
        setResults(data.results);
        setSearchState(
          data.results.length ? "" : "No matching accounts or contacts.",
        );
      } catch (e) {
        if (!abort.signal.aborted)
          setSearchState(
            e instanceof Error ? e.message : "Search unavailable.",
          );
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, search]);
  function navigate() {
    setMobile(false);
    setExpanded(null);
    setProfile(false);
    setNotifications(false);
  }
  function togglePin() {
    setPins(
      JSON.stringify(
        pins.includes(pathname)
          ? pins.filter((p) => p !== pathname)
          : [...pins, pathname],
      ),
    );
  }
  const navContent = (
    <>
      <Link href="/" className="brand" onClick={navigate}>
        <span className="brand-symbol">
          j<span />
        </span>
        {!isCollapsed && (
          <span>
            justech<span className="brand-subtitle">WORKSPACE</span>
          </span>
        )}
      </Link>
      <div className="workspace-switch">
        {!isCollapsed ? (
          <>
            <span className="workspace-avatar">J</span>
            <span>
              <strong>Justech & Al-Fikr</strong>
              <small>Internal workspace</small>
            </span>
          </>
        ) : (
          <span className="workspace-avatar">J</span>
        )}
      </div>
      <nav aria-label="Main navigation" className="main-nav">
        {pins.length > 0 && (
          <div className="nav-group">
            <h2>{isCollapsed ? "·" : "Pinned"}</h2>
            {pins.map((href) => (
              <Link
                key={href}
                href={href}
                title={pageTitle(href)}
                className={`nav-item ${pathname === href ? "active" : ""}`}
                onClick={navigate}
              >
                <Pin size={17} />
                {!isCollapsed && <span>{pageTitle(href)}</span>}
              </Link>
            ))}
          </div>
        )}
        {navigation.map((section) => (
          <div className="nav-group" key={section.label}>
            <h2>{isCollapsed ? "·" : section.label}</h2>
            {section.items.map((item) => {
              const Icon = icons[item.icon];
              const active =
                pathname === item.href ||
                item.children?.some((c) => c.href === pathname);
              return (
                <div key={item.href}>
                  {item.children ? (
                    <button
                      className={`nav-item ${active ? "active" : ""}`}
                      title={item.label}
                      aria-expanded={department === item.href}
                      onClick={() => {
                        if (isCollapsed) setCollapsed("expanded");
                        setExpanded(department === item.href ? "" : item.href);
                      }}
                    >
                      <Icon size={18} />
                      {!isCollapsed && (
                        <>
                          <span>{item.label}</span>
                          <ChevronDown
                            size={14}
                            className={
                              department === item.href
                                ? "chevron open"
                                : "chevron"
                            }
                          />
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      title={item.label}
                      className={`nav-item ${active ? "active" : ""}`}
                      onClick={navigate}
                    >
                      <Icon size={18} />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>
                  )}
                  {item.children &&
                    department === item.href &&
                    !isCollapsed && (
                      <div className="subnav">
                        {item.children.map((c) => (
                          <Link
                            href={c.href}
                            key={c.href}
                            aria-current={
                              pathname === c.href ? "page" : undefined
                            }
                            className={pathname === c.href ? "selected" : ""}
                            onClick={navigate}
                          >
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <nav aria-label="Personal navigation" className="bottom-nav">
        {bottomNavigation.map((item) => {
          const Icon = icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
              onClick={navigate}
            >
              <Icon size={18} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
        <button
          className="nav-item collapse-control"
          onClick={() => setCollapsed(isCollapsed ? "expanded" : "collapsed")}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
          <span>{!isCollapsed && "Collapse sidebar"}</span>
        </button>
      </nav>
    </>
  );
  return (
    <div className={`app-shell ${isCollapsed ? "is-collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">{navContent}</aside>
      <dialog
        ref={mobileDialog}
        className="mobile-backdrop"
        aria-label="Mobile navigation"
        onCancel={() => setMobile(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMobile(false);
        }}
      >
        <aside className="mobile-sidebar">
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
          {navContent}
        </aside>
      </dialog>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => {
                setCollapsed("expanded");
                setMobile(true);
              }}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{pageTitle(pathname)}</strong>
          </div>
          <div className="topbar-actions">
            {allPages.some((p) => p.href === pathname) && (
              <button
                className="icon-button pin-control"
                aria-label={
                  pins.includes(pathname)
                    ? "Unpin current page"
                    : "Pin current page"
                }
                aria-pressed={pins.includes(pathname)}
                onClick={togglePin}
              >
                <Pin size={16} />
              </button>
            )}
            <button
              className="search-trigger"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Search workspace</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              aria-label={
                theme === "dark" ? "Use light theme" : "Use dark theme"
              }
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="popover-anchor">
              <button
                className="icon-button"
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => {
                  setNotifications(!notifications);
                  setProfile(false);
                }}
              >
                <Bell size={19} />
              </button>
              {notifications && (
                <div className="popover">
                  <strong>You’re all caught up</strong>
                  <p>
                    Notifications will appear here when connected modules
                    publish updates.
                  </p>
                  <button
                    className="text-link"
                    onClick={() => setNotifications(false)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
            <div className="header-divider" />
            <div className="popover-anchor">
              <button
                className="user-trigger"
                aria-expanded={profile}
                aria-label="Open profile menu"
                onClick={() => {
                  setProfile(!profile);
                  setNotifications(false);
                }}
              >
                <span className="avatar">
                  {preview ? "J" : name.slice(0, 1)}
                </span>
                <span className="user-name">
                  {name}
                  <small>
                    {preview ? "Setup preview" : "Employee workspace"}
                  </small>
                </span>
                <ChevronDown size={14} />
              </button>
              {profile && (
                <div className="popover">
                  <Link href="/profile" className="nav-item" onClick={navigate}>
                    <UserRound size={16} />
                    My profile
                  </Link>
                  {!preview && (
                    <form action={signOut}>
                      <button className="nav-item">
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </form>
                  )}
                  {preview && (
                    <p>Preview mode. No employee session is active.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="main-content">
          {children}
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setSearch(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSearch(false);
        }}
        aria-labelledby="search-title"
        className="search-dialog"
      >
        <div className="search-box">
          <Search size={20} />
          <label className="sr-only" id="search-title" htmlFor="global-search">
            Search accounts and contacts
          </label>
          <input
            id="global-search"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResults([]);
              setSearchState("");
            }}
            placeholder="Search accounts and contacts…"
          />
          <button
            className="icon-button"
            aria-label="Close search"
            onClick={() => setSearch(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="search-results" aria-live="polite">
          {preview ? (
            <p>
              Connect Supabase to search your authorized accounts and contacts.
            </p>
          ) : query.trim().length < 2 ? (
            <p>Type at least 2 characters to search your directory.</p>
          ) : (
            <>
              <p>{searchState}</p>
              {["accounts", "contacts"].map((type) => (
                <div key={type}>
                  {results.some((r) => r.type === type) && <h3>{type}</h3>}
                  {results
                    .filter((r) => r.type === type)
                    .map((r) => (
                      <Link
                        key={r.id}
                        href={`/directory/${type}/${r.id}`}
                        onClick={() => {
                          setSearch(false);
                          navigate();
                        }}
                      >
                        {r.label}
                        <ArrowUpRight size={15} />
                      </Link>
                    ))}
                </div>
              ))}
            </>
          )}
          <div className="search-shortcut">
            <Command size={14} /> K to open · Escape to close
          </div>
        </div>
      </dialog>
    </div>
  );
}
