import Link from 'next/link';
import { Icon } from '@/components/ui/atelier';

export function ShopFlowArtwork() {
  return <section id="stock" className="atelier-sync-explainer" aria-labelledby="atelier-sync-title">
    <div className="atelier-sync-copy">
      <p className="atelier-label">ONE CONNECTED STORE / THE TIJORI WAY</p>
      <h2 className="atelier-heading" id="atelier-sync-title">One source of truth.<br/><em>Every counter.</em></h2>
      <p>Whether an item is picked up in person or reserved online, availability follows the same rules. When something sells out, your next best option stays within reach.</p>
      <div className="atelier-sync-facts">
        <span>01 / Shared stock</span><span>02 / Protected checkout</span><span>03 / Thoughtful alternatives</span>
      </div>
      <Link className="atelier-secondary" href="/stores">Explore your neighbourhood <Icon name="arrow" size={14}/></Link>
    </div>
    <div className="atelier-sync-diagram">
      <svg viewBox="0 0 620 440" role="img" aria-label="Shopper and cashier both connect to a shared inventory. Updates reach the storefront and alternative discovery.">
        <defs>
          <pattern id="tijori-dots" width="23" height="23" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1.1" fill="#c1d8a8" opacity=".23"/></pattern>
          <linearGradient id="tijori-node" x2="1" y2="1"><stop stopColor="#214836"/><stop offset="1" stopColor="#173426"/></linearGradient>
        </defs>
        <rect width="620" height="440" fill="url(#tijori-dots)"/>
        <circle cx="326" cy="210" r="166" fill="#d5ea9e" opacity=".045"/>
        <g stroke="#cde6a0" fill="none" strokeWidth="2" strokeDasharray="6 9" opacity=".8">
          <path d="M164 100 C245 100 233 196 295 196"/>
          <path d="M164 330 C245 330 230 231 295 231"/>
          <path d="M413 210 C490 210 458 102 529 102"/>
          <path d="M413 232 C475 232 477 337 529 337"/>
        </g>
        {[
          {x:25,y:63,w:165,h:78,label:"SHOPPER",sub:"ONLINE STORE"},
          {x:25,y:293,w:165,h:78,label:"CASHIER",sub:"LOCAL COUNTER"},
          {x:265,y:159,w:181,h:111,label:"SHARED STOCK",sub:"ONE AVAILABILITY"},
          {x:470,y:64,w:130,h:77,label:"CHECKOUT",sub:"RESERVATION"},
          {x:470,y:296,w:130,h:77,label:"ALTERNATIVES",sub:"WHEN SOLD OUT"}
        ].map((node,i)=><g key={node.label}>
          <rect x={node.x} y={node.y} width={node.w} height={node.h} rx="5" fill="url(#tijori-node)"
            stroke={i===2?"#d4e99d":"#5f9679"} strokeWidth={i===2?2.2:1.2}/>
          <text x={node.x+node.w/2} y={node.y+node.h/2-2} fill={i===2?"#dcefa7":"#f0f3de"}
            fontSize={i===2?17:13} fontWeight="650" letterSpacing=".4" textAnchor="middle">{node.label}</text>
          <text x={node.x+node.w/2} y={node.y+node.h/2+19} fill="#b6cdb1" fontSize="9.5"
            fontFamily="monospace" letterSpacing="1" textAnchor="middle">{node.sub}</text>
        </g>)}
        {[[216,114],[238,331],[475,142],[478,296]].map(([x,y],i)=>
          <circle key={i} cx={x} cy={y} r="4" fill="#d1e994" />)}
      </svg>
      <p>STORE SHELF · ONLINE BASKET · ONE INVENTORY</p>
    </div>
  </section>;
}
