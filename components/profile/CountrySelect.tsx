"use client";

/**
 * Searchable country select: a text input filters the static ISO list; each
 * option is a real <button> (design-system rule — no clickable divs) with a
 * flag emoji derived from the code. Fully client-side, SSR-deterministic.
 */
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { COUNTRIES, countryName, flagEmoji } from "@/lib/profile/countries";

const MAX_RESULTS = 8;

export function CountrySelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("profile.country");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, MAX_RESULTS);
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    ).slice(0, MAX_RESULTS);
  }, [query]);

  return (
    <div className="relative flex flex-col gap-1">
      <label
        htmlFor={`${listId}-input`}
        className="font-mono text-xs uppercase tracking-widest text-muted"
      >
        {t("label")}
      </label>
      {value && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="flex items-center gap-2 rounded-xl border border-line bg-night-3/60 px-4 py-3 text-left text-sm text-ink disabled:opacity-40"
        >
          <span aria-hidden>{flagEmoji(value)}</span>
          <span>{countryName(value)}</span>
          <span className="ml-auto font-mono text-xs text-muted-2">{t("change")}</span>
        </button>
      ) : (
        <>
          <input
            id={`${listId}-input`}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={t("searchPlaceholder")}
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="rounded-xl border border-line bg-night-3/60 px-4 py-3 text-sm text-ink placeholder:text-muted-2 focus:border-glow-2 focus:outline-none disabled:opacity-40"
          />
          {open && (
            <ul
              id={listId}
              role="listbox"
              aria-label={t("listLabel")}
              className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-night-2 shadow-xl"
            >
              {results.length === 0 && (
                <li className="px-4 py-2 font-mono text-xs text-muted-2">
                  {t("noMatches")}
                </li>
              )}
              {results.map((c) => (
                <li key={c.code} role="option" aria-selected={c.code === value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.code);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-night-3"
                  >
                    <span aria-hidden>{flagEmoji(c.code)}</span>
                    <span>{c.name}</span>
                    <span className="ml-auto font-mono text-xs text-muted-2">
                      {c.code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
