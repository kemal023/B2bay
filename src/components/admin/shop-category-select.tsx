import { selectClassName } from "@/components/billing-fields";
import { OTHER, TAXONOMY } from "@/lib/taxonomy.mjs";

/**
 * Picks a place in the shop's category tree. Values: "main" (subcategory
 * decided per product from its name), "main/sub", or "" for automatic when
 * `autoLabel` is given. Plain <select> so it works inside server-action forms.
 */
export function ShopCategorySelect({
  name,
  defaultValue,
  autoLabel,
  className,
  onChange,
  disabled,
  id,
}: {
  name?: string;
  defaultValue: string;
  autoLabel?: string;
  className?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
      aria-label="Categorie in de shop"
      className={`${selectClassName} ${className ?? ""}`}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    >
      {autoLabel && <option value="">{autoLabel}</option>}
      {TAXONOMY.map((m) => (
        <optgroup key={m.slug} label={m.labels.nl}>
          <option value={m.slug}>{m.labels.nl} — subcategorie per product</option>
          {m.subs.map((s) => (
            <option key={s.slug} value={`${m.slug}/${s.slug}`}>
              {m.labels.nl} › {s.labels.nl}
            </option>
          ))}
        </optgroup>
      ))}
      <option value={OTHER.slug}>{OTHER.labels.nl}</option>
    </select>
  );
}
