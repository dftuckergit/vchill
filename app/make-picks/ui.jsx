"use client";

import { useState } from "react";

export default function MakePicksClient() {
  /** Digits only, max length 6 — never silently keep a 7th digit for submit/navigation. */
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = value.length === 6;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="w-full max-w-md text-center">
        <h1 className="text-[32px] leading-[1.0] font-black text-[#163a59]">
          Make picks
        </h1>
        <p className="mt-4 text-[16px] leading-[1.2] text-zinc-800">
          Enter your 6-digit pick page ID to go to your picks page.
        </p>

        <form
          className="mt-10 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!isValid || submitting) return;
            setError("");
            setSubmitting(true);
            try {
              const res = await fetch(
                `/api/check-pick-page?pick_page_id=${encodeURIComponent(value)}`
              );
              const json = await res.json().catch(() => ({}));
              if (!res.ok) {
                if (res.status === 404) {
                  setError(
                    "That pick code wasn't found. Double-check the code and try again."
                  );
                } else {
                  setError(
                    typeof json?.error === "string"
                      ? json.error
                      : "Something went wrong. Please try again."
                  );
                }
                return;
              }
              if (!json?.ok) {
                setError("Something went wrong. Please try again.");
                return;
              }
              window.location.href = `/picks/${value}`;
            } catch {
              setError(
                "Couldn't verify the code. Check your connection and try again."
              );
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <input
            className="rounded-md border border-zinc-300 px-4 py-3 text-center text-lg tracking-widest"
            inputMode="numeric"
            maxLength={6}
            placeholder="your pick code here"
            value={value}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setValue(digits);
              setError("");
            }}
            autoComplete="one-time-code"
          />
          <button
            className="rounded-md bg-[#163a59] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            type="submit"
            disabled={!isValid || submitting}
          >
            {submitting ? "Checking…" : "Go to picks"}
          </button>
          {error ? (
            <p className="text-left text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}

