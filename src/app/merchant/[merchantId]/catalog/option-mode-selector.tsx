import {
  getOptionModePresentation,
  OPTION_MODE_PRESENTATIONS,
} from "@/lib/option-mode-presentation";

type OptionModeSelectorProps = {
  name?: string;
  defaultMode: string;
  fieldIdPrefix: string;
};

export function QuantityModePreview() {
  return (
    <div className="mt-2 rounded-md border border-border/70 bg-white/80 p-3 text-xs text-muted">
      <p className="font-medium text-foreground">
        Ejemplo: docena de empanadas
      </p>
      <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed">
        {`Carne             4\nJamón y queso     3\nVerdura           5\nTotal            12`}
      </pre>
      <p className="mt-2">
        Usalo cuando el cliente deba indicar cuántas unidades quiere de cada
        variedad.
      </p>
    </div>
  );
}

export function OptionModeSelector({
  name = "selectionMode",
  defaultMode,
  fieldIdPrefix,
}: OptionModeSelectorProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">¿Cómo elige el cliente?</legend>
      <div className="grid gap-3">
        {OPTION_MODE_PRESENTATIONS.map((mode) => {
          const inputId = `${fieldIdPrefix}-${mode.internalMode}`;
          return (
            <label
              key={mode.internalMode}
              htmlFor={inputId}
              className="flex cursor-pointer gap-3 rounded-lg border border-border bg-white p-4 has-[:checked]:border-accent has-[:checked]:bg-accent/5"
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={mode.internalMode}
                defaultChecked={defaultMode === mode.internalMode}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
              />
              <div className="min-w-0 space-y-1">
                <span className="block text-sm font-medium">{mode.label}</span>
                <p className="text-sm text-muted">{mode.description}</p>
                <p className="text-xs text-muted">Ej.: {mode.examples}</p>
                {mode.internalMode === "QUANTITY" ? (
                  <QuantityModePreview />
                ) : null}
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OptionModeSummary({ mode }: { mode: string }) {
  const presentation = getOptionModePresentation(mode);
  return (
    <div className="rounded-md bg-white/50 px-3 py-2 text-sm">
      <p className="font-medium">{presentation.label}</p>
      <p className="text-muted">{presentation.description}</p>
    </div>
  );
}
