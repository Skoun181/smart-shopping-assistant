/**
 * Small offline emoji illustrations for the curated German product catalog.
 * Uses no remote image service. Custom products fall back to their category icon.
 */
export const categoryEmoji: Record<string, string> = {
  produce: '🥕', dairy: '🥛', bakery: '🥖', pantry: '🍝', meat: '🥩',
  frozen: '🧊', drinks: '🥤', snacks: '🍫', spices: '🧂',
  cleaning: '🧽', hygiene: '🧴'
};

const emojiGroups: [string, string][] = [
  ['🍎','Äpfel'], ['🍌','Bananen'], ['🍐','Birnen'], ['🍊','Orangen'],
  ['🍋','Zitronen'], ['🍋','Limetten'], ['🍇','Trauben'], ['🍓','Erdbeeren'],
  ['🫐','Blaubeeren|Himbeeren'], ['🥑','Avocados'],
  ['🍅','Tomaten|Cherrytomaten|Passierte Tomaten|Gehackte Tomaten|Tomatenmark'],
  ['🥒','Gurken'], ['🫑','Paprika'], ['🥕','Karotten'],
  ['🥔','Kartoffeln|Süßkartoffeln'], ['🧅','Zwiebeln|Frühlingszwiebeln|Lauch'], ['🧄','Knoblauch'],
  ['🥦','Brokkoli|Blumenkohl'], ['🥒','Zucchini'], ['🍆','Auberginen'],
  ['🥬','Spinat|Salat|Rucola|TK-Spinat'], ['🍄','Champignons'],
  ['🥗','Radieschen'], ['🫚','Ingwer'],
  ['🥛','Milch|Haferdrink|Kefir'], ['🧈','Butter|Margarine'],
  ['🥚','Eier'], ['🧀','Gouda|Mozzarella|Feta|Parmesan|Frischkäse'],
  ['🥣','Joghurt|Skyr|Quark|Saure Sahne|Schmand'], ['🍶','Sahne'],
  ['🍞','Brot|Toastbrot|Knäckebrot'], ['🥖','Brötchen|Baguette'],
  ['🥐','Croissants'], ['🫓','Tortillas|Wraps|Burgerbrötchen'],
  ['🍝','Spaghetti|Penne|Fusilli|Lasagneplatten'], ['🍚','Reis|Basmatireis|Couscous|Bulgur'],
  ['🥣','Haferflocken|Müsli|Müsliriegel'], ['🫘','Linsen|Kichererbsen|Bohnen'],
  ['🌽','Mais'], ['🫒','Olivenöl|Sonnenblumenöl'], ['🍶','Essig'],
  ['🟡','Senf'], ['🍅','Ketchup'], ['🥫','Mayonnaise|Gemüsebrühe'],
  ['🥜','Nussmus'], ['🍯','Marmelade|Honig'],
  ['🍗','Hähnchenbrust'], ['🥩','Hackfleisch|Rindersteak|Schweineschnitzel'],
  ['🥓','Speck|Schinken|Salami'], ['🐟','Lachs|Thunfisch|Fischstäbchen'],
  ['🧈','Tofu'], ['🍕','TK-Pizza'], ['🥦','TK-Gemüse|TK-Erbsen'],
  ['🫐','TK-Beeren'], ['🍟','Pommes'], ['🍦','Eiscreme'],
  ['💧','Mineralwasser|Stilles Wasser'], ['🧃','Apfelsaft|Orangensaft'],
  ['☕','Kaffee'], ['🍵','Tee'], ['🥤','Cola|Limonade'],
  ['🍫','Schokolade'], ['🍪','Kekse'], ['🥔','Chips'],
  ['🥨','Salzstangen'], ['🥜','Nüsse'], ['🍿','Popcorn'],
  ['🍬','Gummibärchen'], ['🧂','Salz|Pfeffer|Paprikapulver|Oregano|Basilikum|Thymian|Curry|Zimt'],
  ['🍬','Zucker|Vanillezucker'], ['🌾','Mehl'], ['🧁','Backpulver'], ['🍫','Kakao'],
  ['🗑️','Müllbeutel'], ['🧴','Spülmittel|Allzweckreiniger|Toilettenreiniger|Badreiniger|Glasreiniger|Waschmittel|Weichspüler'],
  ['🫧','Spülmaschinentabs'], ['🧽','Schwämme|Putztücher'], ['🧻','Küchenrolle|Toilettenpapier'],
  ['📜','Backpapier'], ['🥡','Frischhaltefolie|Alufolie'],
  ['🧴','Shampoo|Duschgel|Deo|Rasierschaum|Handcreme|Bodylotion'],
  ['🧼','Seife'], ['🪥','Zahnpasta|Zahnbürste'], ['🪒','Rasierer'],
  ['🧻','Wattepads|Taschentücher']
];

export const productEmojiMap = Object.fromEntries(
  emojiGroups.flatMap(([emoji, names]) => names.split('|').map((name) => [name, emoji]))
) as Record<string,string>;

export function productEmoji(nameDe: string, categoryId: string) {
  return productEmojiMap[nameDe] || categoryEmoji[categoryId] || '🛒';
}

export function defaultUnit(categoryId: string, nameDe: string): 'pcs' | 'l' {
  if (['drinks'].includes(categoryId) || ['Milch','Haferdrink','Kefir','Sahne'].includes(nameDe)) return 'l';
  return 'pcs';
}
