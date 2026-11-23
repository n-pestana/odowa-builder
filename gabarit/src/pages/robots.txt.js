// robots.txt genere : le site dev interdit toute indexation, la prod l'autorise.
export function GET({ site }) {
  const estDev = import.meta.env.PUBLIC_ENV === 'dev';
  const lignes = estDev
    ? ['User-agent: *', 'Disallow: /']
    : ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('sitemap-index.xml', site).href}`];
  return new Response(lignes.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
