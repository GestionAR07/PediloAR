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
      className="merchant-workspace-primary-btn w-fit disabled:opacity-60"
    >
      {label}
    </button>
  );
}
