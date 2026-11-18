import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const categories = [
  ['produce','Obst & Gemüse','Fruit & vegetables'],
  ['dairy','Milchprodukte & Eier','Dairy & eggs'],
  ['bakery','Brot & Backwaren','Bread & bakery'],
  ['pantry','Nudeln, Reis & Vorrat','Pantry & grains'],
  ['meat','Fleisch & Fisch','Meat & fish'],
  ['frozen','Tiefkühl','Frozen'],
  ['drinks','Getränke','Drinks'],
  ['snacks','Snacks & Süßes','Snacks & sweets'],
  ['spices','Gewürze & Backen','Spices & baking'],
  ['cleaning','Haushalt & Reinigung','Cleaning'],
  ['hygiene','Körperpflege','Personal care']
] as const;

const catalog: Record<string, string> = {
  produce: 'Äpfel|Apples,Bananen|Bananas,Birnen|Pears,Orangen|Oranges,Zitronen|Lemons,Limetten|Limes,Trauben|Grapes,Erdbeeren|Strawberries,Blaubeeren|Blueberries,Himbeeren|Raspberries,Avocados|Avocados,Tomaten|Tomatoes,Cherrytomaten|Cherry tomatoes,Gurken|Cucumbers,Paprika|Bell peppers,Karotten|Carrots,Kartoffeln|Potatoes,Süßkartoffeln|Sweet potatoes,Zwiebeln|Onions,Knoblauch|Garlic,Lauch|Leeks,Brokkoli|Broccoli,Blumenkohl|Cauliflower,Zucchini|Zucchini,Auberginen|Eggplant,Spinat|Spinach,Champignons|Mushrooms,Salat|Lettuce,Rucola|Arugula,Radieschen|Radishes,Ingwer|Ginger,Frühlingszwiebeln|Spring onions',
  dairy: 'Milch|Milk,Haferdrink|Oat drink,Butter|Butter,Margarine|Margarine,Eier|Eggs,Gouda|Gouda,Mozzarella|Mozzarella,Feta|Feta,Parmesan|Parmesan,Frischkäse|Cream cheese,Joghurt|Yogurt,Skyr|Skyr,Quark|Quark,Sahne|Cream,Saure Sahne|Sour cream,Schmand|Sour cream,Kefir|Kefir',
  bakery: 'Brot|Bread,Toastbrot|Toast,Brötchen|Bread rolls,Croissants|Croissants,Baguette|Baguette,Knäckebrot|Crispbread,Tortillas|Tortillas,Burgerbrötchen|Burger buns,Wraps|Wraps',
  pantry: 'Spaghetti|Spaghetti,Penne|Penne,Fusilli|Fusilli,Lasagneplatten|Lasagne sheets,Reis|Rice,Basmatireis|Basmati rice,Couscous|Couscous,Bulgur|Bulgur,Haferflocken|Oats,Müsli|Muesli,Linsen|Lentils,Kichererbsen|Chickpeas,Bohnen|Beans,Mais|Corn,Passierte Tomaten|Tomato passata,Gehackte Tomaten|Chopped tomatoes,Tomatenmark|Tomato paste,Olivenöl|Olive oil,Sonnenblumenöl|Sunflower oil,Essig|Vinegar,Senf|Mustard,Ketchup|Ketchup,Mayonnaise|Mayonnaise,Gemüsebrühe|Vegetable stock,Nussmus|Nut butter,Marmelade|Jam,Honig|Honey',
  meat: 'Hähnchenbrust|Chicken breast,Hackfleisch|Ground meat,Rindersteak|Beef steak,Schweineschnitzel|Pork cutlet,Speck|Bacon,Schinken|Ham,Salami|Salami,Lachs|Salmon,Thunfisch|Tuna,Fischstäbchen|Fish fingers,Tofu|Tofu',
  frozen: 'TK-Pizza|Frozen pizza,TK-Gemüse|Frozen vegetables,TK-Erbsen|Frozen peas,TK-Beeren|Frozen berries,Pommes|Fries,Eiscreme|Ice cream,TK-Spinat|Frozen spinach',
  drinks: 'Mineralwasser|Mineral water,Stilles Wasser|Still water,Apfelsaft|Apple juice,Orangensaft|Orange juice,Kaffee|Coffee,Tee|Tea,Cola|Cola,Limonade|Lemonade',
  snacks: 'Schokolade|Chocolate,Kekse|Cookies,Chips|Chips,Salzstangen|Pretzel sticks,Nüsse|Nuts,Popcorn|Popcorn,Gummibärchen|Gummy bears,Müsliriegel|Cereal bars',
  spices: 'Salz|Salt,Pfeffer|Pepper,Paprikapulver|Paprika,Oregano|Oregano,Basilikum|Basil,Thymian|Thyme,Curry|Curry,Zimt|Cinnamon,Zucker|Sugar,Mehl|Flour,Backpulver|Baking powder,Vanillezucker|Vanilla sugar,Kakao|Cocoa',
  cleaning: 'Müllbeutel|Bin bags,Spülmittel|Dish soap,Spülmaschinentabs|Dishwasher tablets,Allzweckreiniger|All-purpose cleaner,Toilettenreiniger|Toilet cleaner,Badreiniger|Bathroom cleaner,Glasreiniger|Glass cleaner,Waschmittel|Laundry detergent,Weichspüler|Fabric softener,Schwämme|Sponges,Putztücher|Cleaning cloths,Küchenrolle|Kitchen towels,Toilettenpapier|Toilet paper,Backpapier|Baking paper,Frischhaltefolie|Cling film,Alufolie|Aluminium foil',
  hygiene: 'Shampoo|Shampoo,Duschgel|Shower gel,Seife|Soap,Zahnpasta|Toothpaste,Zahnbürste|Toothbrush,Deo|Deodorant,Rasierschaum|Shaving foam,Rasierer|Razor,Handcreme|Hand cream,Bodylotion|Body lotion,Wattepads|Cotton pads,Taschentücher|Tissues'
};

export function seedCatalog(db: Database.Database) {
  const t = Date.now();
  db.transaction(() => {
    const insertCategory = db.prepare('INSERT OR IGNORE INTO categories(id,name_de,name_en,sort_order) VALUES(?,?,?,?)');
    categories.forEach(([id, de, en], index) => insertCategory.run(id, de, en, index));
    const units = [
      ['pcs','Stück','pieces','count',1], ['pack','Packung','pack','pack',1],
      ['g','Gramm','grams','mass',1], ['kg','Kilogramm','kilograms','mass',1000],
      ['ml','Milliliter','milliliters','volume',1], ['l','Liter','liters','volume',1000]
    ] as const;
    const unitInsert = db.prepare('INSERT OR IGNORE INTO units(id,name_de,name_en,dimension,factor) VALUES(?,?,?,?,?)');
    units.forEach((unit) => unitInsert.run(...unit));
    db.prepare('INSERT OR IGNORE INTO shopping_lists(id,name,created_at) VALUES(?,?,?)').run('default','Einkaufsliste',t);
    db.prepare('INSERT OR IGNORE INTO pantry_locations(id,name_de,name_en) VALUES(?,?,?)').run('home','Zuhause','Home');
    const count = db.prepare("SELECT COUNT(*) as total FROM products WHERE source = 'catalog'").get() as { total: number };
    if (count.total) return;
    const insert = db.prepare('INSERT INTO products(id,category_id,name_de,name_en,source,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)');
    const variants = db.prepare('INSERT INTO product_variants(id,product_id,label_de,label_en,attributes) VALUES(?,?,?,?,?)');
    for (const [category, items] of Object.entries(catalog)) {
      for (const pair of items.split(',')) {
        const [de, en] = pair.split('|');
        const id = randomUUID();
        insert.run(id, category, de, en, 'catalog', 1, t, t);
        if (de === 'Milch') {
          for (const [fat, label] of [['1.5','1,5 % Fett'],['3.5','3,5 % Fett'],['lactose','Laktosefrei']]) {
            variants.run(randomUUID(), id, label, fat === 'lactose' ? 'Lactose free' : fat + '% fat', JSON.stringify({ fat }));
          }
        }
        if (de === 'Müllbeutel') for (const size of [10,20,30,60,120]) {
          variants.run(randomUUID(), id, size + ' Liter', size + ' litres', JSON.stringify({ volume_l: size }));
        }
        if (de === 'Toilettenpapier') for (const ply of [3,4,5]) {
          variants.run(randomUUID(), id, ply + '-lagig', ply + '-ply', JSON.stringify({ plies: ply }));
        }
        if (de === 'Waschmittel') for (const [key, textDe, textEn] of [['powder','Pulver','Powder'],['liquid','Flüssig','Liquid'],['pods','Pods','Pods']]) {
          variants.run(randomUUID(), id, textDe, textEn, JSON.stringify({ type: key }));
        }
      }
    }
  })();
}
