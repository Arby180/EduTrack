"use client";
import { useEffect, useState } from "react";
import styles from "../landing.module.css";
const sections = ["home", "features", "about", "contact"] as const;
export function LandingNavigation() {
  const [active, setActive] = useState("home");
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
    <nav className={styles.navigation} aria-label="Website navigation">
      {sections.map((id) => (
        <a
          key={id}
          href={`#${id}`}
          className={active === id ? styles.active : undefined}
          aria-current={active === id ? "location" : undefined}
        >
          {id[0]!.toUpperCase() + id.slice(1)}
        </a>
      ))}
    </nav>
  );
}
