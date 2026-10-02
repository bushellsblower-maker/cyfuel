import { useEffect, useState } from "react";
import {
  clampThirstDraft,
  lPer100kmToUkMpg,
  litresFromThirstDraft,
  thirstBounds,
  thirstFieldText,
  ukMpgToLPer100km,
  type UnitSystem,
} from "../../shared/units";

export function ThirstEditor(props: {
  litresPer100km: number;
  units: UnitSystem;
  onLitresPer100km: (litres: number) => void;
  showSlider?: boolean;
}) {
  const imperial = props.units === "imperial";
  const bounds = thirstBounds(props.units);
  const display = thirstFieldText(props.litresPer100km, props.units);
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(display);
  }, [display, focused]);

  const sliderValue = imperial
    ? Math.min(bounds.max, Math.max(bounds.min, Math.round(lPer100kmToUkMpg(props.litresPer100km))))
    : Math.min(bounds.max, Math.max(bounds.min, Math.round(props.litresPer100km * 10) / 10));

  function commitDraft(raw: string, clamp: boolean): void {
    const litres = clamp ? clampThirstDraft(raw, props.units) : litresFromThirstDraft(raw, props.units);
    if (litres == null) return;
    props.onLitresPer100km(litres);
  }

  return (
    <label className="field thirst-field">
      <span>{imperial ? `Thirst (mpg) · ${display} UK` : `Thirst (L/100km) · ${display}`}</span>
      <span className="thirst-row">
        {props.showSlider ? (
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            aria-label={imperial ? "Thirst slider, UK mpg" : "Thirst slider, litres per 100 km"}
            value={sliderValue}
            onChange={(event) => {
              const next = Number(event.target.value);
              props.onLitresPer100km(imperial ? ukMpgToLPer100km(next) : next);
            }}
          />
        ) : null}
        <input
          type="number"
          inputMode="decimal"
          name="thirst"
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          aria-label={imperial ? "Thirst in UK mpg, not US mpg" : "Thirst in litres per 100 km"}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const litres = clampThirstDraft(text, props.units);
            if (litres == null) {
              setText(display);
              return;
            }
            props.onLitresPer100km(litres);
            setText(thirstFieldText(litres, props.units));
          }}
          onChange={(event) => {
            setText(event.target.value);
            commitDraft(event.target.value, false);
          }}
        />
      </span>
      {imperial ? <small className="field-help">UK mpg, not US mpg. Higher is a sipper.</small> : null}
    </label>
  );
}
