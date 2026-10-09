// ============================================================================
// The German display names of the furniture and model pack (VM.define: the
// voxfurn, voxfacade and voxmodern families). The ids and the English names
// stay as they are — "Three-seater · charcoal" reads "Dreisitzer · anthrazit" in
// German. VR.dispName(name) translates a name at the moment it is shown (the
// game's inventory tooltips, the Studio's cards and breadcrumbs) and only when
// the language is German; English keeps the data as it is.
// A name is cut at " · " into segments; a whole segment is looked up in PHRASE
// first (multi-word names such as "Dining Table"), else it is translated word by
// word from WORD ("&" and numbers stay). test/model_names_de.js lists every word
// without a German text and fails above 5 %.
// ============================================================================
(function (VR) {
  'use strict';
  // whole segments (case-sensitive, as the data writes them)
  const PHRASE = {
    'Palm Crown': 'Palmenkrone', 'Round Tree Small': 'Rundbaum klein', 'Round Tree Large': 'Rundbaum groß', 'Grass Tuft': 'Grasbüschel',
    'Flower Cluster': 'Blumenbüschel', 'Blossom Bush': 'Blütenbusch', 'Rice Row Crop': 'Reisreihen-Feld',
    'Glass Stair Tread': 'Glas-Treppenstufe', 'Light Pad': 'Lichtsockel', 'Nova Window': 'Nova-Fenster', 'Orange Frame': 'oranger Rahmen',
    'Arched Window': 'Bogenfenster', 'Stained Glass': 'Buntglas', 'Town Lamp': 'Stadtlaterne', 'Striped Awning': 'Streifenmarkise',
    'Shop Sign': 'Ladenschild', 'Market Stall': 'Marktstand', 'Town Fountain': 'Stadtbrunnen', 'Gold Band': 'Goldband', 'White Stone': 'weißer Stein',
    'Blue': 'Blau', 'Gold': 'Gold', 'Rose': 'Rosé', 'Amber': 'Bernstein', 'Teal': 'Petrol', 'Bread': 'Brot', 'Cup': 'Tasse', 'Book': 'Buch', 'Flower': 'Blume',
    'Three Wide': 'drei breit', 'Bakery': 'Bäckerei', 'Sweets': 'Konditorei', 'Tea Room': 'Teestube', 'Cheese': 'Käse', 'Flowers': 'Blumen', 'Tailor': 'Schneider',
    'Pharmacy': 'Apotheke', 'Lanterns': 'Laternen', 'Books': 'Buchladen', 'Workshop': 'Werkstatt', 'Maps': 'Karten', 'Café': 'Café',
    'Nova Slab Edge': 'Nova-Deckenkante', 'Light Line': 'Lichtlinie', 'Nova Glass Sheet': 'Nova-Glasscheibe',
    'Three-seater': 'Dreisitzer', 'Chaise': 'Chaiselongue', 'Armchair': 'Sessel', 'Coffee Table': 'Couchtisch',
    'Side Table': 'Beistelltisch', 'Dining Table': 'Esstisch', 'Dining Chair': 'Esszimmerstuhl', 'Bar Stool': 'Barhocker',
    'Desk': 'Schreibtisch', 'Office Chair': 'Bürostuhl', 'TV Lowboard': 'TV-Lowboard', 'Wall TV 65"': 'Wand-TV 65"',
    'Bookcase': 'Bücherregal', 'Floating Shelf': 'Schweberegal', 'Wardrobe': 'Kleiderschrank', 'Nightstand & Lamp': 'Nachttisch & Lampe',
    'Console Table': 'Konsolentisch', 'Coat Rack & Bench': 'Garderobe & Bank', 'Kitchen Island': 'Kücheninsel', 'Fridge': 'Kühlschrank',
    'Washing Machine': 'Waschmaschine', 'Double Bed': 'Doppelbett', 'Single Bed': 'Einzelbett', 'Bed Bench': 'Bettbank',
    'Floor Mirror': 'Standspiegel', 'Curtain': 'Vorhang', 'Freestanding Tub': 'Freistehende Wanne', 'Vanity & Mirror': 'Waschtisch & Spiegel',
    'Wall-hung Toilet': 'Wand-WC', 'Walk-in Shower': 'Walk-in-Dusche', 'Arc Floor Lamp': 'Bogenstehlampe', 'Pendant': 'Pendelleuchte',
    'Chandelier': 'Kronleuchter', 'Table Lamp': 'Tischlampe', 'Olive Tree': 'Olivenbaum', 'Fireplace': 'Kamin', 'Grand Piano': 'Flügel',
    'Sun Lounger': 'Sonnenliege', 'Garden Table': 'Gartentisch', 'Garden Chair': 'Gartenstuhl', 'Gas BBQ': 'Gasgrill',
    'Planter': 'Pflanzkübel', 'Tripod Floor Lamp': 'Dreibein-Stehlampe', 'Dresser': 'Kommode', 'Round Mirror': 'Runder Spiegel',
    'Heated Towel Rail': 'Beheizter Handtuchhalter', 'Laundry Basket': 'Wäschekorb', 'Bar Cart': 'Barwagen', 'Dining Bench': 'Essbank',
    'Range Hood': 'Dunstabzug', 'Kitchen Shelf & Jars': 'Küchenregal & Gläser', 'Toy Box': 'Spielzeugkiste', 'Bunk Bed': 'Etagenbett',
    'Cantilever Parasol': 'Ampelschirm', 'Fire Pit': 'Feuerstelle', 'Outdoor Sofa': 'Gartensofa', 'Gutter': 'Dachrinne',
    'Downpipe': 'Fallrohr', 'Wall Lantern': 'Wandlaterne', 'House Number': 'Hausnummer', 'Letterbox': 'Briefkasten',
    'Garage Door': 'Garagentor', 'Pendant Globe': 'Kugel-Pendelleuchte', 'Pendant Dome': 'Kuppel-Pendelleuchte',
    'Pendant Cone': 'Kegel-Pendelleuchte', 'Pendant Tube': 'Röhren-Pendelleuchte', 'Pendant Halo': 'Ring-Pendelleuchte',
    'Floor Lamp Globe': 'Kugel-Stehlampe', 'Floor Uplight': 'Uplight-Stehleuchte', 'Table Lamp Mushroom': 'Pilz-Tischlampe',
    'Table Lamp Globe': 'Kugel-Tischlampe', 'Wall Lamp Up-Down': 'Up-Down-Wandleuchte', 'Wall Lamp Swing Arm': 'Schwenkarm-Wandleuchte',
    'Wall Lamp LED Bar': 'LED-Leisten-Wandleuchte', 'Smart Speaker': 'Smart-Lautsprecher', 'Smart Display': 'Smart-Display',
    'Smart Wall Panel': 'Smart-Wandpanel', 'Smart Thermostat': 'Smart-Thermostat', 'WiFi Router': 'WLAN-Router', 'Mesh WiFi': 'Mesh-WLAN',
    'Video Doorbell': 'Video-Türklingel', 'Security Camera': 'Sicherheitskamera', 'Robot Vacuum': 'Saugroboter',
    'Air Purifier': 'Luftreiniger', 'Bladeless Fan': 'Flügelloser Ventilator', 'Heat Pump': 'Wärmepumpe', 'Home Battery': 'Heimspeicher',
    'Solar Inverter': 'Solar-Wechselrichter', 'Espresso Machine': 'Espressomaschine', 'Stand Mixer': 'Küchenmaschine',
    'Wine Cooler': 'Weinkühler', 'Fridge French Door': 'French-Door-Kühlschrank', 'Coffee Bar': 'Kaffeebar', 'Island Hood': 'Insel-Dunstabzug',
    'Counter Stool': 'Theken-Hocker', 'Sofa 2-Seater': 'Zweisitzer-Sofa', 'Sofa 3-Seater': 'Dreisitzer-Sofa',
    'Modular Sofa Bouclé': 'Modulsofa Bouclé', 'Modular Sofa Graphite': 'Modulsofa Graphit', 'Lounge Chair': 'Loungesessel',
    'Cocktail Chair': 'Cocktailsessel', 'Media Wall': 'Medienwand', 'Nesting Tables': 'Satztische', 'Rug': 'Teppich',
    'Wall Shelf System': 'Wandregalsystem', 'Boxspring Bed': 'Boxspringbett', 'LED Bed': 'LED-Bett', 'House Bed': 'Hausbett',
    'Clothes Rail': 'Kleiderstange', 'Double Vanity': 'Doppelwaschtisch', 'Shower Column': 'Duschsäule', 'Towel Ladder': 'Handtuchleiter',
    'Mirror Cabinet': 'Spiegelschrank', 'Washer Tower': 'Waschturm', 'Bathtub': 'Badewanne', 'Bath Stool': 'Badehocker',
    'Towel Radiator': 'Handtuchheizkörper', 'Fiddle Leaf Fig': 'Geigenfeige', 'Snake Plant': 'Bogenhanf',
    'Bird of Paradise': 'Strelitzie', 'Kentia Palm': 'Kentiapalme', 'Rubber Plant': 'Gummibaum', 'ZZ Plant': 'ZZ-Pflanze',
    'Column Cactus': 'Säulenkaktus', 'Standing Desk': 'Stehpult', 'Gaming Desk': 'Gaming-Schreibtisch', 'Gaming Chair': 'Gamingstuhl',
    'PC Tower': 'PC-Tower', 'Filing Cabinet': 'Aktenschrank', 'Printer Cabinet': 'Druckerschrank', 'Meeting Table': 'Besprechungstisch',
    'Phone Booth': 'Telefonbox', 'Server Rack': 'Serverschrank', 'Video Screen': 'Videowand', 'Acoustic Panels': 'Akustikpaneele',
    'Laptop Desk': 'Laptoptisch', '3D Printer': '3D-Drucker', 'Coffee Machine': 'Kaffeemaschine', 'Office Lockers': 'Spinde',
    'Hot Tub': 'Whirlpool', 'Pool Ladder': 'Poolleiter', 'Pool Shower': 'Poolbrause', 'Pool Float': 'Poolfigur', 'Daybed': 'Tagesbett',
    'Garden Sofa': 'Gartensofa', 'Garden Lounge Chair': 'Gartenlounge-Sessel', 'Garden Dining Set': 'Gartenessgruppe',
    'Fire Table': 'Feuertisch', 'Outdoor Kitchen': 'Outdoor-Küche', 'Kamado Grill': 'Kamadogrill', 'Raised Bed': 'Hochbeet',
    'Garden Light': 'Gartenleuchte', 'Robot Mower': 'Mähroboter', 'Hanging Egg Chair': 'Hängeei-Sessel', 'Water Feature': 'Wasserspiel',
    'Cargo Bike': 'Lastenrad', 'E-Scooter': 'E-Scooter', 'Scooter Dock': 'Scooter-Station', 'Wallbox': 'Wallbox',
    'Charging Pillar': 'Ladesäule', 'Bike Rack': 'Fahrradständer', 'E-Moped': 'E-Moped', 'Bus Shelter': 'Bushaltestelle',
    'Parcel Locker': 'Paketstation', 'Bike Shed': 'Fahrradschuppen', 'Skateboard & Helmet': 'Skateboard & Helm',
    'Café Counter': 'Café-Theke', 'Pastry Display': 'Gebäckvitrine', 'Café Table': 'Café-Tisch', 'Café Chair': 'Café-Stuhl',
    'Bar Table': 'Bartisch', 'Menu Board': 'Menütafel', 'Neon Sign': 'Neonschild', 'Shop Shelf': 'Ladenregal',
    'Display Table': 'Auslagetisch', 'Checkout Counter': 'Kassentheke', 'Mannequin': 'Schaufensterpuppe', 'Clothing Rail': 'Kleiderständer',
    'Drinks Fridge': 'Getränkekühlschrank', 'Vending Machine': 'Automat', 'Gelato Freezer': 'Gelato-Truhe',
    'Self-Order Kiosk': 'Bestellterminal', 'Booth Bench': 'Nischenbank', 'Bread Shelf': 'Brotregal', 'Pizza Oven': 'Pizzaofen',
    'concrete pot': 'Betontopf', 'terracotta pot': 'Terrakottatopf',
    'Canvas': 'Leinwand', 'Floor Vase': 'Bodenvase', 'Vases': 'Vasen', 'Neon Art': 'Neonkunst', 'Candles': 'Kerzen',
    'Room Divider': 'Raumteiler', 'Floor Globe': 'Kugel-Bodenleuchte', 'Bust': 'Büste', 'Macramé': 'Makramee',
    'Record Player': 'Plattenspieler', 'Aquarium': 'Aquarium', 'Sculpture': 'Skulptur', 'Art': 'Kunst', 'Kitchen': 'Küche',
    'Monstera': 'Monstera', 'Pouf': 'Pouf', 'Sideboard': 'Sideboard', 'Parasol': 'Sonnenschirm', 'Pergola': 'Pergola',
    'Hammock': 'Hängematte', 'Pinboard': 'Pinnwand', 'Whiteboard': 'Whiteboard', 'Monitor': 'Monitor', 'Kettle': 'Wasserkocher',
    'Toaster': 'Toaster', 'Microwave': 'Mikrowelle', 'Dishwasher': 'Geschirrspüler', 'Bike': 'Fahrrad', 'Toilet': 'Toilette',
    'Shower': 'Dusche', 'Towel': 'Handtuch', 'Lamp': 'Lampe', 'Shelf': 'Regal', 'Bench': 'Bank', 'Stool': 'Hocker', 'Sofa': 'Sofa',
    'Table': 'Tisch', 'Chair': 'Stuhl', 'Bed': 'Bett', 'Window': 'Fenster', 'Door': 'Tür', 'Wall': 'Wand', 'Floor': 'Boden',
    'Plant': 'Pflanze', 'Pot': 'Topf', 'Cabinet': 'Schrank', 'Unit': 'Einheit', 'Mirror': 'Spiegel', 'Speaker': 'Lautsprecher',
    'Camera': 'Kamera', 'Printer': 'Drucker', 'Laptop': 'Laptop', 'Phone': 'Telefon', 'Screen': 'Bildschirm', 'Desk': 'Schreibtisch',
    'Tree': 'Baum', 'Grill': 'Grill', 'Bar': 'Bar', 'Box': 'Box', 'Cart': 'Wagen', 'Rack': 'Ständer', 'Rail': 'Stange',
    'Stand': 'Ständer', 'Light': 'Leuchte', 'Lantern': 'Laterne', 'Number': 'Nummer', 'Tub': 'Wanne', 'Piano': 'Klavier',
    'Vanity': 'Waschtisch', 'Display': 'Display', 'Panel': 'Paneel', 'Tower': 'Turm', 'Bike Shed': 'Fahrradschuppen',
  };
  // one word or a part of a segment (lower case; "&", numbers and the names in KEEP stay as they are)
  const WORD = {
    'Palm': 'Palm', 'Crown': 'Krone', 'Round': 'Rund', 'Tree': 'Baum', 'Small': 'klein', 'Large': 'groß', 'Grass': 'Gras', 'Tuft': 'Büschel',
    'Flower': 'Blumen', 'Cluster': 'Büschel', 'Blossom': 'Blüten', 'Bush': 'Busch', 'Rice': 'Reis', 'Row': 'Reihe', 'Crop': 'Feld',
    // colours and materials
    'black': 'schwarz', 'white': 'weiß', 'grey': 'grau', 'charcoal': 'anthrazit', 'anthracite': 'anthrazit', 'cream': 'creme',
    'taupe': 'taupe', 'sage': 'salbei', 'navy': 'marineblau', 'mustard': 'senf', 'rose': 'rosé', 'olive': 'oliv',
    'terracotta': 'Terrakotta', 'concrete': 'Beton', 'graphite': 'graphit', 'greige': 'greige', 'sand': 'sand', 'green': 'grün',
    'red': 'rot', 'mint': 'mint', 'flamingo': 'Flamingo', 'cognac': 'Cognac', 'opal': 'Opal', 'bronze': 'Bronze', 'chrome': 'Chrom',
    'brass': 'Messing', 'steel': 'Stahl', 'glass': 'Glas', 'stone': 'Stein', 'marble': 'Marmor', 'travertine': 'Travertin',
    'terrazzo': 'Terrazzo', 'oak': 'Eiche', 'walnut': 'Nussbaum', 'teak': 'Teak', 'cedar': 'Zeder', 'smoked': 'geräuchert',
    'linen': 'Leinen', 'velvet': 'Samt', 'bouclé': 'Bouclé', 'leather': 'Leder', 'cane': 'Rohrgeflecht', 'rattan': 'Rattan',
    'rope': 'Seil', 'wool': 'Wolle', 'cork': 'Kork', 'felt': 'Filz', 'corten': 'Cortenstahl', 'ceramic': 'Keramik',
    'boxwood': 'Buchsbaum', 'pampas': 'Pampas', 'wood': 'Holz', 'fired': 'befeuert', 'slats': 'Lamellen', 'louvered': 'Lamellen',
    'backlit': 'hinterleuchtet', 'frosted': 'Milchglas', 'fluted': 'kanneliert', 'handleless': 'grifflos', 'brushed': 'gebürstet',
    'rimless': 'randlos', 'matte': 'matt', 'hollywood': 'Hollywood', 'hybrid': 'Hybrid', 'chunky': 'grob', 'knit': 'Strick',
    'shell': 'Schale', 'cube': 'Würfel', 'grid': 'Gitter', 'oval': 'oval', 'round': 'rund', 'square': 'quadratisch', 'arch': 'Bogen',
    'high': 'hoch', 'tall': 'hoch', 'std': 'Standard', 'corner': 'Ecke', 'middle': 'Mitte', 'left': 'links', 'right': 'rechts',
    'arm': 'Armlehne', 'ottoman': 'Ottomane', 'sectional': 'Sektional', 'top': 'oben', 'down': 'unten', 'up': 'oben', 'on': 'auf',
    'of': 'von', 'with': 'mit', 'in': 'in', 'a': 'ein', 'under': 'unter', 'counter': 'Arbeitsplatte', 'outdoor': 'Außen', 'open': 'offen',
    'raised': 'erhöht', 'mobile': 'mobil', 'acoustic': 'akustisch', 'office': 'Büro', 'enclosed': 'geschlossen', 'hot': 'heiß',
    'striped': 'gestreift', 'system': 'System', 'height': 'Höhe', 'adjustable': 'verstellbar', 'ergonomic': 'ergonomisch',
    'mesh': 'Mesh', 'hex': 'Waben', 'canopy': 'Baldachin', 'retro': 'Retro', 'smart': 'smart', 'sharing': 'Sharing',
    'touch': 'Touch', 'folded': 'gefaltet', 'bentwood': 'Bugholz', 'summer': 'Sommer', 'dress': 'Kleid', 'snacks': 'Snacks',
    'wave': 'Welle', 'sunburst': 'Sonnenstrahl', 'arcs': 'Bögen', 'fields': 'felder', 'colour': 'Farb', 'triptych': 'Triptychon',
    'candles': 'Kerzen', 'tray': 'Tablett', 'hanging': 'hängend', 'chalk': 'Kreide', 'coffee': 'Kaffee', 'espresso': 'Espresso',
    'bar': 'Bar', 'pastry': 'Gebäck', 'menu': 'Menü', 'board': 'Tafel', 'shop': 'Laden', 'groceries': 'Lebensmittel', 'retail': 'Einzelhandel',
    'shirts': 'Hemden', 'clothing': 'Kleidung', 'boutique': 'Boutique', 'drinks': 'Getränke', 'vending': 'Verkaufs', 'gelato': 'Gelato',
    'self': 'Selbst', 'order': 'Bestell', 'kiosk': 'Kiosk', 'bread': 'Brot', 'bakery': 'Bäckerei', 'pizza': 'Pizza', 'vases': 'Vasen',
    'vase': 'Vase', 'ring': 'Ring', 'rings': 'Ringe', 'halo': 'Ring', 'globe': 'Kugel', 'dome': 'Kuppel', 'cone': 'Kegel', 'tube': 'Röhre',
    'mushroom': 'Pilz', 'uplight': 'Uplight', 'pillar': 'Säule', 'pendant': 'Pendel', 'chandelier': 'Kronleuchter',
    // the kinds of things (family words)
    'three-seater': 'Dreisitzer', 'two-seater': 'Zweisitzer', 'seater': 'Sitzer', 'three': 'Drei', 'modular': 'Modul', 'lounge': 'Lounge',
    'nesting': 'Satz', 'tables': 'Tische', 'floating': 'schwebend', 'wall-hung': 'Wand-', 'walk-in': 'Walk-in', 'standing': 'Steh',
    'rolling': 'Roll', 'filing': 'Akten', 'laser': 'Laser', 'meeting': 'Meeting', 'phone': 'Telefon', 'server': 'Server', 'laptop': 'Laptop',
    'gaming': 'Gaming', 'booth': 'Nische', 'hood': 'Dunstabzug', 'island': 'Insel', 'kitchen': 'Küche', 'sink': 'Spüle', 'hob': 'Kochfeld',
    'drawers': 'Schubladen', 'oven': 'Backofen', 'fridge': 'Kühlschrank', 'freezer': 'Truhe', 'washing': 'Wasch', 'washer': 'Wasch',
    'machine': 'Maschine', 'dishwasher': 'Geschirrspüler', 'stand': 'Ständer', 'mixer': 'Mixer', 'wine': 'Wein', 'cooler': 'Kühler',
    'french': 'French', 'door': 'Tür', 'doors': 'Türen', 'sliding': 'Schiebe', 'clothes': 'Kleider', 'coat': 'Mantel',
    'bath': 'Bad', 'radiator': 'Heizkörper', 'bathtub': 'Badewanne', 'freestanding': 'freistehend', 'hung': 'hängend',
    'toilet': 'Toilette', 'wc': 'WC', 'shower': 'Dusche', 'column': 'Säule', 'cactus': 'Kaktus', 'plant': 'Pflanze',
    'leaf': 'Blatt', 'fig': 'Feige', 'fiddle': 'Geigen', 'snake': 'Schlangen', 'bird': 'Vogel', 'paradise': 'Paradies', 'palm': 'Palme',
    'rubber': 'Gummi', 'kentia': 'Kentia', 'zz': 'ZZ', 'monstera': 'Monstera', 'olive': 'Oliven', 'grand': 'Konzert', 'piano': 'Klavier',
    'fireplace': 'Kamin', 'gas': 'Gas', 'bbq': 'Grill', 'planter': 'Pflanzkübel', 'tripod': 'Dreibein', 'dresser': 'Kommode',
    'media': 'Medien', 'rug': 'Teppich', 'bookcase': 'Bücherregal', 'shelf': 'Regal', 'shelves': 'Regale', 'system': 'System',
    'nightstand': 'Nachttisch', 'console': 'Konsole', 'rack': 'Ständer', 'bunk': 'Etagen', 'toy': 'Spielzeug', 'box': 'Box',
    'laundry': 'Wäsche', 'basket': 'Korb', 'heated': 'beheizt', 'towel': 'Handtuch', 'vanity': 'Waschtisch', 'mirror': 'Spiegel',
    'mannequin': 'Schaufensterpuppe', 'checkout': 'Kasse', 'counter': 'Theke', 'display': 'Display', 'panels': 'Paneele', 'panel': 'Paneel',
    'screen': 'Bildschirm', 'pinboard': 'Pinnwand', 'lockers': 'Spinde', 'locker': 'Schließfach', 'hot': 'heiß', 'tub': 'Wanne',
    'float': 'Schwimm', 'pool': 'Pool', 'daybed': 'Tagesbett', 'sun': 'Sonnen', 'lounger': 'Liege', 'garden': 'Garten', 'pergola': 'Pergola',
    'parasol': 'Sonnenschirm', 'fire': 'Feuer', 'pit': 'Grube', 'kamado': 'Kamado', 'grill': 'Grill', 'station': 'Station',
    'raised': 'erhöht', 'bed': 'Bett', 'corten': 'Corten', 'light': 'Leuchte', 'bollard': 'Poller', 'mower': 'Mäher',
    'hammock': 'Hängematte', 'egg': 'Ei', 'water': 'Wasser', 'feature': 'Element', 'bowl': 'Schale', 'city': 'Stadt', 'cargo': 'Lasten',
    'kick': 'Tret', 'dock': 'Ladestation', 'charger': 'Ladegerät', 'charging': 'Lade', 'hoops': 'Bügel', 'moped': 'Moped',
    'bus': 'Bus', 'shelter': 'Unterstand', 'parcel': 'Paket', 'shed': 'Schuppen', 'roof': 'Dach', 'skateboard': 'Skateboard',
    'helmet': 'Helm', 'espresso': 'Espresso', 'machine': 'Maschine', 'kettle': 'Wasserkocher', 'toaster': 'Toaster', 'microwave': 'Mikrowelle',
    'pizza': 'Pizza', 'pinboard': 'Pinnwand', 'chair': 'Stuhl', 'stool': 'Hocker', 'bench': 'Bank', 'cabinet': 'Schrank',
    'unit': 'Einheit', 'drawers': 'Schubladen', 'art': 'Kunst', 'sculpture': 'Skulptur', 'canvas': 'Leinwand', 'record': 'Schall',
    'player': 'Spieler', 'aquarium': 'Aquarium', 'bust': 'Büste', 'candles': 'Kerzen', 'room': 'Raum', 'divider': 'Teiler',
    'macramé': 'Makramee', 'landscape': 'Landschaft', 'abstract': 'abstrakt', 'photo': 'Foto', 'trio': 'Trio', 'ceramic': 'Keramik',
    'pampas': 'Pampas', 'grass': 'Gras', 'pot': 'Topf', 'vacuum': 'Staubsauger', 'robot': 'Roboter', 'camera': 'Kamera',
    'security': 'Sicherheits', 'video': 'Video', 'doorbell': 'Türklingel', 'speaker': 'Lautsprecher', 'thermostat': 'Thermostat',
    'router': 'Router', 'node': 'Knoten', 'wifi': 'WLAN', 'air': 'Luft', 'purifier': 'Reiniger', 'bladeless': 'flügellos', 'fan': 'Ventilator',
    'heat': 'Wärme', 'pump': 'Pumpe', 'home': 'Heim', 'battery': 'Batterie', 'solar': 'Solar', 'inverter': 'Wechselrichter',
    'stand': 'Ständer', 'kwh': 'kWh', 'inch': 'Zoll', 'table': 'Tisch', 'coffee': 'Kaffee', 'dining': 'Ess', 'double': 'Doppel',
    'single': 'Einzel', 'wardrobe': 'Kleiderschrank', 'sofa': 'Sofa', 'curtain': 'Vorhang', 'lantern': 'Laterne', 'letterbox': 'Briefkasten',
    'house': 'Haus', 'number': 'Nummer', 'gutter': 'Dachrinne', 'downpipe': 'Fallrohr', 'garage': 'Garage', 'window': 'Fenster',
    'wall': 'Wand', 'floor': 'Boden', 'lamp': 'Lampe', 'globe': 'Kugel', 'pendant': 'Pendel', 'steel': 'Stahl', 'brass': 'Messing',
    'chrome': 'Chrom', 'hanging': 'hängend', 'egg': 'Ei', 'moped': 'Moped', 'e-bike': 'E-Bike', 'e-scooter': 'E-Scooter',
    'e-moped': 'E-Moped', 'ev': 'E-Auto', 'tv': 'TV', 'led': 'LED', 'rgb': 'RGB', 'pc': 'PC', '3d': '3D', '42u': '42U',
    'café': 'Café', 'bike': 'Fahrrad', 'scooter': 'Roller', 'cart': 'Wagen', 'helmet': 'Helm', 'sign': 'Schild', 'neon': 'Neon',
    'tower': 'Turm', 'mesh': 'Mesh', 'pillar': 'Säule', 'uplight': 'Uplight', 'of': 'von', 'mint': 'mint', 'folded': 'gefaltet',
    'bentwood': 'Bugholz', 'bullet': 'Zylinder', 'outdoor': 'Außen', 'cabinet': 'Schrank', 'bowl': 'Schale', 'cube': 'Würfel', 'sunburst': 'Sonnenstrahl',
    'tray': 'Tablett', 'trio': 'Trio', 'arm': 'Armlehne', 'slats': 'Lamellen', 'oval': 'oval', 'grid': 'Gitter', 'boxwood': 'Buchsbaum',
  };
  // parts that read the same in both languages (numbers, sizes, the symbol &)
  const KEEP = /^(&|[\d.,]+|[\d.,]+"|[\d.,]+[a-zA-Z]{0,3}|×)$/;
  const seg = (s, report) => {
    if (PHRASE[s] !== undefined) { if (report) report(s, 'phrase'); return PHRASE[s]; }
    return String(s).split(/(\s+|&)/).map((tok) => {
      if (tok === '' || /^\s+$/.test(tok) || tok === '&') return tok;
      const k = tok.toLowerCase();
      if (WORD[k] !== undefined) { if (report) report(tok, 'word'); return WORD[k]; }
      if (KEEP.test(tok)) { if (report) report(tok, 'keep'); return tok; }
      if (report) report(tok, 'miss');
      return tok;
    }).join('');
  };
  // a whole display name in German (report(text, kind) is called for every part: the test counts the misses)
  function translate(name, report) {
    const s = String(name);
    if (PHRASE[s] !== undefined) { if (report) report(s, 'phrase'); return PHRASE[s]; }
    return s.split(' · ').map((x) => seg(x, report)).join(' · ');
  }
  VR.NamesDE = { PHRASE, WORD, translate };
  // the name as it is shown: German when the language is German, else the name itself
  VR.dispName = function (name) {
    if (typeof name !== 'string' || !name) return name;
    const I = VR.I18N;
    return I && I.lang === 'de' ? translate(name) : name;
  };
})(VR);
