"use client";

import { useMemo, useState } from "react";

export default function MakePicksClient() {
  const [value, setValue] = useState("");
  const cleaned = useMemo(() => value.replace(/\D/g, "").slice(0, 6), [value]);
  const isValid = cleaned.length === 6;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="w-full max-w-md text-center">
        <h1 className="text-[32px] leading-[1.0] font-bold text-[#163a59]">
          Make picks
        </h1>
        <p className="mt-4 text-[16px] leading-[1.2] text-zinc-800">
          Enter your 6-digit pick page ID to go to your picks page.
        </p>

        <form
          className="mt-10 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValid) return;
            window.location.href = `/picks/${cleaned}`;
          }}
        >
          <input
            className="rounded-md border border-zinc-300 px-4 py-3 text-center text-lg tracking-widest"
            inputMode="numeric"
            placeholder="123456"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            className="rounded-md bg-[#163a59] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            type="submit"
            disabled={!isValid}
          >
            Go to picks
          </button>
        </form>
      </div>
    </main>
  );
}

