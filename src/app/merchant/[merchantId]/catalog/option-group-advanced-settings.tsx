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
    <details className="rounded-xl border border-[#d4e8f3] bg-[#f4f8fb] p-3 text-sm">
      <summary className="cursor-pointer font-medium text-[#083F66]">
        Configuración avanzada
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="text-xs text-[#4a6b82] sm:col-span-2">
          {getAdvancedBoundsHint(mode)}
        </p>
        <label className="merchant-workspace-field">
          <span>Mínimo</span>
          <input
            name="minSelections"
            type="number"
            min={0}
            defaultValue={minSelections}
            className="merchant-workspace-input"
          />
        </label>
        <label className="merchant-workspace-field">
          <span>Máximo</span>
          <input
            name="maxSelections"
            type="number"
            min={0}
            defaultValue={maxSelections}
            className="merchant-workspace-input"
          />
        </label>
      </div>
    </details>
  );
}
