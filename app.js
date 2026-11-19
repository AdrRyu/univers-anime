'use strict';
const sb = supabase.createClient(CONFIG.URL, CONFIG.KEY);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUTS = { termine: 'Terminé', en_cours: 'En cours', a_venir: 'À venir' };
const GENRES = ['Action', 'Aventure', 'Comédie', 'Drame', 'Fantasy', 'Horreur', 'Isekai', 'Mecha', 'Psychologique', 'Romance', 'Science-fiction', 'Slice of life', 'Sport', 'Surnaturel', 'Thriller'];
let user = null, profil = null;

/* ---------- Outils ---------- */
function toast(m, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = m;
  document.body.append(t);
  setTimeout(() => t.remove(), 4200);
}
const date = d => new Date(d).toLocaleDateString('fr-FR');
const nomP = p => [p.prenom, p.nom].filter(Boolean).join(' ');
const vignette = (u, t) => u ? `<img src="${esc(u)}" alt="${esc(t)}" loading="lazy">` : `<div class="vide">${esc((t || '?')[0].toUpperCase())}</div>`;
const carteO = o => `<a class="carte" href="#/oeuvre/${o.id}">${vignette(o.image_url, o.titre)}<div class="carte-t"><b>${esc(o.titre)}</b><span>${o.type === 'manga' ? 'Manga' : 'Animé'}${o.date_sortie ? ' (' + o.date_sortie.slice(0, 4) + ')' : ''}</span></div></a>`;
const carteP = p => `<a class="carte" href="#/personnage/${p.id}">${vignette(p.image_url, p.nom)}<div class="carte-t"><b>${esc(nomP(p))}</b><span>${p.vues} vue${p.vues > 1 ? 's' : ''}</span></div></a>`;
const grille = (items, fn, vide) => items && items.length ? `<div class="grille">${items.map(fn).join('')}</div>` : `<p class="vide-txt">${vide}</p>`;
const section = (titre, html, plus) => `<div class="titre-sec"><h2>${titre}</h2>${plus ? `<a href="${plus}">Tout voir</a>` : ''}</div>${html}`;
const ligne = (l, v) => v ? `<div class="ligne"><dt>${l}</dt><dd>${esc(v)}</dd></div>` : '';
const ligneH = (l, h) => h ? `<div class="ligne"><dt>${l}</dt><dd>${h}</dd></div>` : '';
const lienRech = t => t ? `<a href="#/recherche/${encodeURIComponent(t)}">${esc(t)}</a>` : '';
const attrs = o => Object.entries(o).map(([k, v]) => v === true ? k : `${k}="${esc(v)}"`).join(' ');
const champ = (n, l, t = 'text', o = {}) => `<label>${l}${t === 'textarea' ? `<textarea name="${n}" ${attrs(o)}></textarea>` : `<input name="${n}" type="${t}" ${attrs(o)}>`}</label>`;
const choix = (n, l, opts, vide = '') => `<label>${l}<select name="${n}">${vide !== null ? `<option value="">${vide}</option>` : ''}${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`;
const bandeauAttente = x => x && x.publication !== 'publie' ? `<p class="bloc">Cette fiche est <b>en attente de validation</b> par un modérateur${x.publication === 'refuse' ? ' (refusée)' : ''}. Toi seul et les modérateurs la voient.</p>` : '';
const introuvable = () => `<div class="bloc etroit"><h1>Page introuvable</h1><p>Cette fiche n’existe pas ou n’est pas encore publiée.</p><a class="btn" href="#/">Retour à l’accueil</a></div>`;

async function envoyer(fichier, bucket) {
  const max = bucket === 'avatars' ? 2 : 5;
  if (fichier.size > max * 1e6) throw new Error(`Image trop lourde (${max} Mo maximum).`);
  const ext = (fichier.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const chemin = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(chemin, fichier, { contentType: fichier.type });
  if (error) throw error;
  return sb.storage.from(bucket).getPublicUrl(chemin).data.publicUrl;
}

/* ---------- Navigation et session ---------- */
function nav() {
  const initiale = esc((profil?.pseudo || '?')[0].toUpperCase());
  $('#compte').innerHTML = user
    ? `<a href="#/profil" class="pastille" title="Mon profil">${profil?.avatar_url ? `<img src="${esc(profil.avatar_url)}" alt="">` : initiale}</a><button class="btn petit sec" id="deco">Se déconnecter</button>`
    : `<a href="#/connexion" class="btn petit">Se connecter</a>`;
  $('#deco')?.addEventListener('click', () => sb.auth.signOut());
}
async function charger(u) {
  user = u; profil = null;
  if (user) { const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle(); profil = data; }
  nav(); route();
}
document.addEventListener('submit', e => {
  if (e.target.classList.contains('rech')) {
    e.preventDefault();
    const q = new FormData(e.target).get('q').trim();
    if (q) location.hash = '#/recherche/' + encodeURIComponent(q);
  }
});
window.addEventListener('hashchange', route);

async function route() {
  const [chemin, qs] = (location.hash.slice(1) || '/').split('?');
  const q = new URLSearchParams(qs || '');
  const [a, b] = chemin.split('/').filter(Boolean);
  app.innerHTML = '<div class="charge">Chargement…</div>';
  window.scrollTo(0, 0);
  try {
    if (!a) await accueil();
    else if (a === 'catalogue') await catalogue(b, q);
    else if (a === 'recherche') await recherche(decodeURIComponent(b || ''));
    else if (a === 'oeuvre') await ficheO(+b);
    else if (a === 'personnage') await ficheP(+b);
    else if (a === 'connexion') connexion(q.get('mode'));
    else if (a === 'profil') await pageProfil(b ? decodeURIComponent(b) : null);
    else if (a === 'ajouter') await formFiche(b);
    else app.innerHTML = introuvable();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="bloc"><h1>Une erreur est survenue</h1><p>${esc(e.message || e)}</p><a class="btn" href="#/">Retour à l’accueil</a></div>`;
  }
}

/* ---------- Accueil ---------- */
async function accueil() {
  const pub = t => sb.from(t).select('*').eq('publication', 'publie');
  const [pop, rec, per, an, cm] = await Promise.all([
    pub('oeuvres').order('vues', { ascending: false }).limit(6),
    pub('oeuvres').order('created_at', { ascending: false }).limit(6),
    pub('personnages').order('vues', { ascending: false }).limit(6),
    sb.from('anecdotes').select('texte,created_at,oeuvre_id,personnage_id').eq('publication', 'publie').order('created_at', { ascending: false }).limit(5),
    sb.from('commentaires').select('texte,created_at,oeuvre_id,personnage_id,profiles(pseudo)').order('created_at', { ascending: false }).limit(5)
  ]);
  for (const r of [pop, rec, per]) if (r.error) throw r.error;
  const contribs = [...(an.data || []).map(x => ({ ...x, t: 'Anecdote' })), ...(cm.data || []).map(x => ({ ...x, t: `Commentaire de ${x.profiles?.pseudo || 'un membre'}` }))]
    .sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 6);
  const vide = `Aucune fiche pour l’instant. <a href="#/ajouter/anime">Ajoute la première.</a>`;
   app.innerHTML = `
    <section class="hero-neon">
      <span class="hero-v g">アニメの世界へ</span><span class="hero-v d">一緒に探そう</span>
      <span class="hero-jp">ようこそ</span>
      <h1>AnimeVerse</h1>
      <p class="hero-slogan">Ton portail dédié aux animés</p>
      <p class="hero-texte">Fiches d’animés, de mangas et de personnages écrites par la communauté. Plonge dans l’univers de tes œuvres préférées !</p>
      <form class="rech rech-neon" role="search"><input type="search" name="q" placeholder="Rechercher un animé, un personnage…" aria-label="Rechercher" required><button class="btn">Rechercher »</button></form>
      <div class="hero-cartes">
        <a class="hero-carte" href="#/catalogue/anime"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 3l4 4 4-4"/><path d="M10.5 10.5v5l4-2.5z"/></svg><span><b>Animés</b><small>Découvre une vaste sélection d’animés</small></span><i class="fl">›</i></a>
        <a class="hero-carte" href="#/catalogue/personnage"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span><b>Personnages</b><small>Apprends-en plus sur tes héros préférés</small></span><i class="fl">›</i></a>
        <a class="hero-carte" href="#/catalogue/manga"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/></svg><span><b>Mangas</b><small>Explore les mangas et leurs histoires</small></span><i class="fl">›</i></a>
        <a class="hero-carte" href="#/ajouter/anime"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg><span><b>Contribuer</b><small>Ajoute des fiches et rejoins la communauté</small></span><i class="fl">›</i></a>
      </div>
      <a class="btn-explore" href="#/catalogue/anime">Explore dès maintenant »</a>
      <button type="button" class="hero-fleche" aria-label="Voir la suite" onclick="document.querySelector('.titre-sec').scrollIntoView({behavior:'smooth'})">↓</button>
    </section>
    ${section('Animés et mangas populaires', grille(pop.data, carteO, vide), '#/catalogue/anime?tri=vues')}
    ${section('Dernières fiches ajoutées', grille(rec.data, carteO, 'Les nouvelles fiches apparaîtront ici.'), '#/catalogue/anime')}
    ${section('Personnages les plus consultés', grille(per.data, carteP, `Aucun personnage pour l’instant. <a href="#/ajouter/personnage">Crée la première fiche.</a>`), '#/catalogue/personnage?tri=vues')}
    ${section('Dernières contributions', contribs.length ? `<div class="bloc">${contribs.map(c => `<p class="anec"><b>${esc(c.t)}</b> <a href="#/${c.oeuvre_id ? 'oeuvre/' + c.oeuvre_id : 'personnage/' + c.personnage_id}">voir la fiche</a><br>${esc(c.texte.slice(0, 160))}</p>`).join('')}</div>` : '<p class="vide-txt">Les anecdotes et commentaires de la communauté apparaîtront ici.</p>')}`;
}

/* ---------- Catalogue et recherche ---------- */
async function catalogue(type, q) {
  const perso = type === 'personnage';
  const titre = perso ? 'Personnages' : type === 'manga' ? 'Mangas' : 'Animés';
  let req = perso ? sb.from('personnages').select('*') : sb.from('oeuvres').select('*').eq('type', type === 'manga' ? 'manga' : 'anime');
  req = req.eq('publication', 'publie');
  if (!perso) {
    if (q.get('genre')) req = req.contains('genres', [q.get('genre')]);
    if (q.get('statut')) req = req.eq('statut', q.get('statut'));
    const an = q.get('annee');
    if (/^\d{4}$/.test(an || '')) req = req.gte('date_sortie', an + '-01-01').lte('date_sortie', an + '-12-31');
  }
  const tri = q.get('tri') || 'recent';
  req = tri === 'vues' ? req.order('vues', { ascending: false }) : tri === 'nom' ? req.order(perso ? 'nom' : 'titre') : req.order('created_at', { ascending: false });
  const { data, error } = await req.limit(60);
  if (error) throw error;
  const tris = [['recent', 'Plus récents'], ['vues', 'Plus populaires'], ['nom', 'Ordre alphabétique']];
  app.innerHTML = `<h1>${titre}</h1>
    <form class="filtres" id="f-filtres">
      ${choix('tri', 'Trier par', tris, null)}
      ${perso ? '' : choix('genre', 'Genre', GENRES.map(g => [g, g]), 'Tous') + choix('statut', 'Statut', Object.entries(STATUTS), 'Tous') + champ('annee', 'Année', 'number', { min: 1950, max: 2100, placeholder: 'Toutes' })}
      <button class="btn">Filtrer</button></form>
    ${grille(data, perso ? carteP : carteO, `Aucun résultat. <a href="#/ajouter/${perso ? 'personnage' : type || 'anime'}">Ajoute une fiche.</a>`)}`;
  const f = $('#f-filtres');
  for (const [k, v] of q) { if (f.elements[k]) f.elements[k].value = v; }
  f.addEventListener('submit', e => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(f)) if (v) p.set(k, v);
    location.hash = `#/catalogue/${type}?${p}`;
  });
}

async function recherche(terme) {
  const t = terme.replace(/[,()%*]/g, ' ').trim();
  if (!t) { app.innerHTML = '<div class="bloc"><p>Saisis un mot dans la barre de recherche.</p></div>'; return; }
  const m = `%${t}%`;
  const [o, p] = await Promise.all([
    sb.from('oeuvres').select('*').eq('publication', 'publie').or(`titre.ilike.${m},titre_original.ilike.${m},auteur.ilike.${m},studio.ilike.${m},realisateur.ilike.${m}`).order('vues', { ascending: false }).limit(40),
    sb.from('personnages').select('*').eq('publication', 'publie').or(`nom.ilike.${m},prenom.ilike.${m}`).order('vues', { ascending: false }).limit(40)
  ]);
  if (o.error) throw o.error;
  if (p.error) throw p.error;
  app.innerHTML = `<h1>Résultats pour « ${esc(t)} »</h1>
    ${section('Animés et mangas', grille(o.data, carteO, 'Aucune œuvre trouvée.'))}
    ${section('Personnages', grille(p.data, carteP, 'Aucun personnage trouvé.'))}
    <p class="vide-txt">Tu ne trouves pas ce que tu cherches ? <a href="#/ajouter/anime">Ajoute la fiche.</a></p>`;
}

/* ---------- Anecdotes et commentaires (communs aux deux types de fiche) ---------- */
async function communaute(col, id) {
  const [an, cm] = await Promise.all([
    sb.from('anecdotes').select('id,texte,publication').eq(col, id).order('created_at', { ascending: false }),
    sb.from('commentaires').select('id,texte,created_at,auteur_id,profiles(pseudo)').eq(col, id).order('created_at', { ascending: false })
  ]);
  const co = user ? '' : `<p class="vide-txt"><a href="#/connexion">Connecte-toi</a> pour participer.</p>`;
  return `<section class="bloc"><h2>Anecdotes</h2>
      ${an.data?.length ? an.data.map(a => `<p class="anec">${esc(a.texte)}${a.publication !== 'publie' ? '<em class="badge">En attente</em>' : ''}</p>`).join('') : '<p class="vide-txt">Aucune anecdote pour l’instant.</p>'}
      ${user ? `<form id="f-anec"><textarea name="texte" required minlength="5" maxlength="2000" placeholder="Partage une anecdote sur cette fiche"></textarea><div><button class="btn petit">Proposer l’anecdote</button></div></form>` : co}</section>
    <section class="bloc"><h2>Commentaires (${cm.data?.length || 0})</h2>
      ${cm.data?.map(c => `<div class="comm"><small>${lienProfil(c.profiles?.pseudo)} le ${date(c.created_at)}${user && (c.auteur_id === user.id || ['moderateur', 'admin'].includes(profil?.role)) ? ` <a href="#" data-suppr="${c.id}">Supprimer</a>` : ''}</small>${esc(c.texte)}</div>`).join('') || '<p class="vide-txt">Sois le premier à commenter.</p>'}
      ${user ? `<form id="f-comm"><textarea name="texte" required maxlength="2000" placeholder="Ton commentaire"></textarea><div><button class="btn petit">Publier le commentaire</button></div></form>` : co}</section>`;
}
const lienProfil = p => p ? `<a href="#/profil/${encodeURIComponent(p)}">${esc(p)}</a>` : 'un membre';
function lierCommunaute(col, id) {
  const envoi = (sel, table, extra, msg) => $(sel)?.addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await sb.from(table).insert({ [col]: id, texte: new FormData(e.target).get('texte').trim(), ...extra });
    if (error) return toast(error.message, true);
    toast(msg); route();
  });
  envoi('#f-anec', 'anecdotes', {}, 'Anecdote envoyée : elle sera visible après validation.');
  envoi('#f-comm', 'commentaires', { auteur_id: user?.id }, 'Commentaire publié.');
  $$('[data-suppr]').forEach(a => a.addEventListener('click', async e => {
    e.preventDefault();
    if (!confirm('Supprimer ce commentaire ?')) return;
    const { error } = await sb.from('commentaires').delete().eq('id', a.dataset.suppr);
    if (error) return toast(error.message, true);
    toast('Commentaire supprimé.'); route();
  }));
  $('#signaler')?.addEventListener('click', async () => {
    const raison = prompt('Pourquoi signales-tu cette fiche ?');
    if (!raison) return;
    const { error } = await sb.from('signalements').insert({ cible_type: col === 'oeuvre_id' ? 'oeuvre' : 'personnage', cible_id: String(id), raison, auteur_id: user.id });
    toast(error ? error.message : 'Merci, le signalement a été transmis aux modérateurs.', !!error);
  });
}
const boutonSignaler = () => user ? `<button class="btn petit sec" id="signaler">Signaler un problème</button>` : '';

/* ---------- Fiche d’une œuvre ---------- */
async function ficheO(id) {
  const { data: o, error } = await sb.from('oeuvres').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!o) { app.innerHTML = introuvable(); return; }
  if (o.publication === 'publie') sb.rpc('incrementer_vue', { p_type: 'oeuvre', p_id: id });
  const [pl, com] = await Promise.all([
    sb.from('oeuvre_personnages').select('role,personnages(*)').eq('oeuvre_id', id),
    communaute('oeuvre_id', id)
  ]);
  const persos = (pl.data || []).map(x => x.personnages).filter(Boolean);
  app.innerHTML = `${bandeauAttente(o)}
    <div class="fiche"><div class="aff">${vignette(o.image_url, o.titre)}</div>
    <div><h1>${esc(o.titre)}</h1>${o.titre_original ? `<p class="orig">${esc(o.titre_original)}</p>` : ''}
      <dl>${ligne('Type', o.type === 'manga' ? 'Manga' : 'Animé')}
        ${ligne('Statut', STATUTS[o.statut])}
        ${ligne('Date de sortie', o.date_sortie ? date(o.date_sortie) : '')}
        ${ligne('Épisodes', o.nb_episodes)}${ligne('Saisons', o.nb_saisons)}
        ${ligneH('Studio', lienRech(o.studio))}${ligneH('Auteur', lienRech(o.auteur))}${ligneH('Réalisateur', lienRech(o.realisateur))}
        ${ligneH('Genres', o.genres?.length ? `<div class="puces">${o.genres.map(g => `<a class="puce" href="#/catalogue/${o.type}?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>` : '')}</dl>
      <p>${boutonSignaler()}</p></div></div>
    ${o.synopsis ? `<section class="bloc"><h2>Synopsis</h2><p class="synopsis">${esc(o.synopsis)}</p></section>` : ''}
    ${o.infos ? `<section class="bloc"><h2>Informations complémentaires</h2><p class="synopsis">${esc(o.infos)}</p></section>` : ''}
    <section>${section('Personnages', grille(persos, carteP, `Aucun personnage associé. <a href="#/ajouter/personnage">Crée une fiche.</a>`))}</section>
    ${com}`;
  lierCommunaute('oeuvre_id', id);
}

/* ---------- Fiche d’un personnage ---------- */
async function ficheP(id) {
  const { data: p, error } = await sb.from('personnages').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!p) { app.innerHTML = introuvable(); return; }
  if (p.publication === 'publie') sb.rpc('incrementer_vue', { p_type: 'personnage', p_id: id });
  const [ol, gal, fav, com] = await Promise.all([
    sb.from('oeuvre_personnages').select('role,oeuvres(*)').eq('personnage_id', id),
    sb.from('galerie').select('*').eq('personnage_id', id).order('created_at', { ascending: false }),
    user ? sb.from('favoris').select('personnage_id').eq('user_id', user.id).eq('personnage_id', id).maybeSingle() : { data: null },
    communaute('personnage_id', id)
  ]);
  const oeuvres = (ol.data || []).map(x => x.oeuvres).filter(Boolean);
  const bloc = (t, v) => v ? `<section class="bloc"><h2>${t}</h2><p class="synopsis">${esc(v)}</p></section>` : '';
  app.innerHTML = `${bandeauAttente(p)}
    <div class="fiche"><div class="aff">${vignette(p.image_url, p.nom)}</div>
    <div><h1>${esc(nomP(p))}</h1>
      <dl>${ligne('Genre', p.genre)}${ligne('Âge', p.age)}${ligne('Date de naissance', p.date_naissance)}${ligne('Taille', p.taille)}
        ${ligneH('Origine', oeuvres.map(o => `<a href="#/oeuvre/${o.id}">${esc(o.titre)}</a>`).join(', '))}</dl>
      <p>${user ? `<button class="btn petit" id="fav">${fav.data ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button> ` : ''}${boutonSignaler()}</p></div></div>
    ${bloc('Personnalité', p.personnalite)}${bloc('Apparence physique', p.apparence)}${bloc('Histoire et passé', p.histoire)}${bloc('Relations familiales et amicales', p.relations)}
    ${bloc('Capacités et pouvoirs', p.capacites)}${bloc('Techniques de combat', p.techniques_combat)}${bloc('Évolution du personnage', p.evolution)}
    <section class="bloc"><h2>Galerie</h2>
      ${gal.data?.length ? `<div class="grille">${gal.data.map(g => `<figure style="margin:0"><img src="${esc(g.url)}" alt="${esc(g.legende || nomP(p))}" loading="lazy" style="border-radius:10px">${g.legende ? `<figcaption class="vide-txt">${esc(g.legende)}${g.publication !== 'publie' ? '<em class="badge">En attente</em>' : ''}</figcaption>` : ''}</figure>`).join('')}</div>` : '<p class="vide-txt">Aucune image pour l’instant.</p>'}
      ${user ? `<form id="f-gal"><div class="deux">${champ('fichier', 'Image (5 Mo max)', 'file', { accept: 'image/jpeg,image/png,image/webp', required: true })}${champ('legende', 'Légende', 'text', { maxlength: 120 })}</div>${champ('source', 'Source et droits de l’image', 'text', { required: true, placeholder: 'Ex. : illustration officielle, dessin personnel…' })}<div><button class="btn petit">Proposer l’image</button></div></form>` : ''}</section>
    ${com}
    <section>${section('Œuvres d’origine', grille(oeuvres, carteO, 'Aucune œuvre associée.'))}</section>`;
  lierCommunaute('personnage_id', id);
  $('#fav')?.addEventListener('click', async () => {
    const r = fav.data ? await sb.from('favoris').delete().eq('user_id', user.id).eq('personnage_id', id) : await sb.from('favoris').insert({ user_id: user.id, personnage_id: id });
    if (r.error) return toast(r.error.message, true);
    route();
  });
  $('#f-gal')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const url = await envoyer(f.get('fichier'), 'images');
      const { error } = await sb.from('galerie').insert({ personnage_id: id, url, legende: f.get('legende') || null, source: f.get('source') });
      if (error) throw error;
      toast('Image envoyée : elle sera visible après validation.'); route();
    } catch (err) { toast(err.message, true); }
  });
}

/* ---------- Connexion et inscription ---------- */
function connexion(mode) {
  if (user) { location.hash = '#/profil'; return; }
  const ins = mode === 'inscription';
  app.innerHTML = `<div class="bloc etroit"><h1>${ins ? 'Créer un compte' : 'Se connecter'}</h1>
    <form id="f-auth">${ins ? champ('pseudo', 'Pseudo (lettres, chiffres, _ et -)', 'text', { required: true, pattern: '[A-Za-z0-9_-]{3,30}', title: '3 à 30 caractères : lettres, chiffres, _ et -' }) : ''}
      ${champ('email', 'Adresse e-mail', 'email', { required: true, autocomplete: 'email' })}
      ${champ('mdp', 'Mot de passe (8 caractères minimum)', 'password', { required: true, minlength: 8, autocomplete: ins ? 'new-password' : 'current-password' })}
      <button class="btn">${ins ? 'Créer mon compte' : 'Se connecter'}</button></form>
    <p>${ins ? 'Déjà inscrit ?' : 'Pas encore de compte ?'} <a href="#/connexion${ins ? '' : '?mode=inscription'}">${ins ? 'Se connecter' : 'Créer un compte'}</a></p></div>`;
  $('#f-auth').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), email = f.get('email').trim(), password = f.get('mdp');
    if (ins) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { pseudo: f.get('pseudo').trim() } } });
      if (error) return toast(error.message, true);
      if (!data.session) { app.innerHTML = `<div class="bloc etroit"><h1>Vérifie ta boîte mail</h1><p>Un lien de confirmation vient d’être envoyé à ${esc(email)}. Clique dessus, puis reviens te connecter.</p></div>`; return; }
      toast('Bienvenue sur Univers animé !'); location.hash = '#/profil';
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return toast(error.message.includes('Invalid') ? 'E-mail ou mot de passe incorrect.' : error.message, true);
      toast('Connexion réussie.'); location.hash = '#/';
    }
  });
}

/* ---------- Profil ---------- */
async function pageProfil(pseudo) {
  if (!pseudo && !user) { location.hash = '#/connexion'; return; }
  const req = sb.from('profiles').select('*');
  const { data: pr } = await (pseudo ? req.eq('pseudo', pseudo) : req.eq('id', user.id)).maybeSingle();
  if (!pr) { app.innerHTML = introuvable(); return; }
  const moi = user && user.id === pr.id;
  const cnt = (col, v) => sb.from('abonnements').select('*', { count: 'exact', head: true }).eq(col, v);
  const [fav, ob, pb, nbSuiveurs, nbSuivis, suit] = await Promise.all([
    sb.from('favoris').select('personnages(*)').eq('user_id', pr.id),
    sb.from('oeuvres').select('*').eq('cree_par', pr.id).order('created_at', { ascending: false }),
    sb.from('personnages').select('*').eq('cree_par', pr.id).order('created_at', { ascending: false }),
    cnt('suivi_id', pr.id), cnt('suiveur_id', pr.id),
    user && !moi ? sb.from('abonnements').select('suivi_id').eq('suiveur_id', user.id).eq('suivi_id', pr.id).maybeSingle() : { data: null }
  ]);
  const favs = (fav.data || []).map(x => x.personnages).filter(Boolean);
  const roleTxt = { moderateur: 'Modérateur', admin: 'Administrateur' }[pr.role];
  app.innerHTML = `<div class="bloc"><div class="profil-t"><div class="pastille">${pr.avatar_url ? `<img src="${esc(pr.avatar_url)}" alt="">` : esc(pr.pseudo[0].toUpperCase())}</div>
      <div><h1>${esc(pr.pseudo)}${roleTxt ? `<em class="badge">${roleTxt}</em>` : ''}</h1>
        <p class="vide-txt">${nbSuiveurs.count || 0} abonné(s), ${nbSuivis.count || 0} abonnement(s). Membre depuis le ${date(pr.created_at)}.</p>
        ${user && !moi ? `<button class="btn petit" id="suivre">${suit.data ? 'Ne plus suivre' : 'Suivre'}</button>` : ''}</div></div>
      ${pr.bio ? `<p class="synopsis">${esc(pr.bio)}</p>` : moi ? '<p class="vide-txt">Ajoute une présentation ci-dessous.</p>' : ''}</div>
    ${moi ? `<section class="bloc"><h2>Personnaliser mon profil</h2><form id="f-profil">${champ('bio', 'Présentation', 'textarea', { maxlength: 500 })}${champ('avatar', 'Photo de profil (2 Mo max)', 'file', { accept: 'image/jpeg,image/png,image/webp' })}<div><button class="btn petit">Enregistrer</button></div></form></section>` : ''}
    ${section('Personnages favoris', grille(favs, carteP, 'Aucun favori pour l’instant.'))}
    ${section('Contributions', grille([...(ob.data || []).map(o => ({ ...o, k: 'o' })), ...(pb.data || []).map(p => ({ ...p, k: 'p' }))], x => x.k === 'o' ? carteO(x) : carteP(x), 'Aucune contribution pour l’instant.'))}`;
  if (moi) $('#f-profil textarea').value = pr.bio || '';
  $('#suivre')?.addEventListener('click', async () => {
    const r = suit.data ? await sb.from('abonnements').delete().eq('suiveur_id', user.id).eq('suivi_id', pr.id) : await sb.from('abonnements').insert({ suiveur_id: user.id, suivi_id: pr.id });
    if (r.error) return toast(r.error.message, true);
    route();
  });
  $('#f-profil')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), maj = { bio: f.get('bio').trim() };
    try {
      const fic = f.get('avatar');
      if (fic && fic.size) maj.avatar_url = await envoyer(fic, 'avatars');
      const { error } = await sb.from('profiles').update(maj).eq('id', user.id);
      if (error) throw error;
      toast('Profil mis à jour.'); await charger(user);
    } catch (err) { toast(err.message, true); }
  });
}

/* ---------- Ajout d’une fiche (animé, manga ou personnage) ---------- */
async function formFiche(type) {
  if (!user) { toast('Connecte-toi pour contribuer.', true); location.hash = '#/connexion'; return; }
  const perso = type === 'personnage';
  const onglets = `<p class="puces">${[['anime', 'Un animé'], ['manga', 'Un manga'], ['personnage', 'Un personnage']].map(([t, l]) => `<a class="puce" ${t === type ? 'style="border-color:var(--violet)"' : ''} href="#/ajouter/${t}">${l}</a>`).join('')}</p>`;
  let corps;
  if (perso) {
    const { data: liste } = await sb.from('oeuvres').select('id,titre,type').eq('publication', 'publie').order('titre').limit(500);
    corps = `<div class="deux">${champ('prenom', 'Prénom')}${champ('nom', 'Nom', 'text', { required: true })}</div>
      <div class="deux">${choix('genre', 'Genre', ['Masculin', 'Féminin', 'Autre', 'Inconnu'].map(g => [g, g]), '—')}${champ('age', 'Âge')}</div>
      <div class="deux">${champ('date_naissance', 'Date de naissance')}${champ('taille', 'Taille')}</div>
      ${champ('image', 'Image principale (5 Mo max)', 'file', { accept: 'image/jpeg,image/png,image/webp' })}
      ${choix('oeuvre', 'Animé ou manga d’origine', (liste || []).map(o => [o.id, `${o.titre} (${o.type === 'manga' ? 'manga' : 'animé'})`]), '— Choisir —')}
      ${[['personnalite', 'Personnalité'], ['apparence', 'Apparence physique'], ['histoire', 'Histoire et passé'], ['relations', 'Relations familiales et amicales'], ['capacites', 'Capacités et pouvoirs'], ['techniques_combat', 'Techniques de combat'], ['evolution', 'Évolution du personnage']].map(([n, l]) => champ(n, l, 'textarea')).join('')}`;
  } else {
    corps = `<div class="deux">${champ('titre', 'Titre en français', 'text', { required: true })}${champ('titre_original', 'Titre original')}</div>
      ${champ('image', 'Image d’illustration (5 Mo max)', 'file', { accept: 'image/jpeg,image/png,image/webp' })}
      ${champ('synopsis', 'Synopsis détaillé', 'textarea')}
      <div class="deux">${champ('date_sortie', 'Date de sortie', 'date')}${choix('statut', 'Statut', Object.entries(STATUTS), '—')}</div>
      <div class="deux">${champ('nb_episodes', type === 'manga' ? 'Nombre de chapitres' : 'Nombre d’épisodes', 'number', { min: 0 })}${champ('nb_saisons', type === 'manga' ? 'Nombre de tomes' : 'Nombre de saisons', 'number', { min: 0 })}</div>
      <div class="deux">${champ('studio', type === 'manga' ? 'Éditeur' : 'Studio d’animation')}${champ('auteur', 'Auteur')}</div>
      ${type === 'manga' ? '' : champ('realisateur', 'Réalisateur')}
      <label>Genres<span class="cases">${GENRES.map(g => `<label><input type="checkbox" name="genres" value="${esc(g)}">${esc(g)}</label>`).join('')}</span></label>
      ${champ('infos', 'Informations complémentaires', 'textarea')}`;
  }
  app.innerHTML = `<h1>Ajouter une fiche</h1>${onglets}<div class="bloc"><form id="f-fiche">${corps}
    <p class="vide-txt">Ta fiche sera visible de tous après validation par un modérateur. N’ajoute que des images dont tu as le droit de te servir.</p>
    <div><button class="btn">Envoyer la fiche</button></div></form></div>`;
  $('#f-fiche').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), bouton = $('button', e.target);
    bouton.disabled = true;
    try {
      const d = {};
      for (const [k, v] of f.entries()) if (typeof v === 'string' && !['genres', 'oeuvre'].includes(k)) d[k] = v.trim() || null;
      for (const k of ['nb_episodes', 'nb_saisons']) if (d[k] != null) d[k] = +d[k];
      const img = f.get('image');
      if (img && img.size) d.image_url = await envoyer(img, 'images');
      let res;
      if (perso) res = await sb.from('personnages').insert(d).select('id').single();
      else res = await sb.from('oeuvres').insert({ ...d, type, genres: f.getAll('genres') }).select('id').single();
      if (res.error) throw res.error;
      if (perso && f.get('oeuvre')) await sb.from('oeuvre_personnages').insert({ oeuvre_id: +f.get('oeuvre'), personnage_id: res.data.id });
      toast(['moderateur', 'admin'].includes(profil?.role) ? 'Fiche publiée.' : 'Fiche envoyée : un modérateur va la valider.');
      location.hash = `#/${perso ? 'personnage' : 'oeuvre'}/${res.data.id}`;
    } catch (err) { toast(err.message, true); bouton.disabled = false; }
  });
}

/* ---------- Démarrage ---------- */
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  await charger(session?.user || null);
  sb.auth.onAuthStateChange((evt, s) => {
    if (evt === 'SIGNED_IN' && (s?.user?.id !== user?.id)) setTimeout(() => charger(s.user), 0);
    if (evt === 'SIGNED_OUT') setTimeout(() => { charger(null); location.hash = '#/'; }, 0);
  });
})();
