// NOYAU (reserve, mis a jour chez les clients) : robots.txt, declare par astro.config.mjs.
// Le site de test interdit toute indexation, le site en ligne l'autorise.
export function GET({ site }) {
  const estDev = import.meta.env.PUBLIC_ENV === 'dev';
  const lignes = estDev
    ? ['User-agent: *', 'Disallow: /']
    : ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('sitemap-index.xml', site).href}`];
  return new Response(lignes.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
