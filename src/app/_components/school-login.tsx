"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LoginForm } from "./login-form";
import { Icon } from "./icon";
import styles from "../landing.module.css";

export function SchoolLogin({
  children,
  googleEnabled,
}: {
  children: ReactNode;
  googleEnabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const title = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  function close() {
    dialog.current?.close();
  }
  return (
    <>
      <button
        ref={trigger}
        disabled={!ready}
        type="button"
        className={styles.schoolLogin}
        onClick={() => setOpen(true)}
      >
        {" "}
        {children}{" "}
      </button>
      <dialog
        ref={dialog}
        className={styles.loginDialog}
        aria-labelledby={title}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            close();
        }}
      >
        {open && (
          <div className={styles.modalContent}>
            <button
              type="button"
              className={styles.modalClose}
              aria-label="Close login"
              onClick={close}
              autoFocus
            >
              &times;
            </button>
            <div className={styles.brand}>
              <Icon size={32} />
              <span>EduTrack</span>
            </div>
            <p className={styles.sectionLabel}>YOUR SCHOOL, CONNECTED</p>
            <h2 id={title}>Welcome back.</h2>
            <p className={styles.modalSubtitle}>
              Sign in to your school workspace.
            </p>
            <LoginForm googleEnabled={googleEnabled} />
          </div>
        )}
      </dialog>
    </>
  );
}
