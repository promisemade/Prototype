const assert = require("node:assert/strict");

function test(name, fn){
  try{
    fn();
    console.log(`OK - ${name}`);
  }catch(error){
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

function repairDisplayText(value){
  let text = String(value || "");
  for(let i = 0; i < 2; i += 1){
    if(!/[ÃÂâ€™â€œâ€]/.test(text)) break;
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    if(!repaired || repaired === text) break;
    text = repaired;
  }
  return text;
}

function normalizeName(value){
  return repairDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const WORKBOOK_CATALOGUE_NAMES = [
  "Compte personnel de formation",
  "Participation financi\u00e8re obligatoire au CPF",
  "Compte d\u2019engagement citoyen",
  "Compte professionnel de pr\u00e9vention",
  "Conseil en \u00e9volution professionnelle",
  "Bilan de comp\u00e9tences",
  "Validation des acquis de l\u2019exp\u00e9rience",
  "Projet de transition professionnelle",
  "P\u00e9riode de reconversion professionnelle (remplace Pro-A)",
  "Plan de d\u00e9veloppement des comp\u00e9tences",
  "Contrat d\u2019apprentissage \u2013 financement et aides employeur",
  "Contrat de professionnalisation \u2013 aides employeur (DE 26+ / 45+ / handicap)",
  "Programme r\u00e9gional de formation",
  "Action de formation conventionn\u00e9e",
  "Aide individuelle \u00e0 la formation",
  "Pr\u00e9paration op\u00e9rationnelle \u00e0 l\u2019emploi collective",
  "Pr\u00e9paration op\u00e9rationnelle \u00e0 l\u2019emploi individuelle",
  "Action de formation pr\u00e9alable au recrutement",
  "Allocation d'aide au retour \u00e0 l'emploi - formation",
  "R\u00e9mun\u00e9ration de formation de France Travail",
  "S\u00e9same vers l\u2019emploi pour le sport et l\u2019animation",
  "Aide BAFA de la Caf (aide nationale) + compl\u00e9ments locaux",
  "Aides Agefiph (formation, compensation, parcours vers l\u2019emploi, aides employeur\u2026)",
  "Aides FIPHFP (reconversion/formation, compensation handicap)",
  "Compte personnel de formation (fonction publique) \u2013 r\u00e8gles sp\u00e9cifiques",
  "CPF des travailleurs ind\u00e9pendants",
  "FIF PL \u2013 financement formation professions lib\u00e9rales",
  "AGEFICE \u2013 financement formation dirigeants non-salari\u00e9s",
  "FAFCEA \u2013 financement formation artisans",
  "VIVEA \u2013 financement formation chefs d\u2019exploitation agricole",
  "OPCO \u2013 branche du sport (CCN Sport IDCC 2511)",
  "OPCO \u2013 branche \u00c9clat (IDCC 1518)",
  "Service public r\u00e9gional de la formation (exemple) + aides individuelles r\u00e9gionales",
  "FNE-Formation",
  "Abondement France Travail sur un dossier CPF (financement compl\u00e9mentaire)",
  "Aide \u00e0 la mobilit\u00e9 (d\u00e9placement, repas, h\u00e9bergement) pendant une formation",
  "Contrat d\u2019engagement jeune (accompagnement intensif + allocation)",
  "Contrat de s\u00e9curisation professionnelle (accompagnement + formation)",
  "Cong\u00e9 de formation de cadres et d\u2019animateurs pour la jeunesse (dispositif jeunesse)",
  "PRF 2025 \u2013 SFER (Se Former pour un Emploi en R\u00e9gion) \u2013 D\u00e9couverte/Qualifiant/Perfectionnement",
  "Ch\u00e8que Pass Formation / Pass Formation (abondement CPF)",
  "Ch\u00e8que Pass Formation Sup (abondement CPF \u2013 formations cibl\u00e9es)",
  "Pass Emploi Entreprise (formation sur mesure avant recrutement)",
  "Carte G\u00e9n\u00e9ration #HDF (apprentis) \u2013 \u00e9quipement + aides THR",
  "En route pour l\u2019emploi (pr\u00eat de v\u00e9hicule \u00e0 1\u20ac/jour)",
  "PRF 2025 \u2013 Ch\u00e8que Pass VAE (abondement CPF) \u2013 supprim\u00e9 au 01/01/2026",
  "Proch\u2019Info-Formation (point d\u2019entr\u00e9e orientation)",
  "Proch\u2019Emploi (service sur-mesure emploi/recrutement)",
  "CPF \u2013 Permis de conduire (groupe l\u00e9ger)"
];

const WORKBOOK_REGION_NAMES = [
  "Proch\u2019Info-Formation (PRIF)",
  "Proch\u2019Emploi",
  "PRF 2025 \u2013 SFER (Se Former pour un Emploi en R\u00e9gion) : Parcours D\u00e9couverte / Qualifiant / Perfectionnement",
  "Pass Emploi Entreprise (PAEE)",
  "Ch\u00e8que Pass Formation / Pass Formation (CHPF)",
  "Ch\u00e8que Pass Formation Sup (CHPF Sup)",
  "Carte G\u00e9n\u00e9ration #HDF \u2013 aide \u00e9quipement (primo-entrant)",
  "Carte G\u00e9n\u00e9ration #HDF \u2013 aides THR (Transport / H\u00e9bergement / Restauration)",
  "En route pour l\u2019emploi (pr\u00eat de v\u00e9hicule \u00e0 1 \u20ac / jour)",
  "Aides VAE r\u00e9gionales 2025 (Ch\u00e8que Pass VAE) : non reconduites en 2026"
];

const MANUAL_EXTRA_CATALOGUE = [
  "Mobili-Jeune (aide au loyer en alternance)",
  "Avance Loca-Pass (d\u00e9p\u00f4t de garantie)"
];

const MANUAL_EXTRA_REGION = [
  "Mobili-Jeune (Action Logement)",
  "Avance Loca-Pass (Action Logement)"
];

global.window = global;
require("../data_bundle.js");
const data = global.DISPOSITIFS_DATA;

test("bundle remains exhaustive against the two workbook sheets and documents manual additions", ()=>{
  const catalogueNames = (data.catalogue || []).map((entry)=> entry["Dispositif"]).filter(Boolean);
  const regionNames = (data.region_hdf || []).map((entry)=> entry["Dispositif (Hauts-de-France)"] || entry["Dispositif"]).filter(Boolean);

  const workbookCatalogueSet = new Set(WORKBOOK_CATALOGUE_NAMES.map(normalizeName));
  const workbookRegionSet = new Set(WORKBOOK_REGION_NAMES.map(normalizeName));

  const missingCatalogue = WORKBOOK_CATALOGUE_NAMES.filter((name)=> !catalogueNames.some((entry)=> normalizeName(entry) === normalizeName(name)));
  const missingRegion = WORKBOOK_REGION_NAMES.filter((name)=> !regionNames.some((entry)=> normalizeName(entry) === normalizeName(name)));

  const extraCatalogue = catalogueNames
    .filter((name)=> !workbookCatalogueSet.has(normalizeName(name)))
    .map(normalizeName)
    .sort();
  const extraRegion = regionNames
    .filter((name)=> !workbookRegionSet.has(normalizeName(name)))
    .map(normalizeName)
    .sort();

  assert.equal(catalogueNames.length, 51);
  assert.equal(regionNames.length, 12);
  assert.deepEqual(missingCatalogue, []);
  assert.deepEqual(missingRegion, []);
  assert.deepEqual(extraCatalogue, MANUAL_EXTRA_CATALOGUE.map(normalizeName).sort());
  assert.deepEqual(extraRegion, MANUAL_EXTRA_REGION.map(normalizeName).sort());
});
