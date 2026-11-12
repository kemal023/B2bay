/**
 * The shop's own category tree: 13 main categories, each with subcategories.
 * Supplier categories are mapped onto this (category_mappings), and products
 * the mapping can't place are put here by name (scripts/categorize.mjs).
 *
 * Plain .mjs so the Next app and the background job share one definition.
 * Slugs are stable keys (URLs, database); labels are written by hand in all
 * four shop languages, not machine-translated. Renaming a label is safe;
 * changing or removing a slug needs a data migration.
 */

/** @typedef {{ nl: string, en: string, de: string, fr: string }} Labels */
/** @typedef {{ slug: string, labels: Labels }} Subcategory */
/** @typedef {{ slug: string, labels: Labels, subs: Subcategory[] }} MainCategory */

const L = (nl, en, de, fr) => ({ nl, en, de, fr });
const sub = (slug, nl, en, de, fr) => ({ slug, labels: L(nl, en, de, fr) });

/** @type {MainCategory[]} */
export const TAXONOMY = [
  {
    slug: "tools",
    labels: L("Gereedschap", "Tools", "Werkzeuge", "Outillage"),
    subs: [
      sub("power-tools", "Elektrisch gereedschap", "Power tools", "Elektrowerkzeuge", "Outillage électroportatif"),
      sub("hand-tools", "Handgereedschap & sets", "Hand tools & sets", "Handwerkzeuge & Sets", "Outils à main & coffrets"),
      sub("measuring", "Meetgereedschap", "Measuring tools", "Messwerkzeuge", "Outils de mesure"),
      sub("soldering-welding", "Solderen & lassen", "Soldering & welding", "Löten & Schweißen", "Soudure & brasage"),
      sub("pneumatic-hydraulic", "Pneumatisch & hydraulisch", "Pneumatic & hydraulic", "Pneumatik & Hydraulik", "Pneumatique & hydraulique"),
      sub("tool-accessories", "Boren, bits, zaag- & slijpschijven", "Drill bits, blades & discs", "Bohrer, Bits, Säge- & Schleifscheiben", "Forets, embouts, lames & disques"),
      sub("tool-storage", "Opbergen & werkplaats", "Storage & workshop", "Aufbewahrung & Werkstatt", "Rangement & atelier"),
      sub("pressure-washers-generators", "Hogedrukreinigers & aggregaten", "Pressure washers & generators", "Hochdruckreiniger & Stromerzeuger", "Nettoyeurs haute pression & groupes électrogènes"),
    ],
  },
  {
    slug: "workwear-safety",
    labels: L("Werkkleding & veiligheid", "Workwear & safety", "Arbeitskleidung & Sicherheit", "Vêtements de travail & sécurité"),
    subs: [
      sub("work-gloves", "Werkhandschoenen", "Work gloves", "Arbeitshandschuhe", "Gants de travail"),
      sub("work-shoes", "Werkschoenen", "Work shoes", "Arbeitsschuhe", "Chaussures de travail"),
      sub("workwear", "Werkkleding & signalisatie", "Workwear & hi-vis", "Arbeits- & Warnkleidung", "Vêtements de travail & haute visibilité"),
      sub("head-face-hearing", "Gehoor-, hoofd- & gezichtsbescherming", "Head, face & hearing protection", "Kopf-, Gesichts- & Gehörschutz", "Protection tête, visage & auditive"),
      sub("knee-fall", "Knie- & valbescherming", "Knee & fall protection", "Knie- & Absturzschutz", "Protection genoux & antichute"),
      sub("marking", "Markering & afzetting", "Marking & barriers", "Markierung & Absperrung", "Signalisation & balisage"),
    ],
  },
  {
    slug: "home-garden",
    labels: L("Huis & tuin", "Home & garden", "Haus & Garten", "Maison & jardin"),
    subs: [
      sub("household-kitchen", "Huishouden & keuken", "Household & kitchen", "Haushalt & Küche", "Maison & cuisine"),
      sub("garden", "Tuin", "Garden", "Garten", "Jardin"),
      sub("lighting", "Verlichting", "Lighting", "Beleuchtung", "Éclairage"),
      sub("electrical-installation", "Elektra & installatie", "Electrical installation", "Elektroinstallation", "Installation électrique"),
      sub("locks-security", "Sloten & beveiliging", "Locks & security", "Schlösser & Sicherheit", "Serrures & sécurité"),
      sub("adhesives-tape", "Lijm, kit & tape", "Adhesives, sealants & tape", "Kleber, Dichtstoffe & Klebeband", "Colles, mastics & rubans"),
      sub("paint", "Verf", "Paint", "Farbe", "Peinture"),
      sub("pets", "Dieren", "Pets", "Tierbedarf", "Animaux"),
      sub("decoration-party", "Decoratie & feest", "Decoration & party", "Deko & Feier", "Décoration & fête"),
    ],
  },
  {
    slug: "appliances-av",
    labels: L("Huishoudelijke apparaten & beeld en geluid", "Appliances, TV & audio", "Haushaltsgeräte, TV & Audio", "Électroménager, TV & audio"),
    subs: [
      sub("appliances", "Huishoudelijke apparaten", "Household appliances", "Haushaltsgeräte", "Électroménager"),
      sub("tv-video", "TV & video", "TV & video", "TV & Video", "TV & vidéo"),
      sub("audio", "Audio", "Audio", "Audio", "Audio"),
      sub("headphones", "Koptelefoons", "Headphones", "Kopfhörer", "Casques & écouteurs"),
      sub("satellite-antennas", "Satelliet & antennes", "Satellite & antennas", "Satellit & Antennen", "Satellite & antennes"),
      sub("remote-controls", "Afstandsbedieningen", "Remote controls", "Fernbedienungen", "Télécommandes"),
      sub("weather-stations", "Weerstations", "Weather stations", "Wetterstationen", "Stations météo"),
    ],
  },
  {
    slug: "electronics-batteries",
    labels: L("Elektronica & batterijen", "Electronics & batteries", "Elektronik & Batterien", "Électronique & piles"),
    subs: [
      sub("batteries", "Batterijen & accu's", "Batteries", "Batterien & Akkus", "Piles & accumulateurs"),
      sub("chargers-power", "Opladers & voedingen", "Chargers & power supplies", "Ladegeräte & Netzteile", "Chargeurs & alimentations"),
      sub("cables-connectors", "Kabels & connectoren", "Cables & connectors", "Kabel & Steckverbinder", "Câbles & connecteurs"),
      sub("plugs-adapters", "Stekkers & adapters", "Plugs & adapters", "Stecker & Adapter", "Fiches & adaptateurs"),
      sub("fuses", "Zekeringen", "Fuses", "Sicherungen", "Fusibles"),
      sub("test-equipment", "Meetapparatuur", "Test equipment", "Messgeräte", "Appareils de mesure"),
      sub("components", "Elektronische onderdelen", "Electronic components", "Elektronische Bauteile", "Composants électroniques"),
      sub("radio", "Portofoons & CB", "Two-way radio & CB", "Funkgeräte & CB", "Talkies-walkies & CB"),
    ],
  },
  {
    slug: "computers-phones",
    labels: L("Computers & telefonie", "Computers & phones", "Computer & Telefone", "Informatique & téléphonie"),
    subs: [
      sub("pc-accessories", "Laptop- & pc-accessoires", "Laptop & PC accessories", "Laptop- & PC-Zubehör", "Accessoires PC & portables"),
      sub("printers-scanners", "Printers & scanners", "Printers & scanners", "Drucker & Scanner", "Imprimantes & scanners"),
      sub("storage", "Opslag", "Storage", "Speicher", "Stockage"),
      sub("networking", "Netwerk", "Networking", "Netzwerk", "Réseau"),
      sub("phone-accessories", "Telefoonaccessoires", "Phone accessories", "Handyzubehör", "Accessoires téléphone"),
      sub("phones", "Mobiele & vaste telefoons", "Mobile & landline phones", "Handys & Festnetztelefone", "Téléphones mobiles & fixes"),
    ],
  },
  {
    slug: "automotive",
    labels: L("Auto & motor", "Car & motorbike", "Auto & Motorrad", "Auto & moto"),
    subs: [
      sub("car-accessories", "Accessoires & onderdelen", "Accessories & parts", "Zubehör & Ersatzteile", "Accessoires & pièces"),
      sub("garage-tools", "Garagegereedschap", "Garage tools", "Werkstattwerkzeuge", "Outillage garage"),
      sub("car-care", "Verzorging & chemie", "Car care & chemicals", "Pflege & Chemie", "Entretien & produits"),
      sub("car-lighting", "Verlichting", "Lighting", "Beleuchtung", "Éclairage"),
      sub("car-electrics-ev", "Elektrisch & EV-laden", "Electrics & EV charging", "Elektrik & E-Auto-Laden", "Électricité & recharge VE"),
      sub("car-audio", "Auto-audio & navigatie", "Car audio & navigation", "Car-Audio & Navigation", "Audio & navigation"),
      sub("dashcams", "Dashcams", "Dashcams", "Dashcams", "Dashcams"),
      sub("motorbike", "Motoraccessoires", "Motorbike accessories", "Motorradzubehör", "Accessoires moto"),
    ],
  },
  {
    slug: "toys-baby",
    labels: L("Speelgoed & baby", "Toys & baby", "Spielzeug & Baby", "Jouets & bébé"),
    subs: [
      sub("baby", "Baby & peuter", "Baby & toddler", "Baby & Kleinkind", "Bébé & tout-petits"),
      sub("building", "Bouwen & constructie", "Building & construction", "Bauen & Konstruieren", "Construction"),
      sub("dolls-playsets", "Poppen & speelsets", "Dolls & playsets", "Puppen & Spielsets", "Poupées & jeux d'imitation"),
      sub("vehicles-rc", "Auto's, treinen & RC", "Cars, trains & RC", "Autos, Züge & RC", "Voitures, trains & RC"),
      sub("puzzles-games", "Puzzels & spellen", "Puzzles & games", "Puzzles & Spiele", "Puzzles & jeux"),
      sub("creative-educational", "Creatief & educatief", "Creative & educational", "Kreativ & Lernen", "Créatif & éducatif"),
      sub("outdoor-toys", "Buitenspeelgoed", "Outdoor toys", "Outdoor-Spielzeug", "Jeux d'extérieur"),
      sub("plush", "Knuffels", "Plush toys", "Plüschtiere", "Peluches"),
      sub("costumes", "Verkleden", "Costumes & dress-up", "Kostüme & Verkleidung", "Déguisements"),
    ],
  },
  {
    slug: "sports-leisure",
    labels: L("Sport & vrije tijd", "Sports & leisure", "Sport & Freizeit", "Sport & loisirs"),
    subs: [
      sub("fitness", "Fitness", "Fitness", "Fitness", "Fitness"),
      sub("cycling", "Fiets", "Cycling", "Fahrrad", "Vélo"),
      sub("camping-outdoor", "Camping & outdoor", "Camping & outdoor", "Camping & Outdoor", "Camping & plein air"),
      sub("fishing", "Vissen", "Fishing", "Angeln", "Pêche"),
      sub("scooters-skates", "Steps & skates", "Scooters & skates", "Roller & Skates", "Trottinettes & patins"),
      sub("water-sports", "Watersport", "Water sports", "Wassersport", "Sports nautiques"),
      sub("racket-sports", "Racketsport", "Racket sports", "Schlägersport", "Sports de raquette"),
    ],
  },
  {
    slug: "office-school",
    labels: L("Kantoor & school", "Office & school", "Büro & Schule", "Bureau & école"),
    subs: [
      sub("school-writing", "Schoolartikelen & schrijfwaren", "School & writing supplies", "Schul- & Schreibwaren", "Fournitures scolaires & écriture"),
      sub("office-supplies", "Kantoorbenodigdheden", "Office supplies", "Bürobedarf", "Fournitures de bureau"),
      sub("packaging-shipping", "Verpakking & verzending", "Packaging & shipping", "Verpackung & Versand", "Emballage & expédition"),
      sub("calculators", "Rekenmachines", "Calculators", "Taschenrechner", "Calculatrices"),
      sub("safes-cash", "Kluizen & geldkisten", "Safes & cash boxes", "Tresore & Geldkassetten", "Coffres-forts & caisses"),
      sub("office-furniture", "Kantoormeubels", "Office furniture", "Büromöbel", "Mobilier de bureau"),
    ],
  },
  {
    slug: "health-care",
    labels: L("Gezondheid & verzorging", "Health & personal care", "Gesundheit & Pflege", "Santé & soins"),
    subs: [
      sub("health-medical", "Gezondheid & medisch", "Health & medical", "Gesundheit & Medizin", "Santé & médical"),
      sub("manicure-pedicure", "Manicure & pedicure", "Manicure & pedicure", "Maniküre & Pediküre", "Manucure & pédicure"),
      sub("hair", "Haarverzorging", "Hair care", "Haarpflege", "Soins des cheveux"),
      sub("makeup-face", "Make-up & gezicht", "Make-up & face", "Make-up & Gesicht", "Maquillage & visage"),
      sub("hygiene", "Hygiëne", "Hygiene", "Hygiene", "Hygiène"),
    ],
  },
  {
    slug: "fashion-accessories",
    labels: L("Mode & accessoires", "Fashion & accessories", "Mode & Accessoires", "Mode & accessoires"),
    subs: [
      sub("bags", "Tassen", "Bags", "Taschen", "Sacs"),
      sub("watches", "Horloges", "Watches", "Uhren", "Montres"),
      sub("wallets", "Portemonnees", "Wallets", "Geldbörsen", "Portefeuilles"),
      sub("umbrellas", "Paraplu's", "Umbrellas", "Regenschirme", "Parapluies"),
      sub("sunglasses", "Zonnebrillen", "Sunglasses", "Sonnenbrillen", "Lunettes de soleil"),
      sub("clothing", "Kleding", "Clothing", "Kleidung", "Vêtements"),
    ],
  },
  {
    slug: "hobby-photo-music",
    labels: L("Hobby, foto & muziek", "Hobby, photo & music", "Hobby, Foto & Musik", "Loisirs créatifs, photo & musique"),
    subs: [
      sub("photography", "Fotografie", "Photography", "Fotografie", "Photographie"),
      sub("optics", "Verrekijkers & microscopen", "Binoculars & microscopes", "Ferngläser & Mikroskope", "Jumelles & microscopes"),
      sub("memory-cards", "Geheugenkaarten", "Memory cards", "Speicherkarten", "Cartes mémoire"),
      sub("art-painting", "Schilderen & kunst", "Painting & art", "Malen & Kunst", "Peinture & art"),
      sub("music-dj", "Muziek & DJ", "Music & DJ", "Musik & DJ", "Musique & DJ"),
    ],
  },
];

/** Where a product goes when nothing places it with any confidence. */
export const OTHER = { slug: "other", labels: L("Overig", "Other", "Sonstiges", "Autres") };

const mainBySlug = new Map(TAXONOMY.map((m) => [m.slug, m]));
const subBySlug = new Map(TAXONOMY.flatMap((m) => m.subs.map((s) => [s.slug, { ...s, main: m.slug }])));

export const isMainSlug = (slug) => mainBySlug.has(slug) || slug === OTHER.slug;
/** A subcategory slug that belongs to the given main category. */
export const isSubOf = (subSlug, mainSlug) => subBySlug.get(subSlug)?.main === mainSlug;
export const mainOfSub = (subSlug) => subBySlug.get(subSlug)?.main ?? null;

/** @param {string | null | undefined} slug @param {keyof Labels} locale */
export function mainLabel(slug, locale) {
  if (!slug) return null;
  if (slug === OTHER.slug) return OTHER.labels[locale];
  return mainBySlug.get(slug)?.labels[locale] ?? null;
}

/** @param {string | null | undefined} slug @param {keyof Labels} locale */
export function subLabel(slug, locale) {
  return slug ? (subBySlug.get(slug)?.labels[locale] ?? null) : null;
}
