// Formulaire de contact (Cloudflare Pages Function).
//
// Variables a definir dans Cloudflare Pages (voir INSTALLATION.md du depot usine) :
//   CONTACT_MODE        "simulation" = ne rien envoyer (tests locaux et CI)
//   CONTACT_EMAIL       destinataire reel (le client)
//   CONTACT_EXPEDITEUR  adresse d'expedition validee chez le fournisseur de mail
//   RESEND_API_KEY      cle du fournisseur de mail (Resend)
//   TURNSTILE_SECRET    cle secrete du captcha (facultatif)
//   CONTACT_JETON_TEST  secret partage avec la CI pour le test apres deploiement
//   CONTACT_EMAIL_TEST  boite qui recoit les envois de test (jamais le client)

const reponse = (corps, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const emailValide = (valeur) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);

export async function onRequestPost({ request, env }) {
  let champs;
  try {
    champs = Object.fromEntries(await request.formData());
  } catch {
    return reponse({ ok: false, erreur: 'requete-illisible' }, 400);
  }

  const nom = String(champs.nom ?? '').trim();
  const email = String(champs.email ?? '').trim();
  const message = String(champs.message ?? '').trim();

  // Champ piege : un robot le remplit, un humain ne le voit pas.
  if (String(champs.site_web ?? '') !== '') return reponse({ ok: true });

  if (!nom || !emailValide(email) || message.length < 5 || message.length > 5000) {
    return reponse({ ok: false, erreur: 'champs-invalides' }, 422);
  }

  const estTest =
    Boolean(env.CONTACT_JETON_TEST) && request.headers.get('x-test-contact') === env.CONTACT_JETON_TEST;

  if (env.CONTACT_MODE === 'simulation') return reponse({ ok: true, mode: 'simulation' });

  if (!estTest && env.TURNSTILE_SECRET) {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: String(champs['cf-turnstile-response'] ?? ''),
      }),
    });
    const resultat = await verification.json().catch(() => ({}));
    if (!resultat.success) return reponse({ ok: false, erreur: 'captcha' }, 403);
  }

  const destinataire = estTest ? env.CONTACT_EMAIL_TEST : env.CONTACT_EMAIL;
  if (!destinataire || !env.CONTACT_EXPEDITEUR || !env.RESEND_API_KEY) {
    return reponse({ ok: false, erreur: 'configuration-manquante' }, 500);
  }

  const envoi = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACT_EXPEDITEUR,
      to: [destinataire],
      reply_to: email,
      subject: `${estTest ? '[TEST] ' : ''}Message du site - ${nom}`,
      text: `Nom : ${nom}\nE-mail : ${email}\n\n${message}`,
    }),
  });

  if (!envoi.ok) return reponse({ ok: false, erreur: 'envoi-refuse' }, 502);
  return reponse({ ok: true, mode: estTest ? 'test' : 'reel' });
}
