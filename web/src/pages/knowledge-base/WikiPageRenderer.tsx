import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface WikiPageRendererProps {
  content: string
  onLinkClick?: (slug: string) => void
}

// ---------------------------------------------------------------------------
// Minimal MD5 (sync, browser-safe) — matches Python hashlib.md5 output
// Used to replicate the backend _slugify() for CJK-only page titles.
// ---------------------------------------------------------------------------
function _md5Hex(str: string): string {
  function safeAdd(x: number, y: number) { const lsw=(x&0xFFFF)+(y&0xFFFF); return (((x>>16)+(y>>16)+(lsw>>16))<<16)|(lsw&0xFFFF) }
  function bitRotateLeft(num: number, cnt: number) { return (num<<cnt)|(num>>>(32-cnt)) }
  function md5cmn(q:number,a:number,b:number,x:number,s:number,t:number){return safeAdd(bitRotateLeft(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b)}
  function md5ff(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn((b&c)|((~b)&d),a,b,x,s,t)}
  function md5gg(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn((b&d)|(c&(~d)),a,b,x,s,t)}
  function md5hh(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn(b^c^d,a,b,x,s,t)}
  function md5ii(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn(c^(b|(~d)),a,b,x,s,t)}
  function utf8Encode(s: string) {
    let out=''; for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<128){out+=String.fromCharCode(c)}else if(c<2048){out+=String.fromCharCode((c>>6)|192,((c&63)|128))}else{out+=String.fromCharCode((c>>12)|224,((c>>6)&63)|128,((c&63)|128))}}return out
  }
  function strToM(s:string){const l=s.length;const nblk=((l+8)>>6)+1;const blks=new Array(nblk*16).fill(0);let i=0;for(;i<l;i++)blks[i>>2]|=s.charCodeAt(i)<<((i%4)*8);blks[i>>2]|=0x80<<((i%4)*8);blks[nblk*16-2]=l*8;return blks}
  const m=strToM(utf8Encode(str));
  let a=1732584193,b=-271733879,c=-1732584194,d=271733878;
  for(let i=0;i<m.length;i+=16){
    const [oa,ob,oc,od]=[a,b,c,d];
    a=md5ff(a,b,c,d,m[i],7,-680876936);d=md5ff(d,a,b,c,m[i+1],12,-389564586);c=md5ff(c,d,a,b,m[i+2],17,606105819);b=md5ff(b,c,d,a,m[i+3],22,-1044525330);
    a=md5ff(a,b,c,d,m[i+4],7,-176418897);d=md5ff(d,a,b,c,m[i+5],12,1200080426);c=md5ff(c,d,a,b,m[i+6],17,-1473231341);b=md5ff(b,c,d,a,m[i+7],22,-45705983);
    a=md5ff(a,b,c,d,m[i+8],7,1770035416);d=md5ff(d,a,b,c,m[i+9],12,-1958414417);c=md5ff(c,d,a,b,m[i+10],17,-42063);b=md5ff(b,c,d,a,m[i+11],22,-1990404162);
    a=md5ff(a,b,c,d,m[i+12],7,1804603682);d=md5ff(d,a,b,c,m[i+13],12,-40341101);c=md5ff(c,d,a,b,m[i+14],17,-1502002290);b=md5ff(b,c,d,a,m[i+15],22,1236535329);
    a=md5gg(a,b,c,d,m[i+1],5,-165796510);d=md5gg(d,a,b,c,m[i+6],9,-1069501632);c=md5gg(c,d,a,b,m[i+11],14,643717713);b=md5gg(b,c,d,a,m[i],20,-373897302);
    a=md5gg(a,b,c,d,m[i+5],5,-701558691);d=md5gg(d,a,b,c,m[i+10],9,38016083);c=md5gg(c,d,a,b,m[i+15],14,-660478335);b=md5gg(b,c,d,a,m[i+4],20,-405537848);
    a=md5gg(a,b,c,d,m[i+9],5,568446438);d=md5gg(d,a,b,c,m[i+14],9,-1019803690);c=md5gg(c,d,a,b,m[i+3],14,-187363961);b=md5gg(b,c,d,a,m[i+8],20,1163531501);
    a=md5gg(a,b,c,d,m[i+13],5,-1444681467);d=md5gg(d,a,b,c,m[i+2],9,-51403784);c=md5gg(c,d,a,b,m[i+7],14,1735328473);b=md5gg(b,c,d,a,m[i+12],20,-1926607734);
    a=md5hh(a,b,c,d,m[i+5],4,-378558);d=md5hh(d,a,b,c,m[i+8],11,-2022574463);c=md5hh(c,d,a,b,m[i+11],16,1839030562);b=md5hh(b,c,d,a,m[i+14],23,-35309556);
    a=md5hh(a,b,c,d,m[i+1],4,-1530992060);d=md5hh(d,a,b,c,m[i+4],11,1272893353);c=md5hh(c,d,a,b,m[i+7],16,-155497632);b=md5hh(b,c,d,a,m[i+10],23,-1094730640);
    a=md5hh(a,b,c,d,m[i+13],4,681279174);d=md5hh(d,a,b,c,m[i],11,-358537222);c=md5hh(c,d,a,b,m[i+3],16,-722521979);b=md5hh(b,c,d,a,m[i+6],23,76029189);
    a=md5hh(a,b,c,d,m[i+9],4,-640364487);d=md5hh(d,a,b,c,m[i+12],11,-421815835);c=md5hh(c,d,a,b,m[i+15],16,530742520);b=md5hh(b,c,d,a,m[i+2],23,-995338651);
    a=md5ii(a,b,c,d,m[i],6,-198630844);d=md5ii(d,a,b,c,m[i+7],10,1126891415);c=md5ii(c,d,a,b,m[i+14],15,-1416354905);b=md5ii(b,c,d,a,m[i+5],21,-57434055);
    a=md5ii(a,b,c,d,m[i+12],6,1700485571);d=md5ii(d,a,b,c,m[i+3],10,-1894986606);c=md5ii(c,d,a,b,m[i+10],15,-1051523);b=md5ii(b,c,d,a,m[i+1],21,-2054922799);
    a=md5ii(a,b,c,d,m[i+8],6,1873313359);d=md5ii(d,a,b,c,m[i+15],10,-30611744);c=md5ii(c,d,a,b,m[i+6],15,-1560198380);b=md5ii(b,c,d,a,m[i+13],21,1309151649);
    a=md5ii(a,b,c,d,m[i+4],6,-145523070);d=md5ii(d,a,b,c,m[i+11],10,-1120210379);c=md5ii(c,d,a,b,m[i+2],15,718787259);b=md5ii(b,c,d,a,m[i+9],21,-343485551);
    a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od);
  }
  function hex(n: number) { let s=''; for(let i=0;i<4;i++) s+=('0'+((n>>>(i*8))&0xff).toString(16)).slice(-2); return s }
  return hex(a)+hex(b)+hex(c)+hex(d)
}

/**
 * Mirrors the Python _slugify() in ai-service/app/api/wiki.py exactly.
 * Python's re \w is Unicode-aware (keeps CJK); JS \w is ASCII-only.
 * We use \p{L}\p{N} Unicode property escapes (ES2018+) to match Python behavior.
 * Falls back to "p-{md5[:12]}" for symbol-only text with no letters/digits.
 */
function _slugify(text: string): string {
  const s = text.trim()
  let slug = s.toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')  // keep Unicode letters (incl. CJK), digits, spaces, hyphens
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  if (!slug || slug.length < 2) {
    slug = 'p-' + _md5Hex(s).slice(0, 12)
  }
  return slug
}

/**
 * Pre-process markdown content: replace [[Wiki Link]] with [Wiki Link](wiki:slug)
 * BEFORE remark parses it. This avoids issues where remark breaks apart [[...]] brackets
 * during tokenization, causing text-node visitors to miss the pattern.
 */
function preprocessWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_match, label: string) => {
    const slug = _slugify(label.trim())
    return `[${label}](wiki:${slug})`
  })
}

export default function WikiPageRenderer({ content, onLinkClick }: WikiPageRendererProps) {
  const processedContent = preprocessWikiLinks(content)
  return (
    <div className="wiki-page-content" style={{ lineHeight: 1.7 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('wiki:')) {
              const slug = decodeURIComponent(href.slice(5))
              return (
                <a
                  href="#"
                  style={{ color: '#722ed1', textDecoration: 'underline dotted' }}
                  onClick={(e) => {
                    e.preventDefault()
                    onLinkClick?.(slug)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
          h1: ({ children }) => <h1 style={{ fontSize: 22, marginTop: 16, marginBottom: 8 }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: 18, marginTop: 14, marginBottom: 6 }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: 15, marginTop: 12, marginBottom: 4 }}>{children}</h3>,
          code: ({ children, className }) => {
            const isBlock = className?.startsWith('language-')
            if (isBlock) {
              return (
                <pre style={{ background: '#f6f8fa', padding: '12px 16px', borderRadius: 6, overflow: 'auto', fontSize: 13 }}>
                  <code>{children}</code>
                </pre>
              )
            }
            return (
              <code style={{ background: '#f0f0f0', padding: '1px 6px', borderRadius: 3, fontSize: '0.9em' }}>{children}</code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: '4px solid #722ed1', paddingLeft: 12, color: '#555', margin: '8px 0' }}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ border: '1px solid #ddd', padding: '6px 10px', background: '#fafafa', textAlign: 'left' }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{ border: '1px solid #ddd', padding: '6px 10px' }}>{children}</td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
