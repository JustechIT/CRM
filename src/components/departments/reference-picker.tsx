"use client";
import { useEffect, useId, useState } from "react";
import { Search, Check, ChevronLeft, ChevronRight } from "lucide-react";
type Item = { id: string; name: string };
export function ReferencePicker({
  name,
  label,
  entity,
  initialId = "",
  initialLabel = "",
  department,
  purpose,
  required = true,
  disabled,
}: {
  name: string;
  label: string;
  entity: import("@/lib/departments/types").Reference;
  initialId?: string;
  initialLabel?: string;
  department: import("@/lib/departments/types").ModuleScope;
  purpose?: string;
  required?: boolean;
  disabled: boolean;
}) {
  const generatedId = useId();
  const listId = `lookup-${generatedId}`;
  const [input, setInput] = useState(initialLabel);
  const [selected, setSelected] = useState(initialId);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");
  const [index, setIndex] = useState(-1);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!open || disabled) return;
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      setMessage("Loading…");
      const params = new URLSearchParams({
        entity,
        department,
        q: selected ? "" : input,
        page: String(page),
      });
      if (purpose) params.set("purpose", purpose);
      try {
        const response = await fetch(`/api/departments/lookups?${params}`, {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("Could not load choices. Try again.");
        const data = await response.json();
        setItems(data.items);
        setMore(data.hasMore);
        setIndex(-1);
        setMessage(
          data.items.length
            ? ""
            : "No matching records. Check your search or add the referenced record first.",
        );
      } catch (e) {
        if (!abort.signal.aborted)
          setMessage(
            e instanceof Error ? e.message : "Could not load choices.",
          );
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [input, entity, department, purpose, open, selected, disabled, page]);
  function choose(item: Item) {
    setSelected(item.id);
    setInput(item.name);
    setOpen(false);
    setIndex(-1);
  }
  return (
    <div
      className="sales-lookup"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={listId + "-input"}>
        {label}
        {required ? " *" : ""}
      </label>
      <input type="hidden" name={name} value={selected} />
      <input
        type="hidden"
        name={name + "_label"}
        value={selected ? input : ""}
      />
      <div className="sales-lookup-input">
        <Search size={15} />
        <input
          id={listId + "-input"}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={index >= 0 ? `${listId}-${index}` : undefined}
          autoComplete="off"
          disabled={disabled}
          required={required}
          value={input}
          placeholder={`Search ${entity === "accounts" ? "institutions" : entity}…`}
          onFocus={() => {
            setOpen(true);
            setPage(1);
          }}
          onChange={(e) => {
            setInput(e.target.value);
            setSelected("");
            setOpen(true);
            setPage(1);
            setItems([]);
            setIndex(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setIndex((v) => Math.min(v + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((v) => Math.max(v - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (items[index]) choose(items[index]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {selected && <Check size={15} aria-label="Selected" />}
      </div>
      {open && !disabled && (
        <div className="sales-lookup-menu">
          <div id={listId} role="listbox" aria-label={`${label} choices`}>
            {items.map((item, i) => (
              <button
                type="button"
                role="option"
                aria-selected={selected === item.id}
                id={`${listId}-${i}`}
                key={item.id}
                className={i === index ? "highlighted" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
              >
                {item.name}
              </button>
            ))}
          </div>
          {message && <p role="status">{message}</p>}
          {(page > 1 || more) && (
            <div className="sales-lookup-pagination">
              <button
                type="button"
                className="icon-button"
                aria-label={`Previous ${entity}`}
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Next ${entity}`}
                disabled={!more}
                onClick={() => setPage((v) => v + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
