"use client";

import { useId, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Icon } from "./icon";

export function LogoutButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = useId();
  const description = useId();
  return (
    <>
      <button
        ref={trigger}
        className="signout"
        title="Sign out"
        aria-label="Sign out"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        <Icon name="logout" size={16} /> Sign out
      </button>
      <dialog
        ref={dialog}
        className="logout-dialog"
        aria-labelledby={title}
        aria-describedby={description}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onClose={() => trigger.current?.focus()}
      >
        <span className="logout-dialog-icon">
          <Icon name="logout" size={27} />
        </span>
        <h2 id={title}>Sign out of EduTrack?</h2>
        <p id={description}>
          You will return to the home page. You can sign in again whenever you
          need to.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="logout-dialog-actions">
          <button
            className="btn secondary"
            autoFocus
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await signOut({ callbackUrl: "/" });
              } catch {
                setError("Could not sign out. Please try again.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </dialog>
    </>
  );
}
