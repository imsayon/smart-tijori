import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/shop-assistant/route';
const reader = vi.hoisted(() => vi.fn());
vi.mock('@server/http/adapters', () => ({ getCommerceCommands: () => ({ getProductOffers: reader }) }));

function question(text:string,storeId:string) {
  return new Request('https://shop.example/api/shop-assistant', {
    method:'POST',headers:{host:'shop.example',origin:'https://shop.example','Content-Type':'application/json'},
    body:JSON.stringify({storeId,turns:[{role:'user',text}]}),
  });
}
const createOffer = (productId:string,storeId:string,name:string,available:number) => ({
  productId,storeId,name,available,pricePaise:9500,purpose:'toor-dal',
  category:'pantry',pack:{quantity:500,unit:'g'},attributes:{},city:'Bengaluru',
  imageUrl:'',inventoryVersion:1,checkedAt:new Date().toISOString(),
});
afterEach(() => { reader.mockReset();vi.unstubAllGlobals(); });

describe('branch-grounded shopping assistant', () => {
  it('supplies in-stock products only from the selected store to Gemini', async () => {
    reader.mockResolvedValue([
      createOffer('dal-1','dm-blr-01','Toor Dal 500g',8),
      createOffer('dal-2','dm-blr-01','Sold Out Dal',0),
      createOffer('dal-3','dm-mum-01','Another Branch Dal',10),
      createOffer('salt-1','dm-blr-01','Salt 1kg',20),
    ]);
    const before = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY='test-key';
    const provider = vi.fn(async (_url:unknown, init?:RequestInit) => {
      const payload = JSON.parse(String(init?.body));
      const context:string=payload.systemInstruction.parts[0].text;
      expect(context).toContain('Toor Dal 500g');
      expect(context).not.toContain('Sold Out Dal');
      expect(context).not.toContain('Another Branch Dal');
      expect(context).not.toContain('Salt 1kg');
      return Response.json({candidates:[{content:{parts:[{text:'Toor Dal 500g is available here for ₹95.'}]}}]});
    });
    vi.stubGlobal('fetch',provider);
    try {
      const response=await POST(question('Need toor dal','dm-blr-01'));
      expect(response.status).toBe(200);
      expect((await response.json()).reply).toContain('Toor Dal');
      expect(reader).toHaveBeenCalledWith('dm-blr-01');
      expect(provider).toHaveBeenCalledTimes(1);
    } finally {
      if(before===undefined)delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY=before;
    }
  });
  it('falls back to factual in-stock branch suggestions when model is not configured',async()=>{
    reader.mockResolvedValue([
      createOffer('dal-1','dm-blr-01','Toor Dal 500g',4),
      createOffer('salt-1','dm-blr-01','Salt 1kg',4),
    ]);
    const before=process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const response=await POST(question('Need dal','dm-blr-01'));
      expect(response.status).toBe(200);
      const data=await response.json();
      expect(data.reply).toContain('Toor Dal');
      expect(data.reply).not.toContain('Salt');
    }finally{
      if(before!==undefined)process.env.GEMINI_API_KEY=before;
    }
  });
});
