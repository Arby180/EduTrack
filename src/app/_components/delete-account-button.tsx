"use client";
import { useId, useRef, useState } from "react";
import { api } from "~/trpc/react";

export function DeleteAccountButton({
  id,
  name,
  onDeleted,
}: {
  id: string;
  name: string;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useId();
  const description = useId();
  const [error, setError] = useState("");
  const mutation = api.admin.deleteUser.useMutation();
  const utils = api.useUtils();
  return (
    <>
      <button
        ref={trigger}
        className="btn secondary"
        style={{ color: "#b42318" }}
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        Delete
      </button>
      <dialog
        ref={dialog}
        className="logout-dialog"
        aria-labelledby={title}
        aria-describedby={description}
        onCancel={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id={title}>Delete {name}?</h2>
        <p id={description}>
          This permanently deletes this account, its student profile, grades,
          attendance, notifications and sign-in links. This cannot be undone.
          Using the same Google account again will require email confirmation
          and admin approval as a new registration.
          Other students&apos; records are retained. Required staff references on
          records created by this account transfer to you.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="logout-dialog-actions">
          <button
            autoFocus
            className="btn secondary"
            disabled={mutation.isPending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className="btn"
            style={{ background: "#b42318" }}
            disabled={mutation.isPending}
            onClick={async () => {
              try {
                await mutation.mutateAsync({ id });
                dialog.current?.close();
                onDeleted();
                await utils.invalidate();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not delete account.",
                );
              }
            }}
          >
            {mutation.isPending ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </dialog>
    </>
  );
}
