import { normalized,type Draft,type Unit } from './pantry-import';
type Product={id:string;name_de:string;name_en:string|null;category_id:string};
type Category={id:string;name_de:string;name_en:string};
type Rule={pattern:RegExp;name:string;category:string;variant?:string;uncertain?:boolean};
const rules:Rule[]=[
  {pattern:/^h[\s-]*milch\b/i,name:'H-Milch',category:'dairy'},
  {pattern:/^rohschi(?:n)?cken\b|^rohschinken\b/i,name:'Schinken',category:'meat',variant:'Rohschinken'},
  {pattern:/^kochschinken\b/i,name:'Schinken',category:'meat',variant:'Kochschinken'},
  {pattern:/^coke\s+vanilla\b/i,name:'Cola',category:'drinks',variant:'Vanilla'},
  {pattern:/^(?:coke|coca[\s-]*cola|cola)\s+(?:zero|zero sugar)\b/i,name:'Cola',category:'drinks',variant:'Zero'},
  {pattern:/^cc\s+z\s+ew\b/i,name:'Cola',category:'drinks',variant:'Zero (Vorschlag)',uncertain:true},
  {pattern:/^fanta\b/i,name:'Fanta',category:'drinks'},
  {pattern:/^sprite\b/i,name:'Sprite',category:'drinks'},
  {pattern:/^spaghetti[\s-]*gericht\b/i,name:'Spaghettigericht',category:'pantry'},
  {pattern:/^nuss[\s-]*deluxe\b/i,name:'Nuss-Schokolade',category:'snacks',uncertain:true},
  {pattern:/^zewa\b/i,name:'Zewa',category:'cleaning'},
  {pattern:/^toil(?:etten)?[.\s-]*papier\b|^wc[\s-]*papier\b/i,name:'Toilettenpapier',category:'cleaning'},
  {pattern:/^tampons?\b/i,name:'Tampons',category:'hygiene'},
  {pattern:/^(?:damen)?binden\b/i,name:'Binden',category:'hygiene'},
  {pattern:/^slipeinlagen\b/i,name:'Slipeinlagen',category:'hygiene'}
];
const categoryHints:[RegExp,string][]=[
  [/\b(?:fanta|sprite|limonade|eistee|saft|cola|coke|mineralwasser|energy[\s-]*drink|schorle)\b/i,'drinks'],
  [/\b(?:schokolade|keks(?:e)?|chips|pralinen|schokoriegel|gummibärchen)\b/i,'snacks'],
  [/\b(?:milch|joghurt|quark|käse|butter|sahne|skyr)\b/i,'dairy'],
  [/\b(?:schinken|salami|wurst|hackfleisch|lachs)\b/i,'meat'],
  [/\b(?:nudeln|spaghetti|reis|pesto|bohnen|linsen)\b/i,'pantry'],
  [/\b(?:shampoo|tampons?|binden|duschgel|zahnpasta|deo)\b/i,'hygiene'],
  [/\b(?:zewa|küchenpapier|toilettenpapier|waschmittel|spülmittel|müllbeutel)\b/i,'cleaning']
];
function key(value:string){
  return normalized(value).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function uniqueMatch(name:string,products:Product[]){
  const k=key(name);if(!k)return undefined;
  const matches=products.filter(p=>[p.name_de,p.name_en||''].some(n=>key(n)===k));
  return matches.length===1?matches[0]:undefined;
}
export function matchReceipt(d:Draft,products:Product[],categories:Category[]){
  let name=d.name.trim(),variant=d.variant,quantity=d.quantity,unit:Unit=d.unit,category=d.category,uncertain=false;
  const original=name;
  const rule=rules.find(r=>r.pattern.test(name));
  let product=uniqueMatch(name,products);
  if(!product&&rule){
    name=rule.name;category=rule.category;uncertain=!!rule.uncertain;
    if(rule.variant)variant=rule.variant;
    if(rule.name==='Fanta'||rule.name==='Sprite'){
      variant=original.replace(rule.pattern,'').trim().replace(/\s+\d+(?:[.,]\d+)?\s*(?:ml|l)$/i,'').trim();
      if(variant)variant=variant[0].toUpperCase()+variant.slice(1).toLowerCase();
    }
    product=uniqueMatch(name,products);
  }
  if(!product&&!rule){
    // Match a whole leading product name, never arbitrary substrings; prefer the longest unique match.
    const k=key(original);
    const candidates=products.filter(p=>key(p.name_de).length>=4&&k.startsWith(key(p.name_de)+' ')).sort((a,b)=>key(b.name_de).length-key(a.name_de).length);
    if(candidates.length&&(!candidates[1]||key(candidates[0].name_de).length>key(candidates[1].name_de).length)){
      product=candidates[0];name=product.name_de;uncertain=true;
    }
  }
  if(product){name=product.name_de;category=product.category_id;}
  if(!category)category=categoryHints.find(([pattern])=>pattern.test(original))?.[1]||'';
  // A printed package size is evidence of volume/weight, not the item count.
  const size=original.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(ml|kg|g|l)\s*$/i);
  if(size&&unit==='pcs'){
    const value=Number(size[1].replace(',','.'))*(quantity??1);
    if(value>0&&value<=1000000){quantity=value;unit=size[2].toLowerCase() as Unit;}
  }
  // A single price line suggests one sold item, not a litre or kilogram by default.
  const estimated=quantity===null;
  if(estimated){quantity=1;unit='pcs';}
  const c=categories.find(c=>[c.id,c.name_de,c.name_en].some(v=>key(v)===key(category)));
  return {name,variant,quantity,unit,category:c?.id||'',productId:product?.id||null,
    uncertain:uncertain||(!product&&!rule),estimated};
}
export function rowIssues(row:{name:string;quantity:number|null;categoryId:string;variant:string},categories:Category[]){
  const issues:string[]=[];
  if(!row.name.trim()||row.name.trim().length>120)issues.push('name');
  if(row.quantity===null||!Number.isFinite(row.quantity)||row.quantity<=0||row.quantity>1000000)issues.push('quantity');
  if(!categories.some(c=>c.id===row.categoryId))issues.push('category');
  if(row.variant.length>80)issues.push('variant');
  return issues;
}
