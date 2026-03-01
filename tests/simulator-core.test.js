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

const sampleData = {
  catalogue: [
    {
      "Dispositif": "Aide mobilite HDF",
      "Sigle": "AMH",
      "Domaine": "Mobilite",
      "Thématique": "Transport / hebergement",
      "Ce qui est financé": "transport et hebergement",
      "Objectif / ce que ça permet": "aider les deplacements vers la formation",
      "Publics éligibles": "demandeur d'emploi",
      "Spécificités sport/animation (exemples)": "bpjeps"
    },
    {
      "Dispositif": "Aide handicap emploi",
      "Sigle": "AHE",
      "Domaine": "Compensation",
      "Thématique": "Handicap",
      "Ce qui est financé": "equipement et accompagnement",
      "Objectif / ce que ça permet": "compenser le handicap",
      "Publics éligibles": "salarie et demandeur d'emploi",
      "Spécificités sport/animation (exemples)": "agefiph"
    },
    {
      "Dispositif": "Aide individuelle à la formation",
      "Sigle": "AIF",
      "Domaine": "France Travail",
      "ThÃ©matique": "Financement de formation",
      "Ce qui est financÃ©": "frais pedagogiques",
      "Objectif / ce que Ã§a permet": "completer un financement de formation",
      "Publics Ã©ligibles": "demandeur d'emploi",
      "SpÃ©cificitÃ©s sport/animation (exemples)": "bpjeps"
    },
    {
      "Dispositif": "Préparation opérationnelle à l’emploi individuelle",
      "Sigle": "POEI",
      "Domaine": "France Travail",
      "ThÃ©matique": "Recrutement",
      "Ce qui est financÃ©": "formation avant embauche",
      "Objectif / ce que Ã§a permet": "adapter les competences avant prise de poste",
      "Publics Ã©ligibles": "demandeur d'emploi",
      "SpÃ©cificitÃ©s sport/animation (exemples)": "bpjeps"
    },
    {
      "Dispositif": "Contrat d’engagement jeune (accompagnement intensif + allocation)",
      "Sigle": "CEJ",
      "Domaine": "Jeunes",
      "ThÃ©matique": "Accompagnement",
      "Ce qui est financÃ©": "accompagnement allocation",
      "Objectif / ce que Ã§a permet": "insertion des jeunes",
      "Publics Ã©ligibles": "jeune mission locale",
      "SpÃ©cificitÃ©s sport/animation (exemples)": "bpjeps"
    }
  ],
  region_hdf: []
};

const core = createCore(sampleData);

test("defaultState exposes expected defaults", ()=>{
  const state = core.defaultState();
  assert.equal(state.statut, "");
  assert.equal(state.cpf_action, "unknown");
  assert.equal(state.target_contract, "unknown");
  assert.equal(state.ptp_seniority, "unknown");
  assert.equal(state.apprentissage_exception, "unknown");
  assert.equal(state.contratpro_case, "unknown");
  assert.equal(state.allocation_ft, "unknown");
  assert.deepEqual(state.needs, {transport:false, hebergement:false, equipement:false});
});

test("alternance scenario is prioritized when employer and alternance are confirmed", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps"
  };
  const { packs } = core.buildPacks(state);
  assert.equal(packs[0].id, "apprentissage");
});

test("CPF applies RS cap before computing minimum rest", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    formation: "bpjeps",
    cost_peda: 5000,
    cpf_amount: 3000,
    cpf_action: "rs"
  };
  const result = core.resteTriplet("cpf", state);
  assert.equal(result.minValue, 3500);
  assert.match(result.hint, /Plafond CPF appliqué/);
});

test("PTP is prioritized for salaried profiles", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "sal",
    formation: "bpjeps",
    cost_peda: 6500,
    alternance: "non",
    employeur: "non"
  };
  const { packs } = core.buildPacks(state);
  assert.equal(packs[0].id, "ptp");
});

test("collective funded session remains a visible scenario when status is unknown", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    formation: "bpjeps",
    prf_simple: "nspp"
  };
  const { packs } = core.buildPacks(state);
  assert.ok(packs.some((pack)=> pack.id === "prf"));
  const prfPack = packs.find((pack)=> pack.id === "prf");
  assert.equal(prfPack.eligibility.status, "conditional");
});

test("missingToImprove suggests France Travail complement for job seekers with CPF shortfall", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    formation: "bpjeps",
    cost_peda: 4000,
    cpf_amount: 1000
  };
  const prf = core.detectPRF(state);
  const missing = core.missingToImprove("cpf", state, prf);
  assert.ok(missing.some((item)=> item.includes("France Travail")));
});

test("CPF pack explains FT, AIF and Region when rights are insufficient", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    formation: "bpjeps",
    cost_peda: 5000,
    cpf_amount: 500
  };
  const eligibility = core.evaluatePackEligibility("cpf", state, core.detectPRF(state));
  assert.ok(eligibility.reasons.some((item)=> item.includes("France Travail")));
  assert.ok(eligibility.reasons.some((item)=> item.includes("AIF")));
  assert.ok(eligibility.reasons.some((item)=> item.includes("Hauts-de-France")));
});

test("PRF coverage exposes AREF when ARE is declared", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    allocation_ft: "are"
  };
  const coverage = core.coverageForPack("prf", state);
  assert.equal(coverage.remuneration, "✓ (AREF puis RFF selon droits)");
});

test("PRF coverage stays conditional on RFFT without ARE", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    allocation_ft: "none"
  };
  const coverage = core.coverageForPack("prf", state);
  assert.equal(coverage.remuneration, "◐ (RFFT selon cas)");
});

test("filterOtherDispositifs keeps relevant mobility and handicap aids", ()=>{
  const demandeur = {
    ...core.defaultState(),
    statut: "de",
    formation: "bpjeps",
    handicap: "oui",
    needs: {transport:true, hebergement:false, equipement:false}
  };
  const filtered = core.filterOtherDispositifs(demandeur);
  assert.equal(filtered.length, 2);
});

test("France Travail mobility aid stays hidden without a real annex need", ()=>{
  const mobilityCore = createCore({
    catalogue: [
      {
        "Dispositif": "Aide à la mobilité (déplacement, repas, hébergement) pendant une formation",
        "Sigle": "Aide mobilité (FT)",
        "Domaine": "France Travail",
        "Thématique": "Mobilité",
        "Ce qui est financé": "déplacement, restauration, hébergement",
        "Objectif / ce que ça permet": "sécuriser l'entrée en formation",
        "Publics éligibles": "demandeur d'emploi",
        "Spécificités sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const withoutNeed = mobilityCore.filterOtherDispositifs({
    ...mobilityCore.defaultState(),
    statut: "de",
    allocation_ft: "none",
    needs: {transport:false, hebergement:false, equipement:false}
  });
  assert.equal(withoutNeed.length, 0);

  const withNeed = mobilityCore.filterOtherDispositifs({
    ...mobilityCore.defaultState(),
    statut: "de",
    allocation_ft: "none",
    needs: {transport:true, hebergement:false, equipement:false}
  });
  assert.equal(withNeed.length, 1);
});

test("mobility missing items surface France Travail and apprentissage annex aids", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "alt",
    age: "26-29",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    allocation_ft: "none",
    needs: {transport:true, hebergement:true, equipement:true}
  };
  const prf = core.detectPRF(state);
  const missing = core.missingToImprove("apprentissage", state, prf);
  assert.ok(missing.some((item)=> item.includes("Génération #HDF")));
  assert.ok(missing.some((item)=> item.includes("En route pour l'emploi")));
});

test("En route pour l'emploi and Generation HDF need a concrete alternance mobility context", ()=>{
  const annexCore = createCore({
    catalogue: [
      {
        "Dispositif": "Carte Génération #HDF (apprentis) – équipement + aides THR",
        "Sigle": "Génération #HDF",
        "Domaine": "Région",
        "Thématique": "Apprentissage",
        "Ce qui est financé": "équipement, transport, hébergement, restauration",
        "Objectif / ce que ça permet": "réduire les frais annexes en apprentissage",
        "Publics éligibles": "apprentis",
        "Spécificités sport/animation (exemples)": "bpjeps"
      },
      {
        "Dispositif": "En route pour l’emploi (prêt de véhicule à 1€/jour)",
        "Sigle": "ERPE",
        "Domaine": "Mobilité",
        "Thématique": "Transport",
        "Ce qui est financé": "mise à disposition d’un véhicule",
        "Objectif / ce que ça permet": "sécuriser l'accès à la formation ou au contrat",
        "Publics éligibles": "alternance, emploi, stage",
        "Spécificités sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const withoutPath = annexCore.filterOtherDispositifs({
    ...annexCore.defaultState(),
    statut: "de",
    age: "26-29",
    alternance: "non",
    employeur: "non",
    needs: {transport:true, hebergement:false, equipement:false}
  });
  assert.equal(withoutPath.length, 0);

  const withPath = annexCore.filterOtherDispositifs({
    ...annexCore.defaultState(),
    statut: "alt",
    age: "26-29",
    alternance: "oui",
    employeur: "oui",
    needs: {transport:true, hebergement:false, equipement:true}
  });
  const names = withPath.map((item)=> item["Dispositif"]);
  assert.ok(names.some((name)=> name.includes("En route")));
  assert.ok(names.some((name)=> name.includes("Génération")));
});

test("Carte Generation HDF stays hidden for 30+ without apprentissage exception", ()=>{
  const annexCore = createCore({
    catalogue: [
      {
        "Dispositif": "Carte Generation #HDF (apprentis) - equipement + aides THR",
        "Sigle": "Generation #HDF",
        "Domaine": "RÃ©gion",
        "ThÃ©matique": "Apprentissage",
        "Ce qui est financÃ©": "Ã©quipement, transport, hÃ©bergement, restauration",
        "Objectif / ce que Ã§a permet": "rÃ©duire les frais annexes en apprentissage",
        "Publics Ã©ligibles": "apprentis",
        "SpÃ©cificitÃ©s sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const olderWithoutException = annexCore.filterOtherDispositifs({
    ...annexCore.defaultState(),
    statut: "de",
    age: "30-35",
    alternance: "oui",
    employeur: "oui",
    apprentissage_exception: "unknown",
    handicap: "non",
    needs: {transport:true, hebergement:false, equipement:true}
  });
  assert.ok(!olderWithoutException.some((item)=> String(item["Dispositif"] || "").includes("Generation #HDF")));

  const olderWithException = annexCore.filterOtherDispositifs({
    ...annexCore.defaultState(),
    statut: "de",
    age: "30-35",
    alternance: "oui",
    employeur: "oui",
    apprentissage_exception: "handicap",
    handicap: "oui",
    needs: {transport:true, hebergement:false, equipement:true}
  });
  assert.ok(olderWithException.some((item)=> String(item["Dispositif"] || "").includes("Generation #HDF")));
});

test("Mobili-Jeune is under 30 while Loca-Pass can still surface for older alternance housing contexts", ()=>{
  const logementCore = createCore({
    catalogue: [
      {
        "Dispositif": "Mobili-Jeune (aide au loyer en alternance)",
        "Sigle": "Mobili-Jeune",
        "Domaine": "Logement / alternance",
        "Thématique": "Logement",
        "Ce qui est financé": "part du loyer",
        "Objectif / ce que ça permet": "réduire le coût du logement en alternance",
        "Publics éligibles": "jeunes alternants",
        "Spécificités sport/animation (exemples)": "bpjeps"
      },
      {
        "Dispositif": "Avance Loca-Pass (dépôt de garantie)",
        "Sigle": "Loca-Pass",
        "Domaine": "Logement / alternance",
        "Thématique": "Logement",
        "Ce qui est financé": "dépôt de garantie",
        "Objectif / ce que ça permet": "entrer dans le logement",
        "Publics éligibles": "jeunes, alternants, demandeurs d'emploi",
        "Spécificités sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const withoutHousingNeed = logementCore.filterOtherDispositifs({
    ...logementCore.defaultState(),
    statut: "alt",
    age: "26-29",
    alternance: "oui",
    employeur: "oui",
    needs: {transport:true, hebergement:false, equipement:false}
  });
  assert.equal(withoutHousingNeed.length, 0);

  const tooOld = logementCore.filterOtherDispositifs({
    ...logementCore.defaultState(),
    statut: "alt",
    age: "36-44",
    alternance: "oui",
    employeur: "oui",
    needs: {transport:false, hebergement:true, equipement:false}
  });
  assert.equal(tooOld.length, 1);
  assert.ok(String(tooOld[0]["Dispositif"] || "").includes("Loca-Pass"));

  const eligible = logementCore.filterOtherDispositifs({
    ...logementCore.defaultState(),
    statut: "alt",
    age: "26-29",
    alternance: "oui",
    employeur: "oui",
    needs: {transport:false, hebergement:true, equipement:false}
  });
  assert.equal(eligible.length, 2);
});

test("FT and Region complements are surfaced only when CPF is insufficient", ()=>{
  const cpfCore = createCore({
    catalogue: [
      {
        "Dispositif": "Aide individuelle à la formation",
        "Sigle": "AIF",
        "Domaine": "France Travail",
        "ThÃƒÂ©matique": "Financement de formation",
        "Ce qui est financÃƒÂ©": "frais pedagogiques",
        "Objectif / ce que ÃƒÂ§a permet": "completer un financement de formation",
        "Publics ÃƒÂ©ligibles": "demandeur d'emploi",
        "SpÃƒÂ©cificitÃƒÂ©s sport/animation (exemples)": "bpjeps"
      },
      {
        "Dispositif": "Abondement France Travail sur un dossier CPF (financement complémentaire)",
        "Sigle": "Aide France Travail (CPF)",
        "Domaine": "France Travail",
        "ThÃƒÂ©matique": "CPF",
        "Ce qui est financÃƒÂ©": "reste a charge pedagogique",
        "Objectif / ce que ÃƒÂ§a permet": "completer le CPF",
        "Publics ÃƒÂ©ligibles": "demandeur d'emploi",
        "SpÃƒÂ©cificitÃƒÂ©s sport/animation (exemples)": "bpjeps"
      },
      {
        "Dispositif": "Chèque Pass Formation / Pass Formation (abondement CPF)",
        "Sigle": "Pass Formation",
        "Domaine": "Région",
        "ThÃƒÂ©matique": "CPF",
        "Ce qui est financÃƒÂ©": "reste a charge pedagogique",
        "Objectif / ce que ÃƒÂ§a permet": "completer le CPF",
        "Publics ÃƒÂ©ligibles": "demandeur d'emploi",
        "SpÃƒÂ©cificitÃƒÂ©s sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const enoughCpf = cpfCore.filterOtherDispositifs({
    ...cpfCore.defaultState(),
    statut: "de",
    formation: "bpjeps",
    cost_peda: 1200,
    cpf_amount: 1500
  });
  assert.equal(enoughCpf.length, 0);

  const shortCpf = cpfCore.filterOtherDispositifs({
    ...cpfCore.defaultState(),
    statut: "de",
    formation: "bpjeps",
    cost_peda: 3500,
    cpf_amount: 1200
  });
  assert.equal(shortCpf.length, 3);
});

test("apprentissage is downgraded when age is above the standard limit", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    age: "30+",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    handicap: "non",
    apprentissage_exception: "none"
  };
  const eligibility = core.evaluatePackEligibility("apprentissage", state, core.detectPRF(state));
  assert.equal(eligibility.status, "ineligible");

  const { packs } = core.buildPacks(state);
  assert.notEqual(packs[0].id, "apprentissage");
});

test("apprentissage stays conditional when age is unknown", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps"
  };
  const eligibility = core.evaluatePackEligibility("apprentissage", state, core.detectPRF(state));
  assert.equal(eligibility.status, "conditional");
});

test("contrat pro remains possible for 30+ job seekers", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    age: "30+",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps"
  };
  const eligibility = core.evaluatePackEligibility("contratpro", state, core.detectPRF(state));
  assert.notEqual(eligibility.status, "ineligible");
});

test("contrat pro remains possible after 26 for RSA beneficiaries", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "sal",
    age: "30-35",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    contratpro_case: "rsa"
  };
  const eligibility = core.evaluatePackEligibility("contratpro", state, core.detectPRF(state));
  assert.equal(eligibility.status, "eligible");
});

test("contrat pro 45+ job seekers expose cumulative employer aids", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    age: "45+",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps"
  };
  const eligibility = core.evaluatePackEligibility("contratpro", state, core.detectPRF(state));
  assert.equal(eligibility.status, "eligible");
  assert.ok(eligibility.reasons.some((item)=> item.includes("4 000 €")));
});

test("contrat pro is rejected after 26 when no opening case applies", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "sal",
    age: "30-35",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    contratpro_case: "none"
  };
  const eligibility = core.evaluatePackEligibility("contratpro", state, core.detectPRF(state));
  assert.equal(eligibility.status, "ineligible");
});

test("apprentissage remains possible after 29 with a declared exception", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    age: "30-35",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    apprentissage_exception: "creation"
  };
  const eligibility = core.evaluatePackEligibility("apprentissage", state, core.detectPRF(state));
  assert.equal(eligibility.status, "conditional");
});

test("apprentissage suite de contrat is rejected beyond 35 years", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "de",
    age: "36+",
    alternance: "oui",
    employeur: "oui",
    formation: "bpjeps",
    apprentissage_exception: "suite"
  };
  const eligibility = core.evaluatePackEligibility("apprentissage", state, core.detectPRF(state));
  assert.equal(eligibility.status, "ineligible");
});

test("PTP is rejected when seniority is declared insufficient", ()=>{
  const state = {
    ...core.defaultState(),
    statut: "sal",
    formation: "bpjeps",
    ptp_seniority: "no"
  };
  const eligibility = core.evaluatePackEligibility("ptp", state, core.detectPRF(state));
  assert.equal(eligibility.status, "ineligible");
});

test("POEI is excluded without employer confirmation", ()=>{
  const ftCore = createCore({
    catalogue: [
      {
        "Dispositif": "Preparation operationnelle a l'emploi individuelle",
        "Sigle": "POEI",
        "Domaine": "France Travail",
        "ThÃ©matique": "Recrutement",
        "Ce qui est financÃ©": "formation avant embauche",
        "Objectif / ce que Ã§a permet": "adapter les competences avant prise de poste",
        "Publics Ã©ligibles": "demandeur d'emploi",
        "SpÃ©cificitÃ©s sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const noEmployer = ftCore.filterOtherDispositifs({
    ...ftCore.defaultState(),
    statut: "de",
    formation: "bpjeps",
    employeur: "non"
  });
  assert.equal(noEmployer.length, 0);

  const withEmployer = ftCore.filterOtherDispositifs({
    ...ftCore.defaultState(),
    statut: "de",
    formation: "bpjeps",
    employeur: "oui",
    target_contract: "12plus"
  });
  assert.equal(withEmployer.length, 1);
});

test("AFPR is selected only for 6 to 11 month contracts", ()=>{
  const ftCore = createCore({
    catalogue: [
      {
        "Dispositif": "Action de formation prealable au recrutement",
        "Sigle": "AFPR",
        "Domaine": "France Travail",
        "ThÃƒÂ©matique": "Recrutement",
        "Ce qui est financÃƒÂ©": "formation avant embauche",
        "Objectif / ce que ÃƒÂ§a permet": "adapter les competences avant prise de poste",
        "Publics ÃƒÂ©ligibles": "demandeur d'emploi",
        "SpÃƒÂ©cificitÃƒÂ©s sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const longContract = ftCore.filterOtherDispositifs({
    ...ftCore.defaultState(),
    statut: "de",
    formation: "bpjeps",
    employeur: "oui",
    target_contract: "12plus"
  });
  assert.equal(longContract.length, 0);

  const shortContract = ftCore.filterOtherDispositifs({
    ...ftCore.defaultState(),
    statut: "de",
    formation: "bpjeps",
    employeur: "oui",
    target_contract: "6to11"
  });
  assert.equal(shortContract.length, 1);
});

test("CEJ is excluded for 30+ profiles", ()=>{
  const youngCore = createCore({
    catalogue: [
      {
        "Dispositif": "Contrat d'engagement jeune handicap (accompagnement intensif + allocation)",
        "Sigle": "CEJ",
        "Domaine": "Jeunes",
        "ThÃ©matique": "Accompagnement",
        "Ce qui est financÃ©": "accompagnement allocation",
        "Objectif / ce que Ã§a permet": "insertion des jeunes",
        "Publics Ã©ligibles": "jeune mission locale",
        "Publics ÃƒÂ©ligibles": "jeune mission locale",
        "SpÃ©cificitÃ©s sport/animation (exemples)": "bpjeps",
        "SpÃƒÂ©cificitÃƒÂ©s sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const older = youngCore.filterOtherDispositifs({
    ...youngCore.defaultState(),
    statut: "jeune",
    age: "30+",
    formation: "bpjeps"
  });
  assert.equal(older.length, 0);
});

test("CEJ stays possible up to 29 only for disabled young profiles", ()=>{
  const youngCore = createCore({
    catalogue: [
      {
        "Dispositif": "Contrat d'engagement jeune handicap (accompagnement intensif + allocation)",
        "Sigle": "CEJ",
        "Domaine": "Jeunes",
        "ThÃƒÂ©matique": "Accompagnement",
        "Ce qui est financÃƒÂ©": "accompagnement allocation",
        "Objectif / ce que ÃƒÂ§a permet": "insertion des jeunes",
        "Publics Ã©ligibles": "jeune mission locale",
        "SpÃ©cificitÃ©s sport/animation (exemples)": "bpjeps"
      }
    ],
    region_hdf: []
  });

  const noHandicap = youngCore.filterOtherDispositifs({
    ...youngCore.defaultState(),
    statut: "jeune",
    age: "26-29",
    handicap: "non",
    formation: "bpjeps"
  });
  assert.equal(noHandicap.length, 0);

  const withHandicap = youngCore.filterOtherDispositifs({
    ...youngCore.defaultState(),
    statut: "jeune",
    age: "26-29",
    handicap: "oui",
    formation: "bpjeps"
  });
  assert.equal(withHandicap.length, 1);
});

test("all primary scenarios expose coherent why blocks and aligned sources", ()=>{
  const scenarios = [
    {
      id: "apprentissage",
      state: {
        ...core.defaultState(),
        statut: "alt",
        alternance: "oui",
        employeur: "oui",
        formation: "bpjeps"
      }
    },
    {
      id: "contratpro",
      state: {
        ...core.defaultState(),
        statut: "alt",
        age: "30-35",
        alternance: "oui",
        employeur: "oui",
        formation: "bpjeps"
      }
    },
    {
      id: "prf",
      state: {
        ...core.defaultState(),
        statut: "de",
        formation: "bpjeps",
        prf_simple: "nspp"
      }
    },
    {
      id: "cpf",
      state: {
        ...core.defaultState(),
        statut: "de",
        formation: "bpjeps",
        cost_peda: 5000,
        cpf_amount: 500
      }
    },
    {
      id: "ptp",
      state: {
        ...core.defaultState(),
        statut: "sal",
        formation: "bpjeps",
        cost_peda: 6500
      }
    },
    {
      id: "faf",
      state: {
        ...core.defaultState(),
        statut: "ind",
        formation: "bpjeps",
        cpf_amount: 800
      }
    }
  ];

  for(const scenario of scenarios){
    const { packs } = core.buildPacks(scenario.state);
    const pack = packs.find((item)=> item.id === scenario.id);
    assert.ok(pack, `missing pack ${scenario.id}`);
    assert.ok(Array.isArray(pack.why));
    assert.ok(Array.isArray(pack.whySources));
    assert.equal(pack.why.length, 3, `unexpected why length for ${scenario.id}`);
    assert.equal(pack.whySources.length, pack.why.length, `whySources misaligned for ${scenario.id}`);
    assert.ok(pack.why[0].length > 40, `why[0] too short for ${scenario.id}`);
    assert.ok(pack.why[1].length > 40, `why[1] too short for ${scenario.id}`);
    assert.ok(pack.why[2].length > 30, `why[2] too short for ${scenario.id}`);
  }
});
