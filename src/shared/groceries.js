// ============================================================================
// Groceries & goods: everything the supermarkets sell (new items with food
// values where edible) and the store catalogue: category → products + prices.
// ============================================================================
(function (VR) {
  'use strict';
  const item = VR.defItem, R = VR.R;
  if (!item) return;
  const G = VR.GROCERIES = {};
  // [id, name, food, sat, extra]   food 0 = not edible
  const DEFS = [
    // fruit & veg
    ['banana', 'Banana', 3, 2.4], ['orange', 'Orange', 3, 2.4], ['grapes', 'Grapes', 3, 1.8], ['strawberries', 'Strawberries', 2, 1.2], ['pear', 'Pear', 3, 2.4], ['lemon', 'Lemon', 1, 0.6], ['pineapple', 'Pineapple', 5, 4.8], ['cherries', 'Cherries', 2, 1.2], ['plum', 'Plum', 3, 2.4],
    ['tomato', 'Tomato', 2, 1.2], ['lettuce', 'Lettuce', 2, 0.6], ['broccoli', 'Broccoli', 3, 2.4], ['cucumber', 'Cucumber', 2, 0.6], ['corn_cob', 'Corn', 3, 2.4], ['onion', 'Onion', 2, 1.2], ['bell_pepper', 'Bell Pepper', 2, 1.2], ['eggplant', 'Eggplant', 3, 1.8], ['mushrooms', 'Mushrooms', 2, 1.2],
    // bakery
    ['baguette', 'Baguette', 6, 7.2], ['croissant', 'Croissant', 4, 3.6], ['donut', 'Donut', 4, 2.4], ['cupcake', 'Cupcake', 3, 1.8], ['muffin', 'Muffin', 4, 2.4], ['pretzel', 'Pretzel', 4, 3.6], ['cake_slice', 'Cake Slice', 5, 3.6],
    // pantry
    ['pasta', 'Pasta', 0, 0, { stack: 32 }], ['rice_bag', 'Rice', 0, 0, { stack: 32 }], ['canned_soup', 'Tomato Soup', 7, 8.4, { stack: 16 }], ['canned_beans', 'Baked Beans', 6, 7.2, { stack: 16 }], ['jam_jar', 'Strawberry Jam', 3, 1.2, { stack: 16 }], ['olive_oil', 'Olive Oil', 0, 0, { stack: 16 }], ['flour', 'Flour', 0, 0, { stack: 32 }], ['coffee_beans', 'Coffee Beans', 0, 0, { stack: 32 }], ['tea_box', 'Tea', 0, 0, { stack: 32 }],
    // drinks
    ['water_bottle', 'Spring Water', 1, 0.6, { stack: 16 }], ['orange_juice', 'Orange Juice', 3, 1.8, { stack: 16 }], ['apple_juice', 'Apple Juice', 3, 1.8, { stack: 16 }], ['soda_cola', 'Nova Cola', 2, 0.6, { stack: 16 }], ['soda_lime', 'Lime Fizz', 2, 0.6, { stack: 16 }], ['lemonade', 'Lemonade', 2, 1.2, { stack: 16 }], ['iced_tea', 'Iced Tea', 2, 1.2, { stack: 16 }], ['energy_drink', 'Comet Energy', 2, 0.6, { stack: 16, effect: 'speed' }],
    // snacks
    ['chips', 'Crisps', 3, 1.2], ['popcorn', 'Popcorn', 3, 1.2], ['nuts', 'Mixed Nuts', 4, 3.6], ['crackers', 'Crackers', 3, 1.8], ['granola_bar', 'Granola Bar', 4, 3.0],
    // cereal
    ['cereal_choco', 'Choco Crunch', 4, 2.4, { stack: 16 }], ['cereal_fruit', 'Fruity Rings', 4, 2.4, { stack: 16 }], ['oats', 'Oats', 4, 3.6, { stack: 16 }], ['cornflakes', 'Cornflakes', 4, 2.4, { stack: 16 }],
    // sweets
    ['chocolate_bar', 'Chocolate Bar', 3, 1.2], ['candy', 'Candy', 2, 0.6], ['lollipop', 'Lollipop', 2, 0.6], ['gummy_bears', 'Gummy Bears', 2, 0.6],
    // dairy
    ['milk', 'Milk', 2, 1.2, { stack: 16 }], ['cheese', 'Cheese', 4, 3.6], ['yogurt', 'Yogurt', 3, 1.8, { stack: 16 }], ['butter', 'Butter', 1, 0.6],
    // frozen
    ['ice_cream', 'Ice Cream', 4, 2.4, { stack: 16 }], ['frozen_pizza', 'Frozen Pizza', 8, 7.2, { stack: 8 }], ['popsicle', 'Popsicle', 2, 0.6],
    // deli
    ['ham', 'Ham', 5, 4.8], ['sausage', 'Sausage', 5, 4.8], ['sushi', 'Sushi', 6, 6.0],
    // flowers
    ['bouquet_roses', 'Rose Bouquet', 0, 0, { stack: 16, cat: 'shop' }], ['bouquet_tulips', 'Tulip Bouquet', 0, 0, { stack: 16, cat: 'shop' }], ['bouquet_sunflowers', 'Sunflower Bouquet', 0, 0, { stack: 16, cat: 'shop' }],
    // toys
    ['toy_robot', 'Toy Robot', 0, 0, { stack: 16, cat: 'shop' }], ['toy_rocket', 'Toy Rocket', 0, 0, { stack: 16, cat: 'shop' }], ['toy_ball', 'Bouncy Ball', 0, 0, { stack: 16, cat: 'shop' }], ['teddy_bear', 'Teddy Bear', 0, 0, { stack: 16, cat: 'shop' }],
    // home
    ['soap', 'Soap', 0, 0, { stack: 16, cat: 'shop' }], ['toothpaste', 'Toothpaste', 0, 0, { stack: 16, cat: 'shop' }], ['towel', 'Towel', 0, 0, { stack: 16, cat: 'shop' }], ['candle', 'Candle', 0, 0, { stack: 16, cat: 'shop' }],
    // pharmacy
    ['bandage', 'Bandage', 0, 0, { stack: 16, cat: 'shop', heal: 6 }], ['vitamins', 'Vitamins', 1, 0.6, { stack: 16, cat: 'shop', effect: 'regen' }], ['first_aid_kit', 'First Aid Kit', 0, 0, { stack: 4, cat: 'shop', heal: 20 }], ['sunscreen', 'Sunscreen', 0, 0, { stack: 16, cat: 'shop' }],
  ];
  G.IDS = [];
  for (const [id, name, food, sat, extra] of DEFS) {
    const o = Object.assign({ name, cat: food > 0 ? 'food' : 'shop', stack: 32 }, extra || {});
    if (food > 0) { o.food = food; o.sat = sat; }
    if (!VR.ITEMS[id]) item(id, o);
    G.IDS.push(id);
  }

  // ---------------------------------------------------------------- the catalogue
  // prices in credits (₵); products lists mix new goods, classic food and a few blocks people like to buy
  const has = (id) => !!(VR.ITEMS[id] || R.byName[id]);
  const cat = (key, name, color, products) => ({ key, name, color, products: products.filter(p => has(p[0])) });
  const CATS = {
    fruit: cat('fruit', 'Fresh Fruit', 0xE8A030, [['apple', 2], ['banana', 2], ['orange', 2], ['grapes', 4], ['strawberries', 5], ['pear', 2], ['lemon', 1], ['pineapple', 6], ['cherries', 4], ['plum', 2], ['melon_slice', 3], ['starfruit', 8]]),
    veg: cat('veg', 'Vegetables', 0x5AB050, [['carrot', 1], ['potato', 1], ['beetroot', 1], ['tomato', 2], ['lettuce', 2], ['broccoli', 3], ['cucumber', 2], ['corn_cob', 2], ['onion', 1], ['bell_pepper', 3], ['eggplant', 3], ['mushrooms', 4]]),
    bakery: cat('bakery', 'Bakery', 0xD8A060, [['bread', 3], ['baguette', 3], ['croissant', 2], ['donut', 2], ['cupcake', 3], ['muffin', 2], ['pretzel', 2], ['cake_slice', 4], ['cookie', 1], ['pumpkin_pie', 6]]),
    pantry: cat('pantry', 'Pantry', 0xC08040, [['pasta', 3], ['rice_bag', 3], ['canned_soup', 4], ['canned_beans', 3], ['jam_jar', 5], ['olive_oil', 7], ['flour', 2], ['coffee_beans', 8], ['tea_box', 5], ['sugar', 2], ['honey_bottle', 7], ['egg', 1]]),
    drinks: cat('drinks', 'Drinks', 0x40A8E0, [['water_bottle', 1], ['orange_juice', 3], ['apple_juice', 3], ['soda_cola', 2], ['soda_lime', 2], ['lemonade', 2], ['iced_tea', 3], ['energy_drink', 4]]),
    snacks: cat('snacks', 'Snacks', 0xF0C040, [['chips', 3], ['popcorn', 2], ['nuts', 5], ['crackers', 3], ['granola_bar', 2], ['dried_kelp', 1]]),
    cereal: cat('cereal', 'Cereal', 0xE07040, [['cereal_choco', 5], ['cereal_fruit', 5], ['oats', 3], ['cornflakes', 4]]),
    sweets: cat('sweets', 'Sweets', 0xE860A0, [['chocolate_bar', 2], ['candy', 1], ['lollipop', 1], ['gummy_bears', 2], ['cookie', 1], ['sweet_berries', 3], ['glow_berries', 4]]),
    dairy: cat('dairy', 'Dairy', 0xF0F0F8, [['milk', 2], ['cheese', 5], ['yogurt', 2], ['butter', 3], ['egg', 1]]),
    frozen: cat('frozen', 'Frozen', 0x80D8F0, [['ice_cream', 4], ['frozen_pizza', 7], ['popsicle', 2], ['cooked_cod', 5], ['cooked_salmon', 6]]),
    deli: cat('deli', 'Deli', 0xE07070, [['ham', 6], ['sausage', 5], ['sushi', 9], ['steak', 9], ['cooked_chicken', 7], ['cooked_porkchop', 7], ['cooked_mutton', 7], ['cheese', 5]]),
    flowers: cat('flowers', 'Flowers', 0xF080B0, [['bouquet_roses', 9], ['bouquet_tulips', 8], ['bouquet_sunflowers', 8], ['poppy', 2], ['dandelion', 1], ['vx_potplant', 6], ['vx_planter', 8]]),
    tech: cat('tech', 'Tech', 0x40E0FF, [['energy_cell', 12], ['waypoint_marker', 6], ['compass', 15], ['clock', 15], ['spyglass', 25], ['scanner', 60], ['photo_drone', 80], ['vx_holo_screen', 30], ['vx_lamppost', 20]]),
    toys: cat('toys', 'Toys', 0xF06040, [['toy_robot', 25], ['toy_rocket', 20], ['toy_ball', 6], ['teddy_bear', 18]]),
    home: cat('home', 'Home', 0xA080E0, [['soap', 2], ['toothpaste', 3], ['towel', 8], ['candle', 4], ['vx_lantern', 12], ['vx_rug_red', 15], ['vx_chair', 14], ['vx_table', 18], ['vx_bed_blue', 40], ['vx_shelf', 20]]),
    pharmacy: cat('pharmacy', 'Pharmacy', 0x40D090, [['bandage', 5], ['vitamins', 8], ['first_aid_kit', 30], ['sunscreen', 6], ['golden_apple', 60]]),
    promo: cat('promo', 'On Sale', 0xFF4040, [['soda_cola', 1], ['chips', 2], ['chocolate_bar', 1], ['canned_beans', 2], ['popcorn', 1]]),
  };
  const PRICE = Object.create(null);
  for (const k in CATS) for (const [id, p] of CATS[k].products) if (PRICE[id] === undefined) PRICE[id] = p;
  VR.SHOP = {
    CATS,
    price: (id) => PRICE[id] !== undefined ? PRICE[id] : (VR.ITEMS[id] && VR.ITEMS[id].cat === 'tech' ? 40 : 5),
    productsFor: (key) => (CATS[key] || CATS.pantry).products,
    // which counter/shelf block sells what
    catOfBlock(name) {
      if (!name) return null;
      let m = /^vx_shop_shelf_(\w+)$/.exec(name); if (m) return m[1];
      if (name === 'vx_shop_fridge_drinks') return 'drinks';
      if (name === 'vx_shop_fridge_dairy') return 'dairy';
      if (name === 'vx_shop_freezer') return 'frozen';
      if (name === 'vx_shop_produce') return 'fruit';
      if (name === 'vx_shop_deli') return 'deli';
      if (name === 'vx_shop_bakery_case') return 'bakery';
      if (name === 'vx_shop_flower_stand') return 'flowers';
      if (name === 'vx_shop_promo') return 'promo';
      return null;
    },
  };
})(VR);
