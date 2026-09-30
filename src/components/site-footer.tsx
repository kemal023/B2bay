import Link from "next/link";
import { ShieldCheck, Truck, FileText } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              CW
            </span>
            CosmeWeb
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Eén zakelijk account, meerdere leveranciers, één factuur. Groothandel
            zoals het hoort te zijn.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Platform</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/products" className="hover:text-foreground">Producten</Link></li>
            <li><Link href="/sign-up" className="hover:text-foreground">Zakelijk account aanvragen</Link></li>
            <li><Link href="/dashboard" className="hover:text-foreground">Mijn bestellingen</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Vertrouwen</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Geverifieerde bedrijfsaccounts</li>
            <li className="flex items-center gap-2"><Truck className="h-4 w-4" /> Rechtstreeks van leveranciers</li>
            <li className="flex items-center gap-2"><FileText className="h-4 w-4" /> Duidelijke facturatie</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Contact</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>KVK: op aanvraag</li>
            <li>info@cosmeweb.nl</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CosmeWeb. Alle rechten voorbehouden.
      </div>
    </footer>
  );
}
