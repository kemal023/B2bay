# CosmeWeb

B2B-webshop: zakelijke afnemers loggen in en bestellen uit **ons eigen**
assortiment — nergens op de site is te zien dat producten achter de
schermen ingekocht worden bij leveranciers zoals Maxy of Annapol. Wij
kopen zelf in (handmatig, of automatisch via een leverancier-API-koppeling)
en verkopen door met onze eigen marge. Er wordt niet online afgerekend:
verzendkosten hangen af van de bestelling, dus een beheerder bepaalt die
achteraf en stuurt een factuur die per bank overgemaakt wordt.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind v4 + shadcn/ui
- **Neon Postgres** via Drizzle ORM — bedrijven, gebruikers, leveranciers, producten, bestellingen
- **Eigen authenticatie** (geen derde partij) — e-mail/wachtwoord met scrypt-hashing en sessies in onze eigen database (zie "Authenticatie" hieronder)
- **Vercel Cron** — periodieke synchronisatie van leverancier-catalogi

## White-label: klanten zien nooit waar producten vandaan komen

- Productkaarten, productpagina's, winkelmandje en bestellingen tonen
  uitsluitend onze eigen naam, omschrijving, afbeelding en prijs — nergens
  "via [leverancier]" of iets vergelijkbaars.
  De homepage noemt geen leveranciersnamen (alleen categorieën uit ons
  eigen assortiment).
- Beheerders zien de leverancier per bestelregel wél, bij
  `/admin/orders/[id]` onder "Inkoop bij leveranciers" — inclusief link
  naar de leverancier, zodat je weet waar je moet (her)bestellen om een
  order te kunnen leveren. Dat blok is nooit zichtbaar voor klanten.

## Kostprijs vs. verkoopprijs (marge)

Elk product heeft een `costPriceCents` (wat wij betalen, bij
leverancier-producten automatisch bijgewerkt) en een `priceCents` (wat de
klant betaalt). Bij een nieuwe leverancier stel je een standaardmarge in
(%) — daarmee wordt bij import automatisch een verkoopprijs berekend
(kostprijs + marge). Zodra een beheerder een product bewerkt via
`/admin/products`, wordt het gemarkeerd als `customized`: de eerstvolgende
synchronisatie werkt dan alleen nog kostprijs, voorraad en
beschikbaarheid bij — naam, omschrijving, afbeelding, categorie en
verkoopprijs blijven zoals de beheerder ze heeft ingesteld.

## Productbeheer (`/admin/products`)

Eén overzicht van de hele catalogus, ongeacht herkomst:

- **Handmatig een product toevoegen** — geen leverancier nodig, gewoon
  naam, prijs, voorraad, etc. invullen.
- **Elk product bewerken** — ook producten die uit een
  leverancierskoppeling komen; prijs, naam, omschrijving, afbeelding,
  categorie, voorraad, zichtbaarheid.
- Kolom "Marge" laat direct zien wat je verdient per product
  (verkoopprijs t.o.v. kostprijs).
- Zowel dit overzicht als de publieke catalogus (`/products`) zijn
  gepagineerd (resp. 50 en 24 per pagina) — nodig zodra een leverancier
  tienduizenden producten aanlevert (zie Annapol hieronder).

## Leveranciers koppelen (`/admin/suppliers`)

De kernfunctie om automatisch producten binnen te krijgen, **zonder
code-deploy**:

1. Een platform-beheerder vult in het adminpaneel de API-URL, het
   authenticatietype (geen / bearer token / API-key header / basic auth),
   een standaardmarge (%) en een veldmapping in (welke JSON-velden
   corresponderen met naam, kostprijs, voorraad, etc.).
2. Dit wordt opgeslagen in de `suppliers`-tabel (zie `src/db/schema.ts`).
3. `src/lib/suppliers/generic-rest.ts` is een generieke adapter die elke
   JSON REST-API kan uitlezen op basis van die configuratie.
4. `src/lib/suppliers/sync.ts` haalt producten op en zet ze (upsert) in de
   `products`-tabel (zie "Kostprijs vs. verkoopprijs" hierboven);
   producten die niet meer in de leveranciersfeed voorkomen, worden
   gedeactiveerd (niet verwijderd, voor bestelhistorie).
5. Een cron-job (`vercel.ts`, elke 30 min) roept
   `/api/cron/sync-suppliers` aan, die alle actieve leveranciers ververst.
   Beheerders kunnen ook handmatig synchroniseren via de "Sync"-knop.

De generieke adapter dekt de meeste JSON REST-API's out-of-the-box via het
configuratieformulier. Wijkt een leverancier-API significant af (XML,
paginering, meerdere feeds die je moet combineren, een niet-standaard
auth-handshake), voeg dan een eigen adapter toe in `src/lib/suppliers/` en
registreer die in `src/lib/suppliers/registry.ts` — zoals hieronder voor
Annapol.

### Annapol — voorbeeld van een eigen adapter (`src/lib/suppliers/annapol.ts`)

Annapol levert geen enkele API, maar **drie XML-feeds** op hetzelfde
account die je zelf aan elkaar moet knopen (gelinkt via hun interne
numerieke product-`id`):

- `xml-categories.php` — categorie-id → naam, in meerdere talen (wij gebruiken "en")
- `xml-stock.php` — actuele voorraad + kostprijs per product (~14 MB)
- `xml-products.php` — naam/omschrijving/categorie/afbeeldingen per product (~150 MB, ±70.000 producten)

Belangrijke ontwerpkeuzes, relevant als je zelf een vergelijkbare adapter
bouwt:

- De producten-feed is te groot om in het geheugen te bufferen, dus die
  wordt **streaming** uitgelezen (SAX-parser, package `sax`) in plaats van
  in één keer ingelezen.
- `sax` zet in de niet-strikte modus tag-namen standaard in HOOFDLETTERS —
  daarom **altijd** de optie `{ lowercase: true }` meegeven, anders matcht
  geen enkele tag-naam en levert de sync stilzwijgend 0 producten op.
- Omschrijvingen komen binnen als inline HTML; die worden naar leesbare
  platte tekst gestript (geen HTML-rendering, dus geen sanitization-risico).
- Bij zo'n grote catalogus (~70k producten) upsert `sync.ts` in batches
  van 250 via één multi-row `INSERT ... ON CONFLICT DO UPDATE` in plaats
  van één query per product — anders duurt een sync veel te lang. Een
  bulk-`VALUES`-insert zonder doeltabel-context vereist wel expliciete
  `::type`-casts per kolom, anders wijst Postgres de insert af
  ("column ... is of type integer but expression is of type text").
- Eén statement kan met `ON CONFLICT DO UPDATE` nooit dezelfde rij twee
  keer raken — komt een SKU dubbel voor in de feed (gebeurt bij Annapol),
  dedupliceer dan éérst (laatste voorkomen wint) vóór je batcht.
- "Welke producten zijn er niet meer" wordt bepaald via `updated_at <
  syncStartedAt` in plaats van een `NOT IN (...)`-lijst met alle huidige
  SKU's — bij 70k SKU's is dat laatste onwerkbaar.
- `user`/`hash` (hun simpele query-param-auth) staan resp. in
  `supplier.config.user` en `supplier.credential` — geen aparte
  auth-headers nodig.

Een sync van de volledige Annapol-catalogus duurt in de praktijk
~3 minuten (download + streaming parse + batch-upserts) — ruim binnen de
`maxDuration = 300` die op `/admin/suppliers` en de cron-route staat.

## Bestel- en factuurflow

Er zit bewust geen betaalprovider (Stripe e.d.) in: verzendkosten zijn
variabel per bestelling, dus die worden pas na het plaatsen bepaald.

1. Klant plaatst een bestelling vanuit het winkelmandje → status `placed`.
2. Beheerder vult bij `/admin/orders/[id]` de verzendkosten en een
   factuurnummer in → status wordt `invoiced`. De klant ziet dit in zijn
   dashboard bij de bestelling.
3. Zodra de betaling (bankoverschrijving) binnen is, markeert de beheerder
   de bestelling als `paid`, en later als `fulfilled` zodra verzonden.

Het daadwerkelijk opstellen/versturen van de factuur (PDF, e-mail) gebeurt
vooralsnog handmatig buiten het platform om; het systeem houdt wel per
bestelling het factuurnummer, verzendkosten en status bij.

## Authenticatie

Geen Clerk/Auth0/andere derde partij: registratie en login zijn volledig
zelf gebouwd.

- `src/lib/auth/password.ts` — wachtwoorden gehasht met Node's ingebouwde
  `scrypt` (geen extra dependency).
- `src/lib/auth/session.ts` — bij inloggen krijgt de gebruiker een
  willekeurige sessietoken als `httpOnly`-cookie; alleen de SHA-256 hash
  daarvan staat in de `sessions`-tabel, zodat een databaselek geen bruikbare
  sessies oplevert.
- `src/lib/actions/auth.ts` — `registerAction`, `loginAction`, `logoutAction`.
- Elke pagina/server action controleert zelf de sessie (`getAppUser()` /
  `isPlatformAdmin()` in `src/lib/auth.ts`) — er is bewust geen middleware
  die dit centraal afvangt, dat voorkomt dat beveiliging afhangt van
  route-matching die uit de pas kan lopen met de daadwerkelijke routes.

## Eerste keer opzetten

```bash
npm install
vercel link                    # koppel aan het Vercel-project (al gedaan)
vercel env pull --yes          # haal DATABASE_URL op
npm run db:push                # zet het schema in Neon
npm run dev
```

Maak een account aan via `/sign-up`, en promoveer jezelf daarna tot
platformbeheerder zodat je bij `/admin` kunt:

```bash
npm run seed:admin -- jouw@email.com
```

## Draaien in Docker

De app zelf draait gecontaineriseerd; de database blijft Neon (cloud), dus
er zit geen Postgres-container in de compose-file.

```bash
vercel env pull --yes    # zorg dat .env.local actueel is (DATABASE_URL, CRON_SECRET)
docker compose up --build -d
```

Draait daarna op http://localhost:3003 (container luistert intern op 3000,
zie `docker-compose.yml` om de host-poort aan te passen). `Dockerfile`
bouwt een multi-stage productie-image op basis van Next.js' standalone
output (`output: "standalone"` in `next.config.ts`) — geen `node_modules`
nodig in de uiteindelijke image.

```bash
docker compose logs -f app   # logs volgen
docker compose down          # stoppen
```

## Belangrijkste mappen

- `src/db/schema.ts` — datamodel (bedrijven, gebruikers, leveranciers, producten, bestellingen)
- `src/lib/suppliers/` — leverancier-adapters en synchronisatielogica
- `src/lib/actions/` — server actions (cart, bestellingen, producten, onboarding, admin)
- `src/app/admin/` — adminpaneel (producten, leveranciers, bedrijven, bestellingen)
- `src/app/` — publieke catalogus, winkelmandje, dashboard
