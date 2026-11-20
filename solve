'use strict';
/* ===== Catégorie « Solve RP » : personnages du serveur, ajoutés par la communauté ===== */
const SOLVE = 'solve_rp';

const carteSolve = p => `<a class="carte" href="#/solve/fiche/${p.id}">${vignette(p.image_url, p.nom)}<div class="carte-t"><b>${esc(nomP(p))}</b><span>${esc(p.metier || 'Solve RP')}</span></div></a>`;

async function solveRoute(b, q) {
  const id = +(location.hash.slice(1).split('?')[0].split('/').filter(Boolean)[2]);
  if (b === 'fiche') return ficheSolve(id);
  if (b === 'ajouter') return formSolve();
  return catalogueSolve(q);
}

/* ---------- Liste des personnages Solve RP ---------- */
async function catalogueSolve(q) {
  const tri = q.get('tri') || 'recent';
  let req = sb.from('personnages').select('*').eq('publication', 'publie').eq('categorie', SOLVE);
  req = tri === 'vues' ? req.order('vues', { ascending: false }) : tri === 'nom' ? req.order('nom') : req.order('created_at', { ascending: false });
  const { data, error } = await req.limit(60);
  if (error) throw error;
  const tris = [['recent', 'Plus récents'], ['vues', 'Plus populaires'], ['nom', 'Ordre alphabétique']];
  app.innerHTML = `<h1>Solve RP</h1>
    <p class="vide-txt">Les personnages du serveur Solve RP, ajoutés par la communauté.</p>
    <form class="filtres" id="f-solve">${choix('tri', 'Trier par', tris, null)}<button class="btn">Trier</button><a class="btn sec" href="#/solve/ajouter">Ajouter un personnage</a></form>
    ${grille(data, carteSolve, `Aucun personnage pour l’instant. <a href="#/solve/ajouter">Ajoute le premier.</a>`)}`;
  const f = $('#f-solve');
  f.elements.tri.value = tri;
  f.addEventListener('submit', e => {
    e.preventDefault();
    location.hash = '#/solve?tri=' + f.elements.tri.value;
  });
}

/* ---------- Fiche d’un personnage Solve RP ---------- */
async function ficheSolve(id) {
  const { data: p, error } = await sb.from('personnages').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!p || p.categorie !== SOLVE) { app.innerHTML = introuvable(); return; }
  if (p.publication === 'publie') sb.rpc('incrementer_vue', { p_type: 'personnage', p_id: id });
  const com = await communaute('personnage_id', id);
  const bloc = (t, v) => v ? `<section class="bloc"><h2>${t}</h2><p class="synopsis">${esc(v)}</p></section>` : '';
  app.innerHTML = `${bandeauAttente(p)}
    <div class="fiche"><div class="aff">${vignette(p.image_url, p.nom)}</div>
    <div><h1>${esc(nomP(p))}</h1><p class="orig">Personnage Solve RP</p>
      <dl>${ligne('Métier / faction', p.metier)}${ligne('Joueur', p.joueur)}${ligne('Genre', p.genre)}${ligne('Âge', p.age)}</dl>
      <p><a class="btn petit sec" href="#/solve">← Tous les personnages Solve RP</a> ${boutonSignaler()}</p></div></div>
    ${bloc('Histoire et passé', p.histoire)}${bloc('Personnalité', p.personnalite)}${bloc('Apparence physique', p.apparence)}${bloc('Relations', p.relations)}
    ${com}`;
  lierCommunaute('personnage_id', id);
}

/* ---------- Formulaire d’ajout ---------- */
function formSolve() {
  if (!user) { toast('Connecte-toi pour contribuer.', true); location.hash = '#/connexion'; return; }
  app.innerHTML = `<h1>Ajouter un personnage Solve RP</h1>
    <div class="bloc"><form id="f-solve-fiche">
      <div class="deux">${champ('prenom', 'Prénom')}${champ('nom', 'Nom', 'text', { required: true })}</div>
      <div class="deux">${champ('age', 'Âge')}${choix('genre', 'Genre', ['Masculin', 'Féminin', 'Autre'].map(g => [g, g]), '—')}</div>
      <div class="deux">${champ('metier', 'Métier ou faction')}${champ('joueur', 'Nom du joueur')}</div>
      ${champ('image', 'Image du personnage (5 Mo max)', 'file', { accept: 'image/jpeg,image/png,image/webp' })}
      ${champ('histoire', 'Histoire et passé', 'textarea')}
      ${champ('personnalite', 'Personnalité', 'textarea')}
      ${champ('apparence', 'Apparence physique', 'textarea')}
      ${champ('relations', 'Relations (famille, amis, rivaux…)', 'textarea')}
      <p class="vide-txt">Ta fiche sera visible de tous après validation par un modérateur. N’ajoute que des images dont tu as le droit de te servir.</p>
      <div><button class="btn">Envoyer la fiche</button></div></form></div>`;
  $('#f-solve-fiche').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), bouton = $('button', e.target);
    bouton.disabled = true;
    try {
      const d = { categorie: SOLVE };
      for (const [k, v] of f.entries()) if (typeof v === 'string') d[k] = v.trim() || null;
      const img = f.get('image');
      if (img && img.size) d.image_url = await envoyer(img, 'images');
      const { data, error } = await sb.from('personnages').insert(d).select('id').single();
      if (error) throw error;
      toast(['moderateur', 'admin'].includes(profil?.role) ? 'Fiche publiée.' : 'Fiche envoyée : un modérateur va la valider.');
      location.hash = `#/solve/fiche/${data.id}`;
    } catch (err) { toast(err.message, true); bouton.disabled = false; }
  });
}
