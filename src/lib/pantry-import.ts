export const units=['pcs','pack','g','kg','ml','l'] as const;
export type Unit=typeof units[number];
export type Draft={name:string;quantity:number|null;unit:Unit;category:string;variant:string;source?:string};
export const CSV_HEADER='produkt;menge;einheit;kategorie;variante';
export const CSV_TEMPLATE='\uFEFF'+CSV_HEADER+'\n';
export function importPrompt(categories:string[]){
  return 'Lies den beigefügten Kassenbon oder das Foto. Erstelle ausschließlich eine UTF-8-CSV mit Semikolon als Trennzeichen, ohne Markdown. Kopfzeile: '+CSV_HEADER+'. Eine Zeile je gekauftem/erkennbarem Produkt. Keine Preise, Pfand, Rabatte, Summen, Kundennummern oder Barcodes. Menge nur wenn erkennbar, sonst leer lassen; Einheit pcs, pack, g, kg, ml oder l. Dezimalpunkt oder Dezimalkomma. Kategorien aus: '+categories.join(', ')+'. Unklare Kategorie leer lassen. Variante optional. Felder mit Semikolon, Anführungszeichen oder Zeilenumbruch in doppelte Anführungszeichen setzen, innere Anführungszeichen verdoppeln. Nichts erfinden. Bei einem Kühlschrankfoto nur sichtbare Produkte erfassen.';
}
export function parseCSV(input:string):Draft[]{
  const text=input.replace(/^\uFEFF/,'');
  if(text.length>100000)throw Error('CSV too large (100 KB maximum)');
  const header=text.split(/\r?\n/,1)[0];
  const delimiter=header.includes(';')?';':',';
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
  function cell(){row.push(field);field='';closed=false;}
  function line(){cell();if(row.some(v=>v.trim()))rows.push(row);row=[];}
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else field+=ch;
    }else if(ch===delimiter)cell();
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;line();}
    else if(ch==='"'&&!field&&!closed)quoted=true;
    else if(closed||ch==='"')throw Error('Invalid CSV quoting');
    else field+=ch;
  }
  if(quoted)throw Error('Unclosed CSV field');
  line();
  if(rows.length<2||rows.length>201)throw Error('CSV must contain 1–200 products');
  if(rows[0].map(v=>v.trim().toLowerCase()).join(';')!==CSV_HEADER)throw Error('Invalid CSV header: '+CSV_HEADER);
  return rows.slice(1).map((r,i)=>{
    if(r.length!==5)throw Error('Invalid column count in row '+(i+2));
    const [name,raw,unit,category,variant]=r.map(v=>v.trim());
    if(!name||name.length>120||category.length>70||variant.length>80)throw Error('Invalid fields in row '+(i+2));
    const qty=raw&&/^\d+(?:[.,]\d+)?$/.test(raw)?Number(raw.replace(',','.')):null;
    if(raw&&(qty===null||!Number.isFinite(qty)||qty<=0||qty>1000000))throw Error('Invalid quantity in row '+(i+2));
    if(unit&&!units.includes(unit as Unit))throw Error('Invalid unit in row '+(i+2));
    return {name,quantity:qty,unit:(unit||'pcs') as Unit,category,variant};
  });
}
export function normalized(value:string){return value.trim().normalize('NFKC').toLocaleLowerCase('de-DE');}
export function receiptSuggestions(text:string):Draft[]{
  // Conservative receipt heuristic: only price-ended lines. Amounts are not inferred from prices.
  const ignored=/\b(summe|gesamt|total|mwst|steuer|betrag|gegeben|rückgeld|barzahlung|kartenzahlung|ec[- ]?karte|visa|mastercard|rabatt|coupon|pfand|wechselgeld|zahlung|bonus|ersparnis|netto|brutto|zwischensumme|kundennummer|tse)\b/i;
  const out:Draft[]=[];
  for(const original of text.split(/\r?\n/)){
    const line=original.trim();
    if(!line||ignored.test(line))continue;
    const m=line.match(/^(.+?)\s+\d{1,6}[,.]\d{2}\s*(?:EUR|€|[ABCD*])?\s*$/i);
    if(!m)continue;
    let label=m[1].trim().replace(/^\d{6,}\s+/,'');
    let quantity:number|null=null;
    const count=label.match(/^(\d{1,4})\s*[x×]\s+(.+)$/i);
    if(count){quantity=Number(count[1]);label=count[2].trim();}
    if(label.length<2||label.length>120||!/\p{L}/u.test(label))continue;
    out.push({name:label,quantity,unit:'pcs',category:'',variant:'',source:line.slice(0,200)});
    if(out.length===200)break;
  }
  return out;
}
