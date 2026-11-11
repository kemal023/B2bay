/**
 * Parses quick-order input: one EAN or item number per line, optionally
 * followed by a quantity ("5901234123457 12", "ABC-123;6", "590…\t3").
 * A line without a quantity means 1; empty lines are skipped.
 */
export function parseQuickOrder(text: string): { code: string; quantity: number }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\S+?)[\s;,]+(\d+)\s*$/);
      return m ? { code: m[1], quantity: Number(m[2]) } : { code: line.split(/[\s;,]/)[0], quantity: 1 };
    })
    .filter((l) => l.code && l.quantity > 0);
}
