import { getAdvancedBoundsHint } from "@/lib/option-mode-presentation";

type OptionGroupAdvancedSettingsProps = {
  mode: string;
  minSelections: number;
  maxSelections: number;
};

export function OptionGroupAdvancedSettings({
  mode,
  minSelections,
  maxSelections,
}: OptionGroupAdvancedSettingsProps) {
  return (
    <details className="rounded-md border border-border bg-white/50 p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Configuración avanzada
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="text-xs text-muted sm:col-span-2">
          {getAdvancedBoundsHint(mode)}
        </p>
        <label className="flex flex-col gap-1">
          <span>Mínimo</span>
          <input
            name="minSelections"
            type="number"
            min={0}
            defaultValue={minSelections}
            className="rounded-md border border-border bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Máximo</span>
          <input
            name="maxSelections"
            type="number"
            min={0}
            defaultValue={maxSelections}
            className="rounded-md border border-border bg-white px-3 py-2"
          />
        </label>
      </div>
    </details>
  );
}
