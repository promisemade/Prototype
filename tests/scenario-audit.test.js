const assert = require("node:assert/strict");
const { createCore } = require("../simulator-core.js");

function test(name, fn){
  try{
    fn();
    console.log(`OK - ${name}`);
  }catch(error){
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

global.window = global;
require("../data_bundle.js");
const core = createCore(global.DISPOSITIFS_DATA);

function makeState(partial){
  const base = core.defaultState();
  return {
    ...base,
    ...partial,
    needs: {...base.needs, ...(partial.needs || {})}
  };
}

function getTitle(item){
  return item["Dispositif (Hauts-de-France)"] || item["Dispositif"] || "";
}

test("representative profiles keep a coherent top scenario ordering", ()=>{
  const audits = [
    ["apprentissage_standard", makeState({ statut:"alt", age:"26-29", alternance:"oui", employeur:"oui", formation:"bpjeps" }), "apprentissage"],
    ["contratpro_30_rsa", makeState({ statut:"alt", age:"30-35", alternance:"oui", employeur:"oui", formation:"bpjeps", contratpro_case:"rsa" }), "contratpro"],
    ["contratpro_45_de", makeState({ statut:"de", age:"45+", alternance:"oui", employeur:"oui", formation:"bpjeps" }), "contratpro"],
    ["salarie_ptp", makeState({ statut:"sal", formation:"bpjeps", cost_peda:6500, ptp_seniority:"ok" }), "ptp"],
    ["agent_public_ptp", makeState({ statut:"fp", formation:"bpjeps", cost_peda:5000 }), "ptp"],
    ["prf_confirmed", makeState({ statut:"de", formation:"bpjeps", prf_simple:"oui", allocation_ft:"are" }), "prf"],
    ["de_prf_unknown", makeState({ statut:"de", formation:"bpjeps", prf_simple:"nspp", allocation_ft:"are" }), "prf"],
    ["de_cpf_shortfall", makeState({ statut:"de", formation:"bpjeps", cost_peda:5000, cpf_amount:500, prf_simple:"non" }), "cpf"],
    ["de_cpf_no_alternance", makeState({ statut:"de", formation:"bpjeps", cost_peda:3500, cpf_amount:0, alternance:"non", employeur:"non", prf_simple:"non" }), "cpf"],
    ["ind_faf", makeState({ statut:"ind", formation:"bpjeps", cpf_amount:800 }), "faf"],
    ["jeune_cpf", makeState({ statut:"jeune", age:"<26", formation:"bpjeps", cost_peda:4000, cpf_amount:1200 }), "cpf"],
    ["alt_logement", makeState({ statut:"alt", age:"26-29", alternance:"oui", employeur:"oui", formation:"bpjeps", needs:{hebergement:true} }), "apprentissage"]
  ];

  for(const [label, state, expectedTop] of audits){
    const { packs } = core.buildPacks(state);
    assert.equal(packs[0].id, expectedTop, `unexpected top scenario for ${label}`);
    assert.notEqual(packs[0].eligibility.status, "ineligible", `top scenario should stay usable for ${label}`);
    assert.equal(packs[0].why.length, 3, `top scenario why length drifted for ${label}`);
  }
});

test("agent public transition scenario no longer uses the private PTP wording", ()=>{
  const state = makeState({ statut:"fp", formation:"bpjeps", cost_peda:5000 });
  const top = core.buildPacks(state).packs[0];
  assert.equal(top.id, "ptp");
  assert.match(top.title, /Fonction publique/i);
  assert.ok(!/Projet de transition professionnelle \(PTP\)/i.test(top.title));
  assert.ok(top.why.some((line)=> /cong\u00e9 de transition professionnelle|cong\u00e9 de formation professionnelle/i.test(line)));
});

test("terrain cases keep complementary aids aligned with the actual profile", ()=>{
  const salarie45 = makeState({
    statut: "sal",
    age: "45+",
    formation: "bpjeps",
    cost_peda: 4200,
    cpf_amount: 1800,
    employeur: "oui"
  });
  const salarieTop = core.buildPacks(salarie45).packs[0].id;
  const salarieOthers = core.filterOtherDispositifs(salarie45).map(getTitle);
  assert.ok(["cpf", "ptp"].includes(salarieTop));
  assert.ok(!salarieOthers.some((name)=> /AFDAS|Uniformation|OPCO\s+[–-]\s+branche/i.test(name)));
  assert.ok(!salarieOthers.some((name)=> /AGEFICE|FAFCEA|apprentissage/i.test(name)));

  const independant = makeState({
    statut: "ind",
    formation: "bpjeps",
    cost_peda: 2800,
    cpf_amount: 0
  });
  const indepOthers = core.filterOtherDispositifs(independant).map(getTitle);
  assert.equal(core.buildPacks(independant).packs[0].id, "faf");
  assert.ok(indepOthers.some((name)=> /AGEFICE|FIF PL/i.test(name)));
  assert.ok(!indepOthers.some((name)=> /FAFCEA/i.test(name)));
  assert.ok(!indepOthers.some((name)=> /VIVEA/i.test(name)));
  assert.ok(!indepOthers.some((name)=> /retour .* emploi|engagement jeune|apprentissage/i.test(name)));

  const alternanceHandicap = makeState({
    statut: "alt",
    age: "30-35",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    apprentissage_exception: "handicap",
    handicap: "oui"
  });
  const altOthers = core.filterOtherDispositifs(alternanceHandicap).map(getTitle);
  assert.equal(core.buildPacks(alternanceHandicap).packs[0].id, "contratpro");
  assert.ok(altOthers.some((name)=> /Agefiph|OPCO/i.test(name)));
  assert.ok(!altOthers.some((name)=> /engagement jeune|retour .* emploi/i.test(name)));
});

test("CPF shortfall scenario keeps a pedagogic complement explanation", ()=>{
  const state = makeState({
    statut: "de",
    formation: "bpjeps",
    cost_peda: 5000,
    cpf_amount: 500,
    prf_simple: "non"
  });
  const { packs } = core.buildPacks(state);
  const cpfPack = packs.find((pack)=> pack.id === "cpf");

  assert.ok(cpfPack, "missing CPF pack");
  assert.equal(cpfPack.why.length, 3);
  assert.match(cpfPack.why[1], /CPF/i);
  assert.match(cpfPack.why[1], /France Travail|AIF|Région/i);
  assert.match(cpfPack.why[2], /Mon Compte Formation|ordre des demandes|validation du conseiller/i);
});

test("alternance housing context surfaces Action Logement aids", ()=>{
  const state = makeState({
    statut: "alt",
    age: "26-29",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    needs: {hebergement:true}
  });
  const others = core.filterOtherDispositifs(state).map(getTitle);

  assert.ok(others.some((label)=> label.includes("Mobili-Jeune")));
  assert.ok(others.some((label)=> label.includes("Loca-Pass")));
});

test("30-35 demandeur d'emploi on CPF path does not surface apprentissage-only annex aids", ()=>{
  const state = makeState({
    statut: "de",
    age: "30-35",
    formation: "bpjeps",
    cost_peda: 5000,
    cpf_amount: 0,
    prf_simple: "non",
    alternance: "non",
    employeur: "non",
    needs: {transport:true, hebergement:true, equipement:true}
  });
  const top = core.buildPacks(state).packs[0].id;
  const others = core.filterOtherDispositifs(state).map(getTitle);

  assert.equal(top, "cpf");
  assert.ok(!others.some((label)=> /Mobili-Jeune|Generation #HDF|Carte G..n.ration/i.test(label)));
  assert.ok(!others.some((label)=> /Loca-Pass/i.test(label)));
});

test("30-35 contrat pro housing context keeps Loca-Pass plausible but not Mobili-Jeune or Generation HDF", ()=>{
  const state = makeState({
    statut: "de",
    age: "30-35",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    contratpro_case: "unknown",
    needs: {hebergement:true, transport:false, equipement:false}
  });
  const top = core.buildPacks(state).packs[0].id;
  const others = core.filterOtherDispositifs(state).map(getTitle);

  assert.equal(top, "contratpro");
  assert.ok(others.some((label)=> /Loca-Pass/i.test(label)));
  assert.ok(!others.some((label)=> /Mobili-Jeune/i.test(label)));
  assert.ok(!others.some((label)=> /Generation #HDF|Carte G..n.ration/i.test(label)));
});

test("PRF pack exposes the HDF regional sources directly from the core", ()=>{
  const state = makeState({
    statut: "de",
    formation: "bpjeps",
    prf_simple: "nspp"
  });
  const { packs } = core.buildPacks(state);
  const prfPack = packs.find((pack)=> pack.id === "prf");

  assert.ok(prfPack, "missing PRF pack");
  assert.ok(prfPack.dispositifNames.some((name)=> /PRF 2025 .*SFER .*Parcours D\u00e9couverte/i.test(name)));
  assert.ok(prfPack.dispositifNames.some((name)=> /PRIF/.test(name)));
  assert.ok(!prfPack.dispositifNames.some((name)=> /Programme r\u00e9gional de formation/i.test(name)));
});

test("other dispositifs prefer the HDF variant when a generic duplicate exists", ()=>{
  const state = makeState({
    statut: "de",
    formation: "bpjeps",
    cost_peda: 5000,
    cpf_amount: 500,
    needs: {transport:false, hebergement:false, equipement:false}
  });
  const others = core.filterOtherDispositifs(state).map(getTitle);

  assert.ok(others.includes("Chèque Pass Formation / Pass Formation (CHPF)"));
  assert.ok(!others.includes("Chèque Pass Formation / Pass Formation (abondement CPF)"));
});
