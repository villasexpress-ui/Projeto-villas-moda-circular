import { getStore } from '@netlify/blobs';

const STORE_NAME = 'projeto-villas-catalog';
const CATALOG_KEY = 'catalog-v1';
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
const json = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const getCatalog = async store => (await store.get(CATALOG_KEY, { type: 'json' })) || [];

export default async (req) => {
  if (req.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  const store = getStore(STORE_NAME);
  try {
    if (req.httpMethod === 'GET') {
      const products = await getCatalog(store);
      return json(200, { products });
    }
    if (req.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' });
    const body = JSON.parse(req.body || '{}');
    const expected = process.env.VILLAS_ADMIN_PASSWORD;
    if (!expected) return json(500, { error: 'A senha administrativa ainda não foi configurada no Netlify.' });
    if (body.action === 'login') {
      return body.password === expected ? json(200, { ok: true }) : json(401, { error: 'Senha incorreta.' });
    }
    if (body.password !== expected) return json(401, { error: 'Senha incorreta. Entre novamente no painel.' });
    let products = await getCatalog(store);
    if (body.action === 'save') {
      const p = body.product || {};
      if (!p.id || !String(p.name || '').trim() || !Number.isFinite(Number(p.price))) return json(400, { error: 'Confira nome, preço e identificação da peça.' });
      if (typeof p.image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(p.image) || p.image.length > 3_000_000) return json(400, { error: 'A foto é inválida ou muito grande. Use uma imagem de até 2 MB.' });
      const clean = {
        id: String(p.id), name: String(p.name).trim().slice(0, 90), price: Number(p.price),
        category: String(p.category || 'Outros').slice(0, 40), size: String(p.size || '').slice(0, 30),
        condition: String(p.condition || '').slice(0, 50), description: String(p.description || '').slice(0, 500), image: p.image
      };
      const index = products.findIndex(item => String(item.id) === clean.id);
      if (index >= 0) products[index] = clean; else products.unshift(clean);
      await store.setJSON(CATALOG_KEY, products);
      return json(200, { ok: true, products });
    }
    if (body.action === 'delete') {
      products = products.filter(item => String(item.id) !== String(body.id));
      await store.setJSON(CATALOG_KEY, products);
      return json(200, { ok: true, products });
    }
    return json(400, { error: 'Ação não reconhecida.' });
  } catch (error) {
    console.error('Projeto Villas catalog error:', error);
    return json(500, { error: 'Ocorreu um erro ao acessar o catálogo. Tente novamente.' });
  }
};
