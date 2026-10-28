"use client";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import styles from "../landing.module.css";
const sections = ["home", "features", "about", "contact"] as const;
export function LandingNavigation() {
  const [active, setActive] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const update = () => {
      const offset =
        (document.querySelector("header")?.getBoundingClientRect().height ??
          100) + 45;
      let current = "home";
      for (const id of ["about", "features", "contact"]) {
        if (
          (document.getElementById(id)?.getBoundingClientRect().top ??
            Infinity) <= offset
        )
          current = id;
      }
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4)
        current = "contact";
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <>
      <button
        type="button"
        className={styles.mobileMenuButton}
        aria-label={
          menuOpen ? "Close website navigation" : "Open website navigation"
        }
        aria-expanded={menuOpen}
        aria-controls="website-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Icon name={menuOpen ? "close" : "menu"} size={20} />
      </button>
      <nav
        id="website-navigation"
        className={`${styles.navigation} ${
          menuOpen ? styles.navigationOpen : ""
        }`}
        aria-label="Website navigation"
      >
        {sections.map((id) => (
          <a
            key={id}
            href={`#${id}`}
            className={active === id ? styles.active : undefined}
            aria-current={active === id ? "location" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {id[0]!.toUpperCase() + id.slice(1)}
          </a>
        ))}
      </nav>
    </>
  );
}
