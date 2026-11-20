'use strict';
/* ===== Catégorie « Solve RP » : personnages du serveur, classés par village d'origine ===== */
const SOLVE = 'solve_rp';

const VILLAGES = [
  { id: 'konoha', nom: 'Konoha', desc: 'Village caché de la Feuille', kanji: '葉', couleur: '#4ade80' },
  { id: 'suna', nom: 'Suna', desc: 'Village caché du Sable', kanji: '砂', couleur: '#f5b84b' },
  { id: 'oto', nom: 'Oto', desc: 'Village caché du Son', kanji: '音', couleur: '#a78bfa' },
  { id: 'kiri', nom: 'Kiri', desc: 'Village caché de la Brume', kanji: '霧', couleur: '#5aa9ff' },
  { id: 'iwa', nom: 'Iwa', desc: 'Village caché de la Roche', kanji: '岩', couleur: '#d08b5b' }
];
const villageDe = id => VILLAGES.find(v => v.id === id);

/* Style des cartes de villages */
document.head.insertAdjacentHTML('beforeend', `<style>
.villages{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.village{text-align:center;padding:1.5rem 1rem 1rem;border-color:var(--c)}
.village:hover{border-color:var(--c);box-shadow:0 0 24px var(--c)}
.village-kanji{font:700 4rem/1 Sora,system-ui,sans-serif;color:var(--c);text-shadow:0 0 18px var(--c)}
.village-nom{font:700 1.3rem Sora,system-ui,sans-serif;margin:.5rem 0 0}
</style>`);

const carteSolve = p => `<a class="carte" href="#/solve/fiche/${p.id}">${vignette(p.image_url, p.nom)}<div class="carte-t"><b>${esc(nomP(p))}</b><span>${esc(p.metier || 'Solve RP')}</span></div></a>`;

async function solveRoute(b, q) {
  const id = +(location.hash.slice(1).split('?')[0].split('/').filter(Boolean)[2]);
  if (b === 'fiche') return ficheSolve(id);
  if (b === 'ajouter') return formSolve(q.get('village'));
  if (villageDe(b)) return catalogueSolve(b, q);
  return choixVillage();
}

/* ---------- 1) Choix du village ---------- */
async function choixVillage() {
  const { data, error } = await sb.from('personnages').select('village').eq('categorie', SOLVE).eq('publication', 'publie');
  if (error) throw error;
  const nb = {};
  (data || []).forEach(p => { nb[p.village] = (nb[p.village] || 0) + 1; });
  app.innerHTML = `<h1>Solve RP</h1>
    <p class="vide-txt">Choisis le village d’origine des personnages que tu cherches.</p>
    <div class="grille villages">${VILLAGES.map(v => {
      const n = nb[v.id] || 0;
      return `<a class="carte village" href="#/solve/${v.id}" style="--c:${v.couleur}"><div class="village-kanji">${v.kanji}</div><div class="village-nom">${esc(v.nom)}</div><div class="carte-t"><b>${esc(v.desc)}</b><span>${n} personnage${n > 1 ? 's' : ''}</span></div></a>`;
    }).join('')}</div>
    <p style="margin-top:1.5rem"><a class="btn sec" href="#/solve/ajouter">Ajouter un personnage</a></p>`;
}

/* ---------- 2) Personnages d'un village ---------- */
async function catalogueSolve(village, q) {
  const v = villageDe(village);
  const tri = q.get('tri') || 'recent';
  const mot = (q.get('q') || '').replace(/[,()%*]/g, ' ').trim();
  let req = sb.from('personnages').select('*').eq('publication', 'publie').eq('categorie', SOLVE).eq('village', village);
  if (mot) req = req.or(`nom.ilike.%${mot}%,prenom.ilike.%${mot}%`);
  req = tri === 'vues' ? req.order('vues', { ascending: false }) : tri === 'nom' ? req.order('nom') : req.order('created_at', { ascending: false });
  const { data, error } = await req.limit(60);
  if (error) throw error;
  const tris = [['recent', 'Plus récents'], ['vues', 'Plus populaires'], ['nom', 'Ordre alphabétique']];
  app.innerHTML = `<p><a href="#/solve">← Changer de village</a></p>
    <h1>Solve RP · ${esc(v.nom)}</h1>
    <p class="vide-txt">${esc(v.desc)}</p>
    <form class="filtres" id="f-solve">${champ('q', 'Rechercher un personnage', 'search', { placeholder: 'Nom ou prénom' })}${choix('tri', 'Trier par', tris, null)}<button class="btn">Filtrer</button><a class="btn sec" href="#/solve/ajouter?village=${v.id}">Ajouter un personnage</a></form>
    ${grille(data, carteSolve, `Aucun personnage ici pour l’instant. <a href="#/solve/ajouter?village=${v.id}">Ajoute le premier.</a>`)}`;
  const f = $('#f-solve');
  f.elements.tri.value = tri;
  f.elements.q.value = mot;
  f.addEventListener('submit', e => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (f.elements.q.value.trim()) p.set('q', f.elements.q.value.trim());
    p.set('tri', f.elements.tri.value);
    location.hash = `#/solve/${village}?${p}`;
  });
}

/* ---------- 3) Fiche d'un personnage ---------- */
async function ficheSolve(id) {
  const { data: p, error } = await sb.from('personnages').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!p || p.categorie !== SOLVE) { app.innerHTML = introuvable(); return; }
  if (p.publication === 'publie') sb.rpc('incrementer_vue', { p_type: 'personnage', p_id: id });
  const com = await communaute('personnage_id', id);
  const v = villageDe(p.village);
  const bloc = (t, x) => x ? `<section class="bloc"><h2>${t}</h2><p class="synopsis">${esc(x)}</p></section>` : '';
  app.innerHTML = `${bandeauAttente(p)}
    <div class="fiche"><div class="aff">${vignette(p.image_url, p.nom)}</div>
    <div><h1>${esc(nomP(p))}</h1><p class="orig">Personnage Solve RP</p>
      <dl>${ligne('Village', v ? v.nom : '')}${ligne('Métier / faction', p.metier)}${ligne('Joueur', p.joueur)}${ligne('Genre', p.genre)}${ligne('Âge', p.age)}</dl>
      <p><a class="btn petit sec" href="#/solve${v ? '/' + v.id : ''}">← ${v ? 'Personnages de ' + esc(v.nom) : 'Solve RP'}</a> ${boutonSignaler()}</p></div></div>
    ${bloc('Histoire et passé', p.histoire)}${bloc('Personnalité', p.personnalite)}${bloc('Apparence physique', p.apparence)}${bloc('Relations', p.relations)}
    ${com}`;
  lierCommunaute('personnage_id', id);
}

/* ---------- 4) Formulaire d'ajout ---------- */
function formSolve(villagePre) {
  if (!user) { toast('Connecte-toi pour contribuer.', true); location.hash = '#/connexion'; return; }
  app.innerHTML = `<h1>Ajouter un personnage Solve RP</h1>
    <div class="bloc"><form id="f-solve-fiche">
      <div class="deux">${champ('prenom', 'Prénom')}${champ('nom', 'Nom', 'text', { required: true })}</div>
      <div class="deux">${choix('village', 'Village d’origine', VILLAGES.map(v => [v.id, v.nom]), '— Choisir —')}${champ('metier', 'Métier ou faction')}</div>
      <div class="deux">${champ('age', 'Âge')}${choix('genre', 'Genre', ['Masculin', 'Féminin', 'Autre'].map(g => [g, g]), '—')}</div>
      ${champ('joueur', 'Nom du joueur')}
      ${champ('image', 'Image du personnage (5 Mo max)', 'file', { accept: 'image/jpeg,image/png,image/webp' })}
      ${champ('histoire', 'Histoire et passé', 'textarea')}
      ${champ('personnalite', 'Personnalité', 'textarea')}
      ${champ('apparence', 'Apparence physique', 'textarea')}
      ${champ('relations', 'Relations (famille, amis, rivaux…)', 'textarea')}
      <p class="vide-txt">Ta fiche sera visible de tous après validation par un modérateur. N’ajoute que des images dont tu as le droit de te servir.</p>
      <div><button class="btn">Envoyer la fiche</button></div></form></div>`;
  const sel = $('select[name="village"]');
  sel.required = true;
  if (villageDe(villagePre)) sel.value = villagePre;
  $('#f-solve-fiche').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), bouton = $('button', e.target);
    bouton.disabled = true;
    try {
      const d = { categorie: SOLVE };
      for (const [k, x] of f.entries()) if (typeof x === 'string') d[k] = x.trim() || null;
      const img = f.get('image');
      if (img && img.size) d.image_url = await envoyer(img, 'images');
      const { data, error } = await sb.from('personnages').insert(d).select('id').single();
      if (error) throw error;
      toast(['moderateur', 'admin'].includes(profil?.role) ? 'Fiche publiée.' : 'Fiche envoyée : un modérateur va la valider.');
      location.hash = `#/solve/fiche/${data.id}`;
    } catch (err) { toast(err.message, true); bouton.disabled = false; }
  });
}
