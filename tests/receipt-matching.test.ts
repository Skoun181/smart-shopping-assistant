import { describe,expect,test } from 'vitest';
import { receiptSuggestions } from '../src/lib/pantry-import';
import { matchReceipt,rowIssues } from '../src/lib/receipt-matching';
const categories=[
  {id:'dairy',name_de:'Milchprodukte & Eier',name_en:'Dairy & eggs'},
  {id:'meat',name_de:'Fleisch & Fisch',name_en:'Meat & fish'},
  {id:'drinks',name_de:'Getränke',name_en:'Drinks'},
  {id:'snacks',name_de:'Snacks & Süßes',name_en:'Snacks'},
  {id:'pantry',name_de:'Vorrat',name_en:'Pantry'}
];
const products=[
  {id:'milk-id',name_de:'H-Milch',name_en:'UHT milk',category_id:'dairy'},
  {id:'ham-id',name_de:'Schinken',name_en:'Ham',category_id:'meat'},
  {id:'cola-id',name_de:'Cola',name_en:'Cola',category_id:'drinks'}
];
describe('local receipt interpretation',()=>{
  test('realistic anonymized supermarket abbreviations and footer',()=>{
    // Synthetic prices, no original receipt or account data.
    const text='ROHSCHINKEN GEW. 1,00 B\nH-MILCH GVO-FREI 1,00 B\nSPAGHETTIGERICHT 1,00 B\nNUSSDELUXE TFMIL 1,00 B\nCOKE VANILLA 1,00 A\nPFAND 0,25 A *\nCC Z EW 2L 1,00 A\nFANTA GRAPE 1,00 A\nSUMME EUR 7,25\nA= 7,0% 6,00 0,42 6,42\nGeg. VISA EUR 7,25';
    const rows=receiptSuggestions(text).map(d=>matchReceipt(d,products,categories));
    expect(rows).toHaveLength(7);
    expect(rows.map(r=>[r.name,r.category])).toEqual([
      ['Schinken','meat'],['H-Milch','dairy'],['Spaghettigericht','pantry'],['Nuss-Schokolade','snacks'],['Cola','drinks'],['Cola','drinks'],['Fanta','drinks']
    ]);
    expect(rows[0].variant).toBe('Rohschinken');
    expect(rows[0].estimated).toBe(true);
    expect(rows[1].productId).toBe('milk-id');
    expect(rows[3].uncertain).toBe(true);
    expect(rows[5]).toMatchObject({quantity:2,unit:'l',uncertain:true});
    expect(rows[6].variant).toBe('Grape');
    expect(rows.every(r=>rowIssues({...r,categoryId:r.category},categories).length===0)).toBe(true);
  });
  test('respects household custom category for matched product',()=>{
    const [d]=receiptSuggestions('COKE VANILLA 1,00 A');
    const moved=products.map(p=>p.id==='cola-id'?{...p,category_id:'snacks'}:p);
    expect(matchReceipt(d,moved,categories).category).toBe('snacks');
  });
  test('unknown label requires a category; prices are not quantities',()=>{
    const [d]=receiptSuggestions('XYZ123 9,99 B');
    const r=matchReceipt(d,products,categories);
    expect(r).toMatchObject({quantity:1,unit:'pcs',estimated:true,category:'',uncertain:true});
    expect(rowIssues({...r,categoryId:r.category},categories)).toEqual(['category']);
  });
  test('invalid reviewed rows cannot be imported',()=>{
    expect(rowIssues({name:'',quantity:null,categoryId:'',variant:''},categories)).toEqual(['name','quantity','category']);
  });
});
