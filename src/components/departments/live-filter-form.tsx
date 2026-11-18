"use client";

import Form from "next/form";
import { useEffect, useRef, type ReactNode } from "react";

export function LiveFilterForm({
  action,
  label,
  children,
}: {
  action: string;
  label: string;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Form
      action={action}
      replace
      scroll={false}
      className="sales-filters"
      aria-label={label}
      onChange={(event) => {
        const control = event.target;
        if (
          !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement) ||
          !control.name
        ) return;

        const form = event.currentTarget;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => form.requestSubmit(), 350);
      }}
      onSubmit={() => clearTimeout(timer.current)}
    >
      {children}
    </Form>
  );
}
