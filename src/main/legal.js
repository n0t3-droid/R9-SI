// ============================================================================
// 📜 Rechtliches — Impressum · Datenschutz · Credits · Hinweis, the texts of the
// launch audit (docs/legal/2026-10-07-launch-legal-audit.md §4) in the game and
// in the R9 Studio. One overlay for both pages: VR.Legal.open('impressum' |
// 'datenschutz' | 'credits' | 'hinweis'), Esc or ✕ closes it, 📋 copies all of
// it as plain text, DE / EN switches just these texts. Every text goes through
// VR.I18N.tx('legal.<key>', …, de, en) when the language module is there (a
// table can translate it), else it is German.
// The owner's name, postal address and e-mail are OWNER below: until they are
// filled in, the texts show marked placeholders and the Impressum a warning.
// Also here: the 📜 button (pause menu, settings, the Studio's header), the
// one-line share hint of every export, and the multiplayer name notice („👥
// Mitspieler sehen deinen Namen" — ✓ OK · Spitzname… · Mehrspieler aus) that
// the game shows before any name leaves the browser (mp.js holds the rule).
// This is the audit's research put into the page, not legal advice.
// ============================================================================
(function (VR) {
  'use strict';
  const L = VR.Legal = VR.Legal || {};
  // ⚠ Fill these in before the public launch (§ 18 Abs. 1 MStV): first and last name, a postal address where letters
  // can be served (no P.O. box; 'Straße Hausnummer, PLZ Ort' — each comma starts a line) and an e-mail address.
  // Never invent them: while one is empty, its placeholder shows (marked) and the Impressum says what is missing.
  const OWNER = L.OWNER = L.OWNER || { name: '', address: '', email: '' };
  const YEAR = '2026', STAND = ['7. Oktober 2026', '7 October 2026'];
  const SECTIONS = L.SECTIONS = ['impressum', 'datenschutz', 'credits', 'hinweis'];
  const ALIAS = { imprint: 'impressum', legal: 'impressum', 'legal notice': 'impressum', privacy: 'datenschutz', datenschutzerklaerung: 'datenschutz', 'datenschutzerklärung': 'datenschutz', credit: 'credits', quellen: 'credits', notice: 'hinweis', disclaimer: 'hinweis', marken: 'hinweis' };
  const norm = (s) => { s = String(s || '').toLowerCase().trim(); s = ALIAS[s] || s; return SECTIONS.includes(s) ? s : 'impressum'; };
  const HAS_DOM = typeof document !== 'undefined' && typeof window !== 'undefined';

  // ---------------------------------------------------------------- language
  // L.lang: the overlay's own DE / EN (null: the page's language — VR.I18N when it is there, else German)
  if (L.lang === undefined) L.lang = null;
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined ? v[k] : m));
  // the language a text comes out in: 'de' or 'en' (every other language reads the English unless a table has it)
  const langOf = (want) => { const w = want || L.lang; if (w === 'de' || w === 'en') return w; const I = VR.I18N; return I && I.lang && I.lang !== 'de' ? 'en' : 'de'; };
  // the raw text (its {tokens} still in it) in the language of the moment, or in `want`
  function raw(key, de, en, want) {
    const w = want || L.lang;
    if (w === 'de') return de;
    if (w === 'en') return en;
    const I = VR.I18N;
    return I && I.tx ? I.tx('legal.' + key, null, de, en) : de;
  }
  const T = (key, de, en, vars, want) => fill(raw(key, de, en, want), vars);
  L.t = T;

  // ---------------------------------------------------------------- the owner's details
  const PH = { name: ['[Name]', '[Name]'], address: ['[Anschrift]', '[Address]'], email: ['[E-Mail]', '[E-mail]'] };
  const val = (k) => String(OWNER[k] == null ? '' : OWNER[k]).trim();
  L.incomplete = () => !val('name') || !val('address') || !val('email');
  const lines = (s) => String(s).split(/\s*[,\n]\s*/).filter(Boolean);
  // a detail as text (the placeholder when empty) and as HTML (escaped; the placeholder marked)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mark = (t) => `<mark class="lg-ph" title="${esc(raw('ph', 'Platzhalter — vor dem Start ausfüllen', 'Placeholder — to fill in before the launch'))}">${esc(t)}</mark>`;
  // (the address: one line with commas, or — multi — a line per part)
  function detail(k, lang, html, multi) {
    const v = val(k);
    if (!v) { const p = PH[k][lang === 'de' ? 0 : 1]; return html ? mark(p) : p; }
    const ls = k === 'address' ? lines(v) : [v];
    return (html ? ls.map(esc) : ls).join(multi ? (html ? '<br>' : '\n') : ', ');
  }
  const vars = (lang, html) => ({ name: detail('name', lang, html), address: detail('address', lang, html), email: detail('email', lang, html), year: YEAR, stand: STAND[lang === 'de' ? 0 : 1] });

  // ---------------------------------------------------------------- the texts
  // a section: [type, key, German, English] — h heading · p paragraph · li list item · small fine print —
  // and the computed blocks: owner (the Impressum's address), warn (placeholders left), imports (VR.Credits)
  const TX = {
    impressum: {
      title: ['Impressum', 'Impressum'],
      blocks: [
        ['warn'],
        ['h', 'imp.h', `Angaben gemäß § 18 Abs. 1 Medienstaatsvertrag (MStV)`, `Information pursuant to § 18 (1) of the German Interstate Media Treaty (Medienstaatsvertrag, MStV)`],
        ['owner'],
        ['p', 'imp.p1', `R9-SI und R9 Studio sind ein privates, nicht-kommerzielles Hobbyprojekt. Es gibt keine Werbung, keine Bezahlfunktionen und keine Nutzerkonten. Die Seiten werden als „Artifact“ auf claude.ai (Anthropic) bereitgestellt; Anthropic ist nicht der Anbieter dieses Spiels.`,
          `R9-SI and R9 Studio are a private, non-commercial hobby project. There is no advertising, no payment feature and no user account. The pages are provided as an "artifact" on claude.ai (Anthropic); Anthropic is not the provider of this game.`],
        ['p', 'imp.p2', `Datenschutz, die Schriften und ihre Lizenzen sowie Hinweise zu Marken stehen in den anderen Reitern: Datenschutz · Credits · Hinweis.`,
          `Privacy, the fonts and their licences and notes on trademarks are in the other tabs: Privacy · Credits · Notice.`],
      ],
    },
    datenschutz: {
      title: ['Datenschutz', 'Privacy'],
      blocks: [
        ['h2', 'ds.title', `Datenschutzerklärung für R9-SI und R9 Studio`, `Privacy policy for R9-SI and R9 Studio`],
        ['small', 'ds.stand', `Stand: {stand}`, `As of {stand} · This English text is a translation; the German version applies.`],
        ['h', 'ds.h1', `1. Verantwortlicher`, `1. Controller`],
        ['p', 'ds.p1', `{name}, {address}, E-Mail: {email}`, `{name}, {address}, e-mail: {email}`],
        ['h', 'ds.h2', `2. Das Wichtigste in Kürze`, `2. In short`],
        ['p', 'ds.p2', `R9-SI ist ein Browserspiel ohne eigenen Server. Es gibt keine Konten, keine Anmeldung, keine Werbung, keine Analyse- oder Tracking-Werkzeuge, keine Cookies und keine Bezahlfunktionen. Das Spiel erhebt keine personenbezogenen Daten und sendet keine Daten an mich. Alles, was du im Spiel machst, wird ausschließlich in deinem eigenen Browser gespeichert. Nur wenn du mit eingeladenen Freunden zusammen spielst, werden Spieldaten und dein Anzeigename über die Server der Plattform claude.ai zwischen den beteiligten Spielern ausgetauscht (siehe Abschnitt 5).`,
          `R9-SI is a browser game without a server of its own. There are no accounts, no sign-up, no advertising, no analytics or tracking tools, no cookies and no payment features. The game collects no personal data and sends no data to me. Everything you do in the game is stored only in your own browser. Only when you play together with invited friends are game data and your display name exchanged between the players involved, through the servers of the claude.ai platform (see section 5).`],
        ['h', 'ds.h3', `3. Hosting durch claude.ai (Anthropic)`, `3. Hosting by claude.ai (Anthropic)`],
        ['p', 'ds.p3', `Das Spiel und das Studio werden als „Artifact“ auf claude.ai bereitgestellt. Betreiber der Plattform ist Anthropic (für Nutzer im EWR, in Großbritannien und der Schweiz: Anthropic Ireland, Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4, D04 TR29, Irland; sonst Anthropic PBC, 548 Market St, PMB 90375, San Francisco, CA 94104, USA). Beim Aufruf der Seite verarbeitet Anthropic als eigenständiger Verantwortlicher die technisch notwendigen Verbindungsdaten (z. B. IP-Adresse, Browser- und Gerätedaten, Zeitpunkt des Aufrufs) und – sofern du dort angemeldet bist – deine Kontodaten. Ich habe auf diese Verarbeitung keinen Einfluss und erhalte diese Daten nicht. Es gilt die Datenschutzerklärung von Anthropic: https://www.anthropic.com/legal/privacy (Datenschutzbeauftragter: dpo@anthropic.com).`,
          `The game and the Studio are provided as an "artifact" on claude.ai. The platform is operated by Anthropic (for users in the EEA, the United Kingdom and Switzerland: Anthropic Ireland, Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4, D04 TR29, Ireland; otherwise Anthropic PBC, 548 Market St, PMB 90375, San Francisco, CA 94104, USA). When you open the page, Anthropic, as an independent controller, processes the technically necessary connection data (e.g. IP address, browser and device data, time of access) and — if you are signed in there — your account data. I have no influence on this processing and do not receive these data. Anthropic's privacy policy applies: https://www.anthropic.com/legal/privacy (data protection officer: dpo@anthropic.com).`],
        ['h', 'ds.h4', `4. Speicherung in deinem Browser (keine Cookies)`, `4. Storage in your browser (no cookies)`],
        ['p', 'ds.p4', `Das Spiel speichert Spielstände (Welten), Einstellungen (Grafik, Steuerung, Lautstärke, Sprache, dein gewählter Spielername, das Aussehen deiner Spielfigur, deine Antwort auf den Mehrspieler-Hinweis), Favoriten, Entwürfe und Bauteile des Studios ausschließlich lokal in deinem Browser (IndexedDB „r9si“ und localStorage mit dem Präfix „r9si.“). Diese Daten verlassen dein Gerät nicht, werden nicht an mich oder Dritte übermittelt und dienen keiner Wiedererkennung über das Spiel hinaus. Die Speicherung ist unbedingt erforderlich, um den von dir gewünschten Dienst – ein Spiel mit Spielständen – bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG); eine Einwilligung ist dafür nicht nötig. Du kannst alle Daten jederzeit löschen: Welten in der Weltenliste des Spiels („Delete“ bzw. 🗑), alles andere über die Funktion „Website-Daten löschen“ deines Browsers. Zur Wahl der Startsprache und der Grafikvoreinstellung liest das Spiel die Sprach- und Leistungsangaben deines Browsers (Sprache, Anzahl der Prozessorkerne, Arbeitsspeicher, Grafikchip); diese Werte werden nur lokal verwendet.`,
          `The game stores saved games (worlds), settings (graphics, controls, volume, language, your chosen player name, your character's look, your answer to the multiplayer notice), favourites, drafts and the Studio's building parts only locally in your browser (IndexedDB "r9si" and localStorage with the prefix "r9si."). These data do not leave your device, are not transmitted to me or to third parties and are not used to recognise you beyond the game. The storage is strictly necessary to provide the service you asked for — a game with saved games (§ 25 (2) no. 2 TDDDG, the German Telecommunications Digital Services Data Protection Act); no consent is needed for it. You can delete all data at any time: worlds in the game's world list ("Delete" or 🗑), everything else with your browser's "clear site data" function. To choose the starting language and the graphics preset, the game reads your browser's language and performance information (language, number of processor cores, memory, graphics chip); these values are only used locally.`],
        ['h', 'ds.h5', `5. Zusammen spielen (Mehrspieler) – nur mit eingeladenen Spielern`, `5. Playing together (multiplayer) — only with invited players`],
        ['p', 'ds.p5a', `Mehrspieler ist nur möglich, wenn der Inhaber des Spiels dich auf claude.ai zu diesem Artifact eingeladen hat und du dort angemeldet bist. Wer den öffentlichen Link ohne Einladung öffnet, spielt allein; es werden dann keine Daten ausgetauscht.`,
          `Multiplayer is only possible if the owner of the game has invited you to this artifact on claude.ai and you are signed in there. Anyone who opens the public link without an invitation plays alone; no data are exchanged then.`],
        ['p', 'ds.p5b', `Bevor andere deinen Namen sehen, fragt dich das Spiel einmal: „Mitspieler sehen deinen Namen“ – ✓ OK, ein Spitzname oder „Mehrspieler aus“. Bis dahin sendet das Spiel keinen Namen und teilt keine Welt; mit „Mehrspieler aus“ sendet es gar nichts.`,
          `Before others see your name, the game asks you once: "Other players see your name" — ✓ OK, a nickname or "Multiplayer off". Until then the game sends no name and shares no world; with "Multiplayer off" it sends nothing at all.`],
        ['p', 'ds.p5c', `Beim Zusammenspielen werden folgende Daten über die Echtzeit-Infrastruktur von claude.ai zwischen den Browsern der beteiligten Spieler ausgetauscht:`,
          `When playing together, the following data are exchanged between the browsers of the players involved, through claude.ai's real-time infrastructure:`],
        ['li', 'ds.l1', `dein Anzeigename (der Spitzname, den du wählst; ist keiner gesetzt, der Anzeigename deines claude.ai-Profils),`, `your display name (the nickname you choose; if none is set, the display name of your claude.ai profile),`],
        ['li', 'ds.l2', `das Aussehen deiner Spielfigur, deine Position und Blickrichtung im Spiel, das gehaltene Werkzeug, Lebenspunkte, Spielmodus und ein eventuell geflogenes Schiff,`, `your character's look, your position and view direction in the game, the tool you hold, health, game mode and a ship you may be flying,`],
        ['li', 'ds.l3', `Chatnachrichten, die du im Spiel schreibst,`, `chat messages you write in the game,`],
        ['li', 'ds.l4', `Name, Startwert (Seed) und Blockänderungen der Welt sowie – bei Gästen – das eigene Inventar, das der Gastgeber für den nächsten Besuch in seiner Welt aufbewahrt.`, `the world's name, seed and block changes and — for guests — their own inventory, which the host keeps in their world for the next visit.`],
        ['p', 'ds.p5d', `Die Daten werden nicht von mir gespeichert. Sie sind nur für die Spieler sichtbar, die dasselbe Spiel geöffnet haben, und werden gelöscht, sobald du die Seite verlässt. Der Gastgeber speichert das Inventar seiner Gäste lokal in seinem Browser, zugeordnet zu einer pseudonymen Kennung der Plattform (ersatzweise dem Anzeigenamen); eine Welt zu löschen löscht auch diese Einträge. Es besteht keine direkte Verbindung zwischen den Browsern der Spieler; IP-Adressen werden anderen Spielern nicht bekannt. Die Plattform kann dir deinen eigenen Spielstatus in deinem eigenen Claude-Gespräch anzeigen; anderen Nutzern wird er nicht weitergegeben.`,
          `I do not store these data. They are only visible to the players who have the same game open and are gone as soon as you leave the page. The host keeps their guests' inventories locally in the host's browser, assigned to a pseudonymous identifier of the platform (or, failing that, to the display name); deleting a world deletes these entries too. There is no direct connection between the players' browsers; other players never learn your IP address. The platform may show you your own game status in your own Claude conversation; it is not passed on to other users.`],
        ['p', 'ds.p5e', `Du kannst Mehrspieler jederzeit ausschalten (Einstellungen → Spiel → „Mehrspieler“) und einen Spitznamen statt deines Profilnamens wählen (Einstellungen → Spiel → Name).`,
          `You can switch multiplayer off at any time (Settings → Game → "Multiplayer") and choose a nickname instead of your profile name (Settings → Game → name).`],
        ['h', 'ds.h6', `6. Dateien, die du erzeugst`, `6. Files you create`],
        ['p', 'ds.p6', `Exporte (📦 R9-Paket, .schem, .vox, .json, Screenshots) sind Dateien, die du selbst erzeugst und speicherst. Sie enthalten Spielinhalte (Blöcke, Designs, Favoriten) und die Namen, die du deinen Entwürfen gibst – keine Kennungen deiner Person und keine Kontodaten. Was du davon weitergibst, entscheidest du: Teile nur, was dir gehört.`,
          `Exports (📦 R9 pack, .schem, .vox, .json, screenshots) are files you create and save yourself. They contain game content (blocks, designs, favourites) and the names you give your designs — no identifiers of you and no account data. What you pass on is up to you: share only what is yours.`],
        ['h', 'ds.h7', `7. Kinder und Jugendliche`, `7. Children and young people`],
        ['p', 'ds.p7', `Das Spiel erhebt keine Daten – auch nicht von Kindern. Ein Altersnachweis ist deshalb nicht nötig. Hinweis für Eltern: Der öffentliche Link kann ohne Konto geöffnet werden (Einzelspieler). Für das Zusammenspielen ist ein claude.ai-Konto nötig; Anthropic verlangt dafür ein Mindestalter von 18 Jahren. Im Mehrspieler ist der Anzeigename für die anderen eingeladenen Spieler sichtbar und es gibt einen Textchat zwischen diesen Spielern.`,
          `The game collects no data — not from children either, so no proof of age is needed. A note for parents: the public link can be opened without an account (single player). Playing together needs a claude.ai account; Anthropic requires a minimum age of 18 for it. In multiplayer the display name is visible to the other invited players, and there is a text chat between these players.`],
        ['h', 'ds.h8', `8. Deine Rechte`, `8. Your rights`],
        ['p', 'ds.p8', `Da ich keine personenbezogenen Daten von dir verarbeite, gibt es bei mir nichts, worüber ich dir Auskunft geben oder was ich löschen könnte; auf Anfrage bestätige ich dir das gern. Für die Verarbeitung durch Anthropic (Konto, Verbindungsdaten) wende dich bitte an Anthropic (siehe Abschnitt 3). Dir stehen die Rechte aus Art. 15–22 DSGVO zu; außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), insbesondere in dem Mitgliedstaat deines Aufenthaltsorts.`,
          `As I process no personal data about you, there is nothing I could give you information about or delete; on request I will gladly confirm this. For processing by Anthropic (account, connection data) please contact Anthropic (see section 3). You have the rights under Art. 15–22 GDPR; you can also lodge a complaint with a data protection supervisory authority (Art. 77 GDPR), in particular in the member state where you live.`],
        ['h', 'ds.h9', `9. Änderungen`, `9. Changes`],
        ['p', 'ds.p9', `Wenn das Spiel neue Funktionen bekommt, die etwas an dieser Erklärung ändern (z. B. der geplante Import von 3D-Modellen oder ein optionales Klangpaket, das beim Einschalten von einem Server geladen wird), wird diese Erklärung aktualisiert; das Datum oben zeigt den Stand.`,
          `If the game gets new features that change something in this policy (for example the planned import of 3D models, or an optional sound pack that is loaded from a server when switched on), this policy will be updated; the date at the top shows the version.`],
      ],
    },
    credits: {
      title: ['Credits', 'Credits'],
      blocks: [
        ['h2', 'cr.title', `R9-SI · Voxel Realm und R9 Studio`, `R9-SI · Voxel Realm and R9 Studio`],
        ['p', 'cr.copy', `© {year} {name}. Alle Rechte vorbehalten.`, `© {year} {name}. All rights reserved.`],
        ['p', 'cr.own', `Spielcode, Weltgenerator, Texturen, Modelle, Klänge und Musik sind selbst gemacht und werden beim Start prozedural erzeugt. Es sind keine fremden Bibliotheken, Bilder oder Tondateien enthalten.`,
          `Game code, world generator, textures, models, sounds and music are the author's own work and are generated procedurally at start. No third-party libraries, images or sound files are included.`],
        ['h', 'cr.fonts', `Schriften (SIL Open Font License 1.1)`, `Fonts (SIL Open Font License 1.1)`],
        ['p', 'cr.fontsP', `Die folgenden Schriften sind in die Seite eingebettet. Sie stehen unter der SIL Open Font License, Version 1.1 (https://openfontlicense.org), die das Bündeln mit Software erlaubt; die Schriften werden nicht verkauft und sind unverändert (Teilmenge der Google-Fonts-Ausgabe).`,
          `The following fonts are embedded in the page. They are licensed under the SIL Open Font License, Version 1.1 (https://openfontlicense.org), which allows bundling them with software; the fonts are not sold and are unmodified (a subset of the Google Fonts release).`],
        ['li', 'cr.f1', `Orbitron — Copyright 2018 The Orbitron Project Authors (https://github.com/theleagueof/orbitron), with Reserved Font Name "Orbitron". (Spiel)`, `Orbitron — Copyright 2018 The Orbitron Project Authors (https://github.com/theleagueof/orbitron), with Reserved Font Name "Orbitron". (game)`],
        ['li', 'cr.f2', `Rajdhani — Copyright (c) 2014, Indian Type Foundry (info@indiantypefoundry.com). (Spiel)`, `Rajdhani — Copyright (c) 2014, Indian Type Foundry (info@indiantypefoundry.com). (game)`],
        ['li', 'cr.f3', `Sora — Copyright 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font). (R9 Studio)`, `Sora — Copyright 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font). (R9 Studio)`],
        ['li', 'cr.f4', `JetBrains Mono — Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono). (R9 Studio)`, `JetBrains Mono — Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono). (R9 Studio)`],
        ['small', 'cr.ofl', `This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org`, `This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org`],
        ['imports'],
      ],
    },
    hinweis: {
      title: ['Hinweis', 'Notice'],
      blocks: [
        ['h', 'hw.h1', `Ein eigenständiges Werk`, `An independent work`],
        ['p', 'hw.p1', `R9-SI und R9 Studio sind ein eigenständiges, unabhängiges Werk: ein eigenes Voxelspiel, inspiriert vom Genre der Block-Sandbox-Spiele. Sie sind mit keiner anderen Spielefirma verbunden und werden von keiner genehmigt, gesponsert oder unterstützt.`,
          `R9-SI and R9 Studio are an independent work: an original voxel game inspired by the block sandbox genre. They are not affiliated with, endorsed, sponsored or approved by any other game company.`],
        ['h', 'hw.h2', `Marken und Kompatibilität`, `Trademarks and compatibility`],
        ['p', 'hw.mc', `NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.`, `NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.`],
        ['p', 'hw.p2', `R9-SI ist kein offizielles Minecraft-Produkt und ist weder von Mojang noch von Microsoft genehmigt oder mit ihnen verbunden. Minecraft ist eine Marke von Mojang. WorldEdit, Amulet, Axiom, Litematica, MCEdit und MagicaVoxel sind Namen bzw. Marken ihrer jeweiligen Inhaber; sie werden nur genannt, um zu beschreiben, welche Dateiformate das Studio lesen und schreiben kann.`,
          `Minecraft is a trademark of Mojang. WorldEdit, Amulet, Axiom, Litematica, MCEdit and MagicaVoxel are names or trademarks of their respective owners; they are named only to describe which file formats the Studio can read and write.`],
      ],
    },
  };
  const secTitle = (s, want) => raw('tab.' + s, TX[s].title[0], TX[s].title[1], want);

  // ---------------------------------------------------------------- imported things (VR.Credits, the planned import)
  // an entry: the import record ({name, kind, src: {title, author, url, license, tier}}) or the same fields flat;
  // tier 'local' („Nur für dich") is listed but never shared. CC BY lines carry T-A-S-L and the change.
  const LIC_URL = { 'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/', 'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/' };
  const licUrl = (l) => LIC_URL[String(l || '').toUpperCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim()] || '';
  function importList() {
    const C = VR.Credits; if (!C || typeof C.list !== 'function') return null;
    let a = []; try { a = C.list(); } catch (e) { a = []; }
    return Array.isArray(a) ? a.filter(e => e && typeof e === 'object') : [];
  }
  function creditLine(e, want) {
    const s = e.src && typeof e.src === 'object' ? e.src : e;
    const de = langOf(want) === 'de', q = (t) => (de ? '„' + t + '“' : '"' + t + '"');
    const title = String(s.title || e.name || '?'), author = String(s.author || ''), url = String(s.url || s.source || ''), lic = String(s.license || e.license || ''), tier = s.tier || e.tier || '';
    if (tier === 'local') return q(title) + ' · ' + T('cr.local', 'nur lokal (die Lizenz erlaubt keine Weitergabe) – erscheint nicht in 📦 Paketen', 'local only (the licence does not allow passing it on) — never in 📦 packs', null, want);
    let first = q(title) + (author ? ' ' + T('cr.by', 'von', 'by', null, want) + ' ' + author : '') + (url ? ' (' + url + ')' : '');
    const out = [first];
    if (lic) { const u = s.licenseUrl || e.licenseUrl || licUrl(lic); out.push(lic + (u ? ' (' + u + ')' : '')); }
    const mod = e.modified !== undefined ? e.modified : /^(ding|figur|tier|model)$/.test(e.kind || 'ding');
    if (mod) out.push(typeof mod === 'string' ? T('cr.modS', 'geändert: {m}', 'modified: {m}', { m: mod }, want) : T('cr.mod', 'geändert: als Voxelmodell umgesetzt', 'modified: turned into a voxel model', null, want));
    return out.join(' · ');
  }
  // the computed blocks as [type, plain text] pairs in the language (items() escapes them for the page — import
  // titles, authors and links come from other people's files); the owner block: its lines, already safe for `html`
  function special(type, want, html) {
    const lang = langOf(want), V = vars(lang, html), e = (s) => (html ? esc(s) : s);
    if (type === 'warn') return L.incomplete() ? [['warn', T('warn', '⚠ Vor dem öffentlichen Start ausfüllen: Name, Anschrift und E-Mail sind noch Platzhalter (OWNER in src/main/legal.js). Nichts erfinden — ohne echte Angaben ist das Impressum unvollständig.', '⚠ To fill in before the public launch: name, address and e-mail are still placeholders (OWNER in src/main/legal.js). Never invent them — without real details the Impressum is incomplete.', null, want)]] : [];
    if (type === 'owner') return [['owner', [V.name, detail('address', lang, html, true), e(T('imp.country', 'Deutschland', 'Germany', null, want)), e(T('imp.contact', 'Kontakt:', 'Contact:', null, want)) + ' ' + V.email]]];
    if (type === 'imports') {
      const list = importList(); if (!list) return [];
      const out = [['h', T('cr.imp', 'Importierte Dinge', 'Imported things', null, want)]];
      if (!list.length) out.push(['p', T('cr.none', 'Noch nichts importiert.', 'Nothing imported yet.', null, want)]);
      for (const e of list) out.push(['li', creditLine(e, want)]);
      out.push(['small', T('cr.attest', 'Du bist dafür verantwortlich, dass die angegebene Lizenz stimmt; das Spiel kann sie nicht prüfen.', 'You are responsible for the licence you state being correct; the game cannot check it.', null, want)]);
      return out;
    }
    return [];
  }

  // ---------------------------------------------------------------- render: plain text and HTML
  const linkify = (h) => h.replace(/https?:\/\/[^\s<>()"]*[^\s<>()".,;:]/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  function items(sec, want, html) {
    const lang = langOf(want), V = vars(lang, html), out = [];
    for (const b of TX[norm(sec)].blocks) {
      if (b.length === 1) { for (const [type, t] of special(b[0], want, html)) out.push([type, type === 'owner' || !html ? t : linkify(esc(t))]); continue; }
      const t = raw(b[1], b[2], b[3], want);
      out.push([b[0], html ? fill(linkify(esc(t)), V) : fill(t, V)]);
    }
    return out;
  }
  // a section as plain text (the copy, the tests); lang 'de' | 'en' | undefined (the page's)
  L.text = function (sec, lang) {
    sec = norm(sec);
    let s = secTitle(sec, lang).toUpperCase(), prev = '';
    for (const [type, t] of items(sec, lang, false)) {
      const line = type === 'owner' ? t.filter(Boolean).join('\n') : type === 'li' ? '– ' + t : t;
      s += (type === 'li' && prev === 'li' ? '\n' : '\n\n') + line;   // list items stay together, the rest are paragraphs
      prev = type;
    }
    return s;
  };
  L.plain = function (lang) {
    const head = 'R9-SI · R9 Studio — ' + SECTIONS.map(s => secTitle(s, lang)).join(' · ');
    return head + '\n\n' + SECTIONS.map(s => L.text(s, lang)).join('\n\n\n') + '\n';
  };
  L.html = function (sec) {
    const out = []; let ul = false;
    for (const [type, t] of items(sec, null, true)) {
      if (type !== 'li' && ul) { out.push('</ul>'); ul = false; }
      if (type === 'li') { if (!ul) { out.push('<ul>'); ul = true; } out.push(`<li>${t}</li>`); }
      else if (type === 'h2') out.push(`<h2>${t}</h2>`);
      else if (type === 'h') out.push(`<h3>${t}</h3>`);
      else if (type === 'small') out.push(`<p class="lg-small">${t}</p>`);
      else if (type === 'warn') out.push(`<p class="lg-warn">${t}</p>`);
      else if (type === 'owner') out.push(`<address class="lg-owner">${t.join('<br>')}</address>`);
      else out.push(`<p>${t}</p>`);
    }
    if (ul) out.push('</ul>');
    return out.join('');
  };

  // ---------------------------------------------------------------- small texts for the pages
  L.label = () => T('btn', '📜 Impressum & Datenschutz', '📜 Legal notice & privacy');
  L.short = () => T('btnShort', '📜 Impressum', '📜 Legal');
  L.tip = () => T('btnT', 'Impressum · Datenschutz · Credits · Hinweis', 'Legal notice (Impressum) · Privacy · Credits · Notice');
  // one line at every export / share (📦 Mitnehmen, ⬇ .schem / .vox / .json, Bauteile) — no dialog
  L.shareHint = (lang) => T('share', 'Teile nur, was dir gehört — Bilder und Modelle anderer brauchen deren Erlaubnis.', 'Share only what is yours — other people\'s pictures and models need their permission.', null, lang);

  // ---------------------------------------------------------------- the overlay
  let root = null, cur = 'impressum', opener = null, hooked = false;
  const $ = (s) => (root ? root.querySelector(s) : null);
  // a language change elsewhere (the 🌐 picker, another tab): the buttons and an open overlay follow
  function hookLang() {
    if (hooked || !VR.I18N || !VR.I18N.on) return;
    hooked = true;
    VR.I18N.on(() => { relabel(); if (L.isOpen() && !L.lang) draw(); });
  }
  function relabel() {
    if (!HAS_DOM) return;
    for (const b of document.querySelectorAll('[data-legal]')) { b.textContent = b.dataset.legal === 'short' ? L.short() : L.label(); b.title = L.tip(); }
  }
  function msg(t) { const m = $('.lg-msg'); if (m) m.textContent = t || ''; }
  function build() {
    root = document.createElement('div'); root.id = 'r9legal';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'r9legalT');
    root.innerHTML = '<div class="lg-box"><div class="lg-head"><b class="lg-title" id="r9legalT"></b><div class="lg-tabs" role="tablist"></div>'
      + '<div class="lg-tools"><span class="lg-lang"><button type="button" data-lang="de" lang="de">DE</button><button type="button" data-lang="en" lang="en">EN</button></span>'
      + '<button type="button" class="lg-copy" data-act="copy">📋</button><button type="button" class="lg-x" data-act="close">✕</button></div></div>'
      + '<div class="lg-body" tabindex="0"></div><div class="lg-foot"><span class="lg-msg" aria-live="polite"></span></div></div>';
    root.addEventListener('click', (e) => {
      if (e.target === root) { L.close(); return; }        // a click beside the box
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sec) { cur = b.dataset.sec; draw(); }
      else if (b.dataset.lang) { L.lang = b.dataset.lang; draw(); }
      else if (b.dataset.act === 'copy') L.copy();
      else if (b.dataset.act === 'close') L.close();
    });
    // nothing below (the game's canvas, the Studio's view) gets the pointer while this is open
    for (const t of ['mousedown', 'pointerdown', 'wheel']) root.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
    document.body.appendChild(root);
  }
  function draw() {
    if (!root) return;
    const lang = langOf();
    root.lang = lang;
    $('.lg-title').textContent = T('title', '📜 Rechtliches', '📜 Legal');
    const tabs = $('.lg-tabs'); tabs.innerHTML = '';
    for (const s of SECTIONS) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.sec = s; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', s === cur ? 'true' : 'false'); b.className = s === cur ? 'on' : ''; b.textContent = secTitle(s);
      tabs.appendChild(b);
    }
    for (const b of root.querySelectorAll('[data-lang]')) { b.classList.toggle('on', b.dataset.lang === lang); b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false'); }
    $('.lg-copy').title = T('copyT', 'Impressum, Datenschutz, Credits und Hinweis als Text kopieren', 'Copy the legal notice, privacy, credits and notice as text');
    $('.lg-x').title = T('closeT', 'Schließen (Esc)', 'Close (Esc)');
    const body = $('.lg-body'); body.innerHTML = L.html(cur); body.scrollTop = 0; body.dataset.sec = cur;
    root.dataset.sec = cur;
  }
  L.open = function (sec) {
    if (!HAS_DOM || !document.body) return false;
    hookLang();
    if (!root) build();
    if (!L.isOpen()) opener = document.activeElement;
    cur = norm(sec);
    root.classList.add('on');
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* not locked */ }
    msg(''); draw();
    const t = $('.lg-tabs .on'); if (t) t.focus();
    return true;
  };
  L.isOpen = () => !!(root && root.classList.contains('on'));
  L.section = () => cur;
  L.close = function () {
    if (!L.isOpen()) return false;
    root.classList.remove('on'); msg('');
    const o = opener; opener = null;
    try { if (o && o.focus && document.contains(o)) o.focus(); } catch (e) { /* gone */ }
    return true;
  };
  // 📋 everything as plain text: the clipboard, else the old copy command, else the text selected to copy by hand
  L.copy = async function () {
    const text = L.plain();
    L.copied = text;
    let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
    if (!ok && root) {
      try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; root.appendChild(ta); ta.select(); ok = !!document.execCommand('copy'); ta.remove(); } catch (e) { ok = false; }
    }
    if (!ok && root) {
      const body = $('.lg-body'); body.innerHTML = '<textarea class="lg-all" readonly></textarea>';
      const ta = body.firstChild; ta.value = text; ta.focus(); ta.select();
    }
    msg(ok ? T('copied', '📋 Kopiert: Impressum, Datenschutz, Credits und Hinweis', '📋 Copied: legal notice, privacy, credits and notice') : T('copyHand', 'Automatisches Kopieren ist hier gesperrt — der Text ist markiert: Strg+C', 'Copying is blocked here — the text is selected: press Ctrl+C'));
    return ok;
  };
  // Esc closes; while it is open no key reaches the game or the Studio below (a capture listener on the window,
  // registered before theirs: legal.js comes first in both pages)
  if (HAS_DOM) window.addEventListener('keydown', (e) => {
    if (!L.isOpen()) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); L.close(); return; }
    const a = document.activeElement;
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && a && a.dataset && a.dataset.sec) {
      e.preventDefault();
      const i = (SECTIONS.indexOf(a.dataset.sec) + (e.key === 'ArrowRight' ? 1 : SECTIONS.length - 1)) % SECTIONS.length;
      cur = SECTIONS[i]; draw(); const t = $('.lg-tabs .on'); if (t) t.focus();
    }
  }, true);

  // ---------------------------------------------------------------- 📜 buttons
  // the pause menu, the settings (next to Done) and the Studio's header carry one; `short` is the Studio's
  L.button = function (cls, short) {
    hookLang();
    const b = document.createElement('button'); b.type = 'button';
    b.className = ((cls || '') + ' r9legal-btn').trim(); b.dataset.legal = short ? 'short' : '1';
    b.textContent = short ? L.short() : L.label(); b.title = L.tip();
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); L.open('impressum'); });
    return b;
  };
  L.mountStudio = function () {
    if (!HAS_DOM) return false;
    const h = document.querySelector('#studio > header'); if (!h) return false;
    if (!h.querySelector('[data-legal]')) h.appendChild(L.button('lg-hdr', true));
    return true;
  };
  if (HAS_DOM) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => L.mountStudio()); else L.mountStudio(); }

  // ---------------------------------------------------------------- 👥 the multiplayer name notice
  // mp.js decides (noticeOk / confirmNotice / turnOff / turnOn); this is what the player sees: in the title's
  // multiplayer box, the pause menu's and the settings — „👥 Mitspieler sehen deinen Namen: X — ✓ OK · Spitzname… ·
  // Mehrspieler aus", or with multiplayer off: one line and „Mehrspieler an"
  let nick = false;
  const elx = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const btnx = (cls, text, fn) => { const b = elx('button', cls, text); b.type = 'button'; b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); return b; };
  function refresh(g) {
    const ui = g && g.ui; if (!ui) return;
    try { if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.mpnotice')) document.activeElement.blur(); } catch (e) { /* */ }
    try {
      if (ui.renderHosts) ui.renderHosts();
      if (ui.screen === 'pause' && ui.buildMpPanel) ui.buildMpPanel();
      if (ui.screen === 'settings' && ui.showSettings) ui.showSettings();
    } catch (e) { console.warn('legal refresh', e); }
  }
  L.mpHint = () => T('mp.hint', '👥 Freunde sind online — damit sie mitspielen können: Esc → 👥 Mehrspieler und einmal ✓ OK (dann sehen sie deinen Namen).', '👥 Friends are online — to let them join: Esc → 👥 Multiplayer and ✓ OK once (then they see your name).');
  L.mpNotice = function (g, withHead) {
    const box = elx('div', 'mpnotice'), mp = g && g.mp;
    if (withHead) box.appendChild(elx('div', 'subtitle', '👥 ' + T('mp.head', 'Mehrspieler', 'Multiplayer')));
    if (!mp) return box;
    const small = withHead ? 'btn small' : 'btn tiny';
    if (mp.status === 'off') {
      box.classList.add('off');
      box.appendChild(elx('div', 'mpn-t', '👥 ' + T('mp.offLine', 'Mehrspieler ist aus — das Spiel sendet nichts.', 'Multiplayer is off — the game sends nothing.')));
      const r = elx('div', 'mpn-b'); r.appendChild(btnx(small, T('mp.on', 'Mehrspieler an', 'Turn multiplayer on'), () => { Promise.resolve(mp.turnOn()).then(() => refresh(g), () => refresh(g)); refresh(g); })); box.appendChild(r);
      return box;
    }
    if (mp.noticeAsk) box.classList.add('ask');
    const t = elx('div', 'mpn-t', '👥 ' + T('mp.notice', 'Mitspieler sehen deinen Namen:', 'Other players see your name:') + ' ');
    t.appendChild(elx('b', '', mp.myName ? mp.myName() : ''));
    box.appendChild(t);
    if (mp.noticeAsk) box.appendChild(elx('div', 'mpn-ask', T('mp.ask', 'Erst bestätigen — dann kannst du beitreten.', 'Confirm first — then you can join.')));
    const r = elx('div', 'mpn-b');
    if (nick) {
      const inp = elx('input', 'mpn-nick'); inp.type = 'text'; inp.maxLength = 24; inp.placeholder = T('mp.nickPh', 'Spitzname', 'Nickname'); inp.value = (g.settings && g.settings.playerName) || '';
      inp.setAttribute('aria-label', T('mp.nickPh', 'Spitzname', 'Nickname'));
      const take = () => {
        const v = inp.value.replace(/[<>]/g, '').trim().slice(0, 24);
        if (!v) { inp.focus(); return; }
        g.settings.playerName = v; if (g.saveSettings) g.saveSettings();
        nick = false; mp.confirmNotice(); refresh(g);
      };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); take(); } else if (e.key === 'Escape') { e.preventDefault(); nick = false; refresh(g); } });
      r.appendChild(inp);
      r.appendChild(btnx(small + ' primary', '✓', take));
      r.appendChild(btnx(small, '✕', () => { nick = false; refresh(g); }));
      box.appendChild(r);
      setTimeout(() => { if (inp.isConnected) inp.focus(); }, 0);
      return box;
    }
    r.appendChild(btnx(small + ' primary', '✓ OK', () => { mp.confirmNotice(); refresh(g); }));
    r.appendChild(btnx(small, T('mp.nick', 'Spitzname…', 'Nickname…'), () => { nick = true; refresh(g); }));
    r.appendChild(btnx(small, T('mp.off', 'Mehrspieler aus', 'Multiplayer off'), () => { mp.turnOff(); refresh(g); }));
    const more = btnx(small + ' mpn-more', '📜', () => L.open('datenschutz')); more.title = T('mp.more', 'Datenschutz: was beim Zusammenspielen ausgetauscht wird', 'Privacy: what is exchanged when playing together');
    r.appendChild(more);
    box.appendChild(r);
    return box;
  };
  // Settings → Game: 👥 Mehrspieler an / aus (aus: no presence at all, from the next start no connection), and the
  // notice when it was never answered
  L.mpToggle = function (g) {
    const mp = g && g.mp, wrap = elx('div', 'mpset');
    if (!mp) return wrap;
    const lab = elx('label', 'row gap note'); lab.style.margin = '6px 0';
    const cb = elx('input'); cb.type = 'checkbox'; cb.checked = mp.status !== 'off'; cb.dataset.mpToggle = '1';
    lab.appendChild(cb); lab.appendChild(document.createTextNode(' 👥 ' + T('mp.toggle', 'Mehrspieler (mit eingeladenen Freunden) — aus: das Spiel sendet nichts', 'Multiplayer (with invited friends) — off: the game sends nothing')));
    cb.addEventListener('change', () => { if (cb.checked) Promise.resolve(mp.turnOn()).then(() => refresh(g), () => refresh(g)); else mp.turnOff(); refresh(g); });
    wrap.appendChild(lab);
    if (mp.ready && mp.noticeOk && !mp.noticeOk()) wrap.appendChild(L.mpNotice(g));
    return wrap;
  };
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));
