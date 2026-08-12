"use client";

import { useFormStatus } from "react-dom";

type Props = {
  mode: "create" | "edit";
};

export function ProductFormSubmitButton({ mode }: Props) {
  const { pending } = useFormStatus();

  const label =
    mode === "create"
      ? pending
        ? "Creando..."
        : "Crear producto"
      : pending
        ? "Guardando..."
        : "Guardar cambios";

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-fit rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
    >
      {label}
    </button>
  );
}
