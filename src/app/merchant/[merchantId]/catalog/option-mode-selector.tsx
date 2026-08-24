import {
  getOptionModePresentation,
  OPTION_MODE_PRESENTATIONS,
} from "@/lib/option-mode-presentation";

const MERCHANT_MODE_COPY: Record<
  string,
  { label: string; description: string }
> = {
  SINGLE: {
    label: "Elegir una",
    description: "El cliente selecciona una alternativa.",
  },
  MULTIPLE: {
    label: "Permitir varias",
    description: "El cliente puede sumar varias opciones.",
  },
  QUANTITY: {
    label: "Combinar unidades",
    description: "El cliente arma una cantidad con distintas variedades.",
  },
};

export function getMerchantOptionModeCopy(mode: string): {
  label: string;
  description: string;
} {
  return MERCHANT_MODE_COPY[mode] ?? MERCHANT_MODE_COPY.SINGLE!;
}

type OptionModeSelectorProps = {
  name?: string;
  defaultMode: string;
  fieldIdPrefix: string;
};

export function QuantityModePreview() {
  return (
    <details className="merchant-workspace-example mt-1.5">
      <summary className="cursor-pointer text-xs font-semibold text-[#6d28d9]">
        Ver ejemplo
      </summary>
      <div className="mt-2 rounded-xl border border-[#e4dcf7] bg-[#faf8ff] p-3 text-xs text-[#5b5470]">
        <p className="font-medium text-[#0e0820]">
          Ejemplo: docena de empanadas
        </p>
        <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed">
          {`Carne             4\nJamón y queso     3\nVerdura           5\nTotal            12`}
        </pre>
      </div>
    </details>
  );
}

export function OptionModeSelector({
  name = "selectionMode",
  defaultMode,
  fieldIdPrefix,
}: OptionModeSelectorProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-[#3f3a55]">
        ¿Cómo puede elegir el cliente?
      </legend>
      <div className="merchant-workspace-mode-grid">
        {OPTION_MODE_PRESENTATIONS.map((mode) => {
          const inputId = `${fieldIdPrefix}-${mode.internalMode}`;
          const copy = getMerchantOptionModeCopy(mode.internalMode);
          return (
            <label
              key={mode.internalMode}
              htmlFor={inputId}
              className="merchant-workspace-mode-choice"
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={mode.internalMode}
                defaultChecked={defaultMode === mode.internalMode}
                className="sr-only"
              />
              <span className="merchant-workspace-mode-choice-body">
                <span className="merchant-workspace-mode-choice-title">
                  {copy.label}
                </span>
                <span className="merchant-workspace-mode-choice-copy">
                  {copy.description}
                </span>
                <span className="merchant-workspace-mode-choice-selected">
                  Seleccionado
                </span>
                {mode.internalMode === "QUANTITY" ? (
                  <QuantityModePreview />
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OptionModeSummary({ mode }: { mode: string }) {
  const copy = getMerchantOptionModeCopy(mode);
  getOptionModePresentation(mode);
  return <span className="merchant-workspace-mode-badge">{copy.label}</span>;
}
