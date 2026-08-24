"use client";

import { useState } from "react";

type Props = {
  stockModeDefault?: string;
  stockQuantityDefault?: string | number;
};

export function ProductStockControl({
  stockModeDefault = "NOT_TRACKED",
  stockQuantityDefault = "",
}: Props) {
  const [tracked, setTracked] = useState(stockModeDefault === "TRACKED");

  return (
    <div className="merchant-workspace-stock-block">
      <label className="merchant-workspace-field">
        <span>Stock</span>
        <select
          name="stockMode"
          defaultValue={stockModeDefault}
          className="merchant-workspace-input"
          onChange={(event) => {
            setTracked(event.currentTarget.value === "TRACKED");
          }}
        >
          <option value="NOT_TRACKED">No controlar stock</option>
          <option value="TRACKED">Controlar unidades disponibles</option>
        </select>
      </label>

      <div
        className="merchant-workspace-stock-tracked-fields"
        hidden={!tracked}
        aria-hidden={!tracked}
      >
        <p className="merchant-workspace-field-help">
          Pedilo dejará de ofrecerlo cuando no queden unidades.
        </p>
        <label className="merchant-workspace-field">
          <span>Cantidad</span>
          <input
            name="stockQuantity"
            type="number"
            min={0}
            step={1}
            defaultValue={stockQuantityDefault}
            placeholder="10"
            className="merchant-workspace-input"
          />
        </label>
      </div>
    </div>
  );
}
