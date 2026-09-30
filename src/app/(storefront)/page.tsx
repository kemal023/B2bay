import Link from "next/link";
import { ArrowRight, Boxes, Building2, FileCheck2, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories } from "@/lib/products";

const FEATURED_CATEGORY_COUNT = 16;

export default async function HomePage() {
  const allCategories = await listCategories();
  const categories = allCategories.slice(0, FEATURED_CATEGORY_COUNT);

  return (
    <div>
      <section className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              Uitsluitend voor zakelijke afnemers
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Eén platform voor je volledige zakelijke inkoop.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              CosmeWeb biedt een breed assortiment professionele producten
              tegen scherpe zakelijke prijzen — besteld via één account, met
              duidelijke facturatie achteraf.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/products">
                  Bekijk de catalogus
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/sign-up">Zakelijk account aanvragen</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="hoe-werkt-het" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Hoe het werkt</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle className="mt-2">1. Account aanmaken</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Registreer je bedrijf met KVK- en btw-gegevens. Na verificatie krijg
              je toegang tot bestellen en zakelijke prijzen.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Boxes className="h-6 w-6 text-primary" />
              <CardTitle className="mt-2">2. Bestel je assortiment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Voeg producten toe aan je winkelmandje en bestel alles in
              één keer, zonder aparte accounts of bestelprocessen.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <FileCheck2 className="h-6 w-6 text-primary" />
              <CardTitle className="mt-2">3. Bestel &amp; ontvang je factuur</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Plaats je bestelling, ontvang een factuur met verzendkosten en
              maak eenvoudig per bank over. Volg alles vanuit je dashboard.
            </CardContent>
          </Card>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Ons assortiment</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Een breed, actueel aanbod — direct uit voorraad.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Link key={c} href={`/products?category=${encodeURIComponent(c)}`}>
                  <Badge variant="secondary" className="cursor-pointer px-4 py-2 text-sm">
                    {c}
                  </Badge>
                </Link>
              ))}
              {allCategories.length > FEATURED_CATEGORY_COUNT && (
                <Link href="/products">
                  <Badge className="cursor-pointer px-4 py-2 text-sm">
                    Alle categorieën &rarr;
                  </Badge>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-6">
          <ShieldCheck className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <h3 className="font-semibold">Geverifieerde zakelijke afnemers</h3>
            <p className="text-sm text-muted-foreground">
              Elk nieuw bedrijfsaccount wordt beoordeeld voordat er besteld kan
              worden — zo blijft het platform betrouwbaar voor iedereen.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
          <Truck className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Klaar om zakelijk in te kopen?
          </h2>
          <Button asChild size="lg">
            <Link href="/sign-up">Vraag een zakelijk account aan</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
