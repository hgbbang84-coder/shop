// @ts-nocheck
interface Env { DB:D1Database; ASSETS:Fetcher }
const products=[['bag','미니멀 토트백',89000,'잡화','각을 살린 검정 가죽 토트백'],['watch','클래식 손목시계',145000,'잡화','흰 문자판에 검정 가죽 밴드'],['perfume','시트러스 오드뚜왈렛',78000,'뷰티','상쾌한 시트러스 계열 향수'],['lipstick','매트 레드 립스틱',32000,'뷰티','발색이 선명한 매트 타입'],['shoe','러닝화 블루',112000,'신발','쿠션이 두꺼운 남성 러닝화'],['shoe2','러닝화 핑크',112000,'신발','같은 모델의 여성 러닝화'],['wine','레드와인 피노타지',42000,'식품','남아프리카산 드라이 레드와인'],['pasta','이탈리아 파스타 면',6500,'식품','세몰리나 100% 숏 파스타 450g']] as const;
const out=(x:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json',...headers}});
async function ensureSchema(db:D1Database){
 await db.prepare('CREATE TABLE IF NOT EXISTS schema_meta(version INTEGER NOT NULL)').run();
 const v=await db.prepare('SELECT version FROM schema_meta LIMIT 1').first<{version:number}>();
 if(v?.version===2)return;
 const sql=[
  'CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE)',
  "INSERT OR IGNORE INTO categories VALUES ('잡화','잡화'),('뷰티','뷰티'),('신발','신발'),('식품','식품')",
  'CREATE TABLE products_new(id TEXT PRIMARY KEY,name TEXT NOT NULL,price INTEGER NOT NULL,category_id TEXT NOT NULL,description TEXT NOT NULL,image_url TEXT NOT NULL,FOREIGN KEY(category_id) REFERENCES categories(id))',
  'INSERT INTO products_new SELECT p.id,p.name,p.price,c.id,p.description,p.image_url FROM products p JOIN categories c ON c.id=p.category',
  'CREATE TABLE users_new(id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,name TEXT NOT NULL)',
  'INSERT INTO users_new SELECT id,email,password_hash,name FROM users',
  'CREATE TABLE guest_sessions_new(token_hash TEXT PRIMARY KEY,user_id TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users_new(id) ON DELETE CASCADE)',
  'INSERT INTO guest_sessions_new SELECT token_hash,user_id,created_at FROM guest_sessions',
  'CREATE TABLE cart_items_new(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,product_id TEXT NOT NULL,qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 99),UNIQUE(user_id,product_id),FOREIGN KEY(user_id) REFERENCES users_new(id) ON DELETE CASCADE,FOREIGN KEY(product_id) REFERENCES products_new(id))',
  'INSERT INTO cart_items_new SELECT id,user_id,product_id,qty FROM cart_items',
  'CREATE TABLE orders_new(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN (\'pending\',\'paid\')),created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users_new(id) ON DELETE CASCADE)',
  'INSERT INTO orders_new SELECT id,user_id,total,status,created_at FROM orders',
  'CREATE TABLE order_items_new(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,product_id TEXT NOT NULL,qty INTEGER NOT NULL,price INTEGER NOT NULL,FOREIGN KEY(order_id) REFERENCES orders_new(id) ON DELETE CASCADE,FOREIGN KEY(product_id) REFERENCES products_new(id))',
  'INSERT INTO order_items_new SELECT id,order_id,product_id,qty,price FROM order_items',
  'DROP TABLE order_items; DROP TABLE orders; DROP TABLE cart_items; DROP TABLE guest_sessions; DROP TABLE users; DROP TABLE products',
  'ALTER TABLE products_new RENAME TO products; ALTER TABLE users_new RENAME TO users; ALTER TABLE guest_sessions_new RENAME TO guest_sessions; ALTER TABLE cart_items_new RENAME TO cart_items; ALTER TABLE orders_new RENAME TO orders; ALTER TABLE order_items_new RENAME TO order_items',
  'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
  'CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_cart_product ON cart_items(product_id)',
  'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)',
  'CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)',
  'DELETE FROM schema_meta; INSERT INTO schema_meta VALUES (2)'
 ];
 await db.batch(sql.flatMap(x=>x.split(';').filter(Boolean).map(s=>db.prepare(s))));
 for(const p of products)await db.prepare('INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?)').bind(p[0],p[1],p[2],p[3],p[4],`/products/${p[0]}.jpg`).run();
}
async function sess(req:Request,db:D1Database){let token=req.headers.get('Cookie')?.match(/shop_session=([^;]+)/)?.[1]||crypto.randomUUID();const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));const hash=[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');let row=await db.prepare('SELECT user_id FROM guest_sessions WHERE token_hash=?').bind(hash).first<{user_id:string}>();let fresh=!row;if(!row){const id=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO users(id,name) VALUES(?,?)').bind(id,'guest'),db.prepare('INSERT INTO guest_sessions VALUES(?,?,?)').bind(hash,id,new Date().toISOString())]);row={user_id:id}}return{id:row.user_id,token,fresh}}
export default {async fetch(req:Request,env:Env){try{await ensureSchema(env.DB);const u=new URL(req.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);const p=u.pathname.slice(5).split('/');const s=await sess(req,env.DB);const h=s.fresh?{'Set-Cookie':`shop_session=${s.token}; HttpOnly; Secure; SameSite=Lax; Path=/`}:{};
 if(p[0]==='products'){if(p[1]){const x=await env.DB.prepare('SELECT p.*,c.name category FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=?').bind(p[1]).first();return x?out(x,200,h):out({error:'not found'},404)}const c=u.searchParams.get('category');const q=c&&c!=='전체'?'SELECT p.*,c.name category FROM products p JOIN categories c ON c.id=p.category_id WHERE c.id=?':'SELECT p.*,c.name category FROM products p JOIN categories c ON c.id=p.category_id';const x=c&&c!=='전체'?await env.DB.prepare(q).bind(c).all():await env.DB.prepare(q).all();return out(x.results,200,h)}
 if(p[0]==='cart'&&p[1]==='items'&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM cart_items WHERE id=? AND user_id=?').bind(p[2],s.id).run();return new Response(null,{status:204,headers:h})}
 if(p[0]==='cart'&&req.method==='GET'){const x=await env.DB.prepare('SELECT ci.id,ci.qty,p.id productId,p.name,p.price,p.description,cat.name category,p.image_url imageUrl,ci.qty*p.price subtotal FROM cart_items ci JOIN products p ON p.id=ci.product_id JOIN categories cat ON cat.id=p.category_id WHERE ci.user_id=?').bind(s.id).all();const total=(x.results as any[]).reduce((n,r)=>n+r.subtotal,0);return out({items:x.results,total},200,h)}
 if(p[0]==='cart'&&p[1]==='items'){const b=await req.json().catch(()=>({}));const qty=Number((b as any).qty);if(!Number.isInteger(qty)||qty<1||qty>99)return out({error:'qty'},422);if(req.method==='POST'){const id=String((b as any).productId);if(!await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(id).first())return out({error:'product'},404);await env.DB.prepare('INSERT INTO cart_items(user_id,product_id,qty) VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET qty=MIN(99,cart_items.qty+excluded.qty)').bind(s.id,id,qty).run()}else await env.DB.prepare('UPDATE cart_items SET qty=? WHERE id=? AND user_id=?').bind(qty,p[2],s.id).run();return new Response(null,{status:204,headers:h})}
 if(p[0]==='orders'&&req.method==='POST'){const x=await env.DB.prepare('SELECT c.product_id,c.qty,p.price FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=?').bind(s.id).all();if(!x.results.length)return out({error:'empty'},409);const id=crypto.randomUUID(),total=(x.results as any[]).reduce((n,r)=>n+r.qty*r.price,0);await env.DB.batch([env.DB.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').bind(id,s.id,total,'pending',new Date().toISOString()),...(x.results as any[]).map(r=>env.DB.prepare('INSERT INTO order_items(order_id,product_id,qty,price) VALUES(?,?,?,?)').bind(id,r.product_id,r.qty,r.price)),env.DB.prepare('DELETE FROM cart_items WHERE user_id=?').bind(s.id)]);return out({id,total,items:x.results},201,h)}
 if(p[0]==='orders'&&p[1]){const o=await env.DB.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(p[1],s.id).first();if(!o)return out({error:'not found'},404);const i=await env.DB.prepare('SELECT oi.*,p.name,p.image_url imageUrl FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE order_id=?').bind(p[1]).all();return out({...o,items:i.results},200,h)}return out({error:'not found'},404)}catch(e){return out({error:'server'},500)}}}
