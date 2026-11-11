import type { Locale } from "@/lib/i18n/config";
import type { CompanyDetails } from "@/lib/invoicing";

/**
 * Standard B2B terms and privacy statement, filled in with the seller details
 * from Admin -> Instellingen. A starting point written for this shop's actual
 * set-up (B2B only, invoice + bank transfer, EU delivery, functional cookies
 * only) — have it checked by a lawyer before relying on it.
 */

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
};

const LAST_UPDATED = { nl: "11 november 2026", en: "11 November 2026" };

function sellerLine(s: CompanyDetails): string {
  return [s.legalName, s.addressLine, `${s.postalCode} ${s.city}`.trim(), s.country]
    .filter((x) => x && x.trim())
    .join(", ");
}

export function termsDoc(locale: Locale, s: CompanyDetails, freeShippingFrom: string | null): LegalDoc {
  const name = s.legalName || "CosmeWeb";
  const days = s.paymentTermDays;

  if (locale === "en") {
    return {
      title: "General terms and conditions",
      updated: LAST_UPDATED.en,
      intro: `These terms apply to all offers, orders and deliveries of ${sellerLine(s)} (Chamber of Commerce ${s.kvkNumber}, VAT ${s.vatNumber}), hereinafter "${name}".`,
      sections: [
        {
          heading: "1. Business customers only",
          paragraphs: [
            "Our webshop is intended exclusively for businesses. By creating an account you declare that you act in the course of a profession or business. Consumer law (such as the statutory right of withdrawal) therefore does not apply.",
            "We may refuse or suspend an account, for example when company details cannot be verified.",
          ],
        },
        {
          heading: "2. Applicability",
          paragraphs: [
            "These terms apply to every agreement between you and us. Your own purchasing or other terms do not apply unless we have accepted them in writing.",
          ],
        },
        {
          heading: "3. Prices and offers",
          paragraphs: [
            "All prices are in euros and exclude VAT and shipping costs, unless stated otherwise. Offers are without obligation and valid while stocks last.",
            "Obvious errors in prices or product information do not bind us.",
          ],
        },
        {
          heading: "4. Orders",
          paragraphs: [
            "An agreement is formed when we send you an invoice for your order. Until then we may decline an order, for example if a product is no longer available.",
          ],
        },
        {
          heading: "5. Delivery and shipping costs",
          paragraphs: [
            "We deliver within the European Union. Delivery times are indicative; exceeding them does not entitle you to compensation or cancellation, unless the delay is unreasonably long.",
            freeShippingFrom
              ? `Shipping costs are stated on the invoice. Orders with a subtotal (excl. VAT) of ${freeShippingFrom} or more ship free of charge.`
              : "Shipping costs are stated on the invoice.",
            "Risk passes to you on delivery.",
          ],
        },
        {
          heading: "6. Payment",
          paragraphs: [
            `Invoices must be paid within ${days} days of the invoice date by bank transfer, stating the invoice number. We ship after payment unless agreed otherwise.`,
            "If you pay late, you are in default without notice and owe the statutory commercial interest (art. 6:119a Dutch Civil Code) and reasonable collection costs.",
          ],
        },
        {
          heading: "7. Retention of title",
          paragraphs: [
            "Delivered goods remain our property until all amounts owed under the agreement have been paid in full.",
          ],
        },
        {
          heading: "8. Inspection and complaints",
          paragraphs: [
            "Check the goods on delivery. Report visible defects or incorrect quantities within 8 days of delivery, and hidden defects within 8 days of discovery, by e-mail with photos where possible.",
            "If a complaint is justified, we will at our option replace the product, repair it or credit the purchase price. Returns are only accepted after our consent.",
          ],
        },
        {
          heading: "9. Liability",
          paragraphs: [
            "Our liability is limited to direct damage and to at most the invoice value of the order concerned. We are not liable for indirect damage, such as lost profit or business interruption, except in the case of intent or gross negligence.",
          ],
        },
        {
          heading: "10. Force majeure",
          paragraphs: [
            "We are not liable for failures caused by circumstances beyond our control, including failures by our suppliers or carriers.",
          ],
        },
        {
          heading: "11. Applicable law and disputes",
          paragraphs: [
            `Dutch law applies; the Vienna Sales Convention (CISG) is excluded. Disputes are submitted to the competent court in the district where ${name} is established.`,
          ],
        },
      ],
    };
  }

  return {
    title: "Algemene voorwaarden",
    updated: LAST_UPDATED.nl,
    intro: `Deze voorwaarden gelden voor alle aanbiedingen, bestellingen en leveringen van ${sellerLine(s)} (KVK ${s.kvkNumber}, btw ${s.vatNumber}), hierna "${name}".`,
    sections: [
      {
        heading: "1. Uitsluitend zakelijke afnemers",
        paragraphs: [
          "Onze webshop is uitsluitend bedoeld voor bedrijven. Door een account aan te maken verklaar je te handelen in de uitoefening van een beroep of bedrijf. Het consumentenrecht (zoals het wettelijke herroepingsrecht) is daarom niet van toepassing.",
          "We mogen een account weigeren of opschorten, bijvoorbeeld als bedrijfsgegevens niet te verifiëren zijn.",
        ],
      },
      {
        heading: "2. Toepasselijkheid",
        paragraphs: [
          "Deze voorwaarden gelden voor elke overeenkomst tussen jou en ons. Jouw eigen inkoop- of andere voorwaarden gelden niet, tenzij wij die schriftelijk hebben aanvaard.",
        ],
      },
      {
        heading: "3. Prijzen en aanbod",
        paragraphs: [
          "Alle prijzen zijn in euro's en exclusief btw en verzendkosten, tenzij anders vermeld. Aanbiedingen zijn vrijblijvend en gelden zolang de voorraad strekt.",
          "Kennelijke fouten in prijzen of productinformatie binden ons niet.",
        ],
      },
      {
        heading: "4. Bestellingen",
        paragraphs: [
          "Een overeenkomst komt tot stand zodra wij je een factuur voor je bestelling sturen. Tot dat moment mogen we een bestelling weigeren, bijvoorbeeld als een product niet meer leverbaar is.",
        ],
      },
      {
        heading: "5. Levering en verzendkosten",
        paragraphs: [
          "We leveren binnen de Europese Unie. Levertijden zijn indicatief; overschrijding geeft geen recht op schadevergoeding of ontbinding, tenzij de vertraging onredelijk lang is.",
          freeShippingFrom
            ? `Verzendkosten staan op de factuur. Bestellingen met een subtotaal (excl. btw) vanaf ${freeShippingFrom} worden gratis verzonden.`
            : "Verzendkosten staan op de factuur.",
          "Het risico gaat bij aflevering op jou over.",
        ],
      },
      {
        heading: "6. Betaling",
        paragraphs: [
          `Facturen betaal je binnen ${days} dagen na factuurdatum per bankoverschrijving, onder vermelding van het factuurnummer. We verzenden na betaling, tenzij anders afgesproken.`,
          "Bij te late betaling ben je zonder ingebrekestelling in verzuim en ben je de wettelijke handelsrente (art. 6:119a BW) en redelijke incassokosten verschuldigd.",
        ],
      },
      {
        heading: "7. Eigendomsvoorbehoud",
        paragraphs: [
          "Geleverde goederen blijven ons eigendom totdat alles wat je op grond van de overeenkomst verschuldigd bent volledig is betaald.",
        ],
      },
      {
        heading: "8. Controle en klachten",
        paragraphs: [
          "Controleer de goederen bij aflevering. Meld zichtbare gebreken of afwijkende aantallen binnen 8 dagen na levering, en verborgen gebreken binnen 8 dagen na ontdekking, per e-mail en waar mogelijk met foto's.",
          "Is een klacht terecht, dan vervangen of herstellen we het product of crediteren we de koopprijs, naar onze keuze. Retouren nemen we alleen aan na onze toestemming.",
        ],
      },
      {
        heading: "9. Aansprakelijkheid",
        paragraphs: [
          "Onze aansprakelijkheid is beperkt tot directe schade en tot maximaal de factuurwaarde van de betreffende bestelling. We zijn niet aansprakelijk voor indirecte schade, zoals gederfde winst of bedrijfsstilstand, behalve bij opzet of grove nalatigheid.",
        ],
      },
      {
        heading: "10. Overmacht",
        paragraphs: [
          "We zijn niet aansprakelijk voor tekortkomingen door omstandigheden buiten onze macht, waaronder tekortkomingen van onze leveranciers of vervoerders.",
        ],
      },
      {
        heading: "11. Toepasselijk recht en geschillen",
        paragraphs: [
          `Op alle overeenkomsten is Nederlands recht van toepassing; het Weens Koopverdrag (CISG) is uitgesloten. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement waar ${name} is gevestigd.`,
        ],
      },
    ],
  };
}

export function privacyDoc(locale: Locale, s: CompanyDetails): LegalDoc {
  const contact = s.email || "info@cosmeweb.nl";

  if (locale === "en") {
    return {
      title: "Privacy statement",
      updated: LAST_UPDATED.en,
      intro: `${sellerLine(s)} is responsible for processing the personal data described below. Questions or requests: ${contact}.`,
      sections: [
        {
          heading: "What we process",
          paragraphs: [
            "Account: name, e-mail address and a protected (hashed) password. Company: company name, address, Chamber of Commerce and VAT number, billing e-mail. Orders and invoices, including who placed them. Your language preference.",
          ],
        },
        {
          heading: "Why, and on what basis",
          paragraphs: [
            "To run your account and handle orders, invoices and deliveries (performance of the agreement). To keep our administration (legal obligation). To verify VAT numbers with the EU VIES service and to secure the webshop (legitimate interest). We do not use your data for advertising and do not sell it.",
          ],
        },
        {
          heading: "Who we share it with",
          paragraphs: [
            "Only with parties that help us run the webshop: our database host (Neon), our e-mail provider for order and account e-mails, carriers for delivery, and the European Commission's VIES service for VAT checks. They process data only on our instructions.",
            "Our database is hosted in the United States. Such transfers take place with the appropriate safeguards required by the GDPR.",
          ],
        },
        {
          heading: "How long we keep it",
          paragraphs: [
            "Invoices and order data: 7 years (statutory retention period). Account data: as long as your account exists. Password-reset links expire after 1 hour.",
          ],
        },
        {
          heading: "Cookies",
          paragraphs: [
            "We only use functional cookies: cw_session (keeps you signed in, 30 days) and lang (your language choice, 1 year). We do not use tracking or advertising cookies, so we do not ask for cookie consent.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: [
            `You can ask to access, correct or delete your data, to restrict or object to processing, or to receive your data (data portability). E-mail ${contact}. You may also lodge a complaint with the Dutch Data Protection Authority (Autoriteit Persoonsgegevens).`,
          ],
        },
        {
          heading: "Security",
          paragraphs: [
            "Passwords are stored hashed, connections are encrypted and access to the administration is limited to authorised staff.",
          ],
        },
      ],
    };
  }

  return {
    title: "Privacyverklaring",
    updated: LAST_UPDATED.nl,
    intro: `${sellerLine(s)} is verantwoordelijk voor de verwerking van de persoonsgegevens die hieronder staan beschreven. Vragen of verzoeken: ${contact}.`,
    sections: [
      {
        heading: "Welke gegevens we verwerken",
        paragraphs: [
          "Account: naam, e-mailadres en een beveiligd (gehasht) wachtwoord. Bedrijf: bedrijfsnaam, adres, KVK- en btw-nummer, facturatie-e-mail. Bestellingen en facturen, inclusief wie ze plaatste. Je taalvoorkeur.",
        ],
      },
      {
        heading: "Waarom, en op welke grondslag",
        paragraphs: [
          "Om je account te beheren en bestellingen, facturen en leveringen af te handelen (uitvoering van de overeenkomst). Om onze administratie bij te houden (wettelijke plicht). Om btw-nummers te controleren via de EU-dienst VIES en de webshop te beveiligen (gerechtvaardigd belang). We gebruiken je gegevens niet voor advertenties en verkopen ze niet.",
        ],
      },
      {
        heading: "Met wie we gegevens delen",
        paragraphs: [
          "Alleen met partijen die ons helpen de webshop te laten werken: onze databasehost (Neon), onze e-mailprovider voor bestel- en accountmails, vervoerders voor de levering, en de VIES-dienst van de Europese Commissie voor btw-controles. Zij verwerken gegevens alleen in onze opdracht.",
          "Onze database staat in de Verenigde Staten. Die doorgifte gebeurt met de passende waarborgen die de AVG vereist.",
        ],
      },
      {
        heading: "Hoe lang we gegevens bewaren",
        paragraphs: [
          "Facturen en bestelgegevens: 7 jaar (wettelijke bewaarplicht). Accountgegevens: zolang je account bestaat. Links om je wachtwoord opnieuw in te stellen verlopen na 1 uur.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "We gebruiken alleen functionele cookies: cw_session (houdt je ingelogd, 30 dagen) en lang (je taalkeuze, 1 jaar). We gebruiken geen tracking- of advertentiecookies en vragen daarom geen toestemming voor cookies.",
        ],
      },
      {
        heading: "Je rechten",
        paragraphs: [
          `Je kunt vragen om inzage, correctie of verwijdering van je gegevens, om beperking van of bezwaar tegen de verwerking, en om je gegevens over te dragen. Mail naar ${contact}. Je kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.`,
        ],
      },
      {
        heading: "Beveiliging",
        paragraphs: [
          "Wachtwoorden worden gehasht opgeslagen, verbindingen zijn versleuteld en toegang tot de administratie is beperkt tot bevoegde medewerkers.",
        ],
      },
    ],
  };
}
