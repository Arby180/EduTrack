"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
export function Shell({
  children,
  role,
  name,
}: {
  children: React.ReactNode;
  role: string;
  name?: string | null;
}) {
  const path = usePathname();
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => setMobileMenuOpen(false), [path]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);
  const icons: Record<string, string> = {
    Overview: "home",
    People: "people",
    "Classes & subjects": "book",
    Attendance: "calendar",
    Grades: "book",
    Reports: "chart",
    Announcements: "bell",
    Notifications: "mail",
  };
  const links = [
    [role === "admin" ? "/admin" : "/student", "Overview"],
    ...(role === "admin"
      ? [
          ["/students", "People"],
          ["/classes", "Classes & subjects"],
        ]
      : []),
    ["/attendance", "Attendance"],
    ["/grades", "Grades"],
    ["/reports", "Reports"],
    ["/announcements", "Announcements"],
    ["/notifications", "Notifications"],
  ];
  const overviewPath = role === "admin" ? "/admin" : "/student";
  const mobileLinks = [
    [overviewPath, "Home", "home"],
    ["/attendance", "Attendance", "calendar"],
    ["/grades", "Grades", "book"],
  ];
  return (
    <div className="app-frame">
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        id="mobile-main-navigation"
        className={mobileMenuOpen ? "sidebar mobile-open" : "sidebar"}
      >
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">
            <Icon size={27} />
          </span>
          EduTrack
          <span className="brand-dot">.</span>
        </Link>
        <p className="sidebar-label">
          {role === "admin" ? "SCHOOL WORKSPACE" : "MY WORKSPACE"}
        </p>
        <nav aria-label="Main navigation">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href!}
              className={path === href ? "nav-link active" : "nav-link"}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon name={icons[label!]} size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">{name?.charAt(0) ?? "E"}</span>
          <div>
            <strong>{name ?? "School account"}</strong>
            <small>{role}</small>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="workspace">
        <header className="mobile-header">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark">
              <Icon size={25} />
            </span>
            EduTrack
            <span className="brand-dot">.</span>
          </Link>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-main-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <Icon name={mobileMenuOpen ? "close" : "menu"} size={21} />
          </button>
        </header>
        <header className="topbar">
          <div className="workspace-search">
            <Icon name="search" size={16} />
            <input
              aria-label="Find a page"
              placeholder="Find a page..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <div className="search-results">
                {links
                  .filter(([, label]) =>
                    label!.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map(([href, label]) => (
                    <Link key={href} href={href!} onClick={() => setSearch("")}>
                      {label}
                      <Icon name="arrow" size={14} />
                    </Link>
                  ))}
                {!links.some(([, label]) =>
                  label!.toLowerCase().includes(search.toLowerCase()),
                ) && <p>No matching pages</p>}
              </div>
            )}
          </div>
          <div className="topbar-profile">
            <span className="avatar">{name?.charAt(0) ?? "E"}</span>
            <div>
              <strong>{name ?? "School account"}</strong>
              <small>{role === "admin" ? "Administrator" : "Student"}</small>
            </div>
          </div>
        </header>
        <main className="workspace-main">{children}</main>
        <footer className="workspace-footer">
          <span className="footer-brand">
            <Icon size={18} /> EduTrack
          </span>
          <span>A clearer picture of every school day.</span>
        </footer>
        <nav className="mobile-bottom-nav" aria-label="Quick navigation">
          {mobileLinks.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href!}
              className={
                path === href ||
                (href === overviewPath && path === "/dashboard")
                  ? "mobile-bottom-link active"
                  : "mobile-bottom-link"
              }
              aria-current={path === href ? "page" : undefined}
            >
              <Icon name={icon} size={19} />
              <span>{label}</span>
            </Link>
          ))}
          <button
            type="button"
            className={
              mobileMenuOpen ||
              (!mobileLinks.some(([href]) => href === path) &&
                path !== "/dashboard")
                ? "mobile-bottom-link active"
                : "mobile-bottom-link"
            }
            aria-label={mobileMenuOpen ? "Close more menu" : "Open more menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-main-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <Icon name="more" size={19} />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
