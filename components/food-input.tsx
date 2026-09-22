"use client";

import { useId, useRef, useState } from "react";
import { suggestFoods } from "@/lib/foods";
import { PlusIcon } from "./icons";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  label: string;
  /** Color de los chips: naranja (evitar) o verde (tengo). */
  tone?: "brand" | "olive";
  /** Solo el campo, sin los chips (para pintarlos aparte). */
  hideChips?: boolean;
};

/**
 * Campo de alimentos con autocompletar: sugiere entre lo que conocemos, admite texto libre
 * y muestra lo elegido como chips con una X para quitarlo.
 */
export function FoodInput({ value, onChange, suggestions, placeholder = "Añadir alimento", label, tone = "brand", hideChips }: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const options = suggestFoods(text, suggestions, value);
  const exact = options.some((o) => o === text.trim().toLowerCase());
  const canAddFree = text.trim().length >= 2 && !exact;
  const rows = canAddFree ? [...options, `__free__${text.trim().toLowerCase()}`] : options;

  function add(food: string) {
    const f = food.trim().toLowerCase();
    if (!f || value.includes(f)) return reset();
    onChange([...value, f]);
    reset();
  }
  function reset() {
    setText("");
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  }
  function remove(food: string) {
    onChange(value.filter((v) => v !== food));
  }

  const chipCls = tone === "olive" ? "border-olive bg-olive-soft text-olive-dark" : "border-brand/40 bg-brand-soft text-brand-dark";

  return (
    <div>
      {!hideChips && value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {value.map((v) => (
            <li key={v} className={`inline-flex items-center gap-1.5 rounded-xl border py-1.5 pl-3 pr-1.5 text-sm font-medium capitalize ${chipCls}`}>
              {v}
              <button
                type="button"
                aria-label={`Quitar ${v}`}
                onClick={() => remove(v)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-base leading-none hover:bg-white/70"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-cream-dark bg-white px-3 focus-within:border-brand">
          <PlusIcon className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={text}
            aria-label={label}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && rows.length > 0}
            aria-controls={listId}
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(rows.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const r = rows[active];
                if (r) add(r.replace("__free__", ""));
                else if (text.trim()) add(text);
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Backspace" && !text && value.length > 0 && !hideChips) {
                remove(value[value.length - 1]);
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </div>
        {open && rows.length > 0 && (
          <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-cream-dark bg-white py-1 shadow-lg">
            {rows.map((r, i) => {
              const free = r.startsWith("__free__");
              const food = r.replace("__free__", "");
              return (
                <li key={r} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(food)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm capitalize ${i === active ? "bg-cream" : ""}`}
                  >
                    <span>{food}</span>
                    {free && <span className="text-xs normal-case text-muted">Añadir tal cual</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
