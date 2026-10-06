"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { useState } from "react";
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
  return (
    <div className="app-frame">
      <aside className="sidebar">
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
      </div>
    </div>
  );
}
