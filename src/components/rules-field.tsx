"use client";

import { Field, Textarea } from "./ui";

export function RulesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label="What can it share, and with whom?"
      hint="The agent reads these rules in every conversation. You can change them later in its settings."
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={2000}
        rows={4}
      />
    </Field>
  );
}
