const assert = require("node:assert/strict");
const ui = require("../simulator-ui.js");

function test(name, fn){
  try{
    fn();
    console.log(`OK - ${name}`);
  }catch(error){
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

const normalize = (value)=> String(value || "").toLowerCase();

test("missing details keep a consistent 3-step structure for primary blockers", ()=>{
  const samples = [
    "Trouver un employeur",
    "Verifier l'eligibilite CPF de la formation",
    "Abondement France Travail sur un dossier CPF",
    "Verifier si la session est financee Region (PRF/SFER) via C2RP ou PRIF",
    "Prendre RDV CEP puis constituer le dossier PTP",
    "Identifier le FAF competent"
  ];

  for(const sample of samples){
    const detail = ui.getMissingDetails(sample, normalize);
    assert.ok(detail.tagline.length > 30, `tagline too short for ${sample}`);
    assert.ok(Array.isArray(detail.how), `how missing for ${sample}`);
    assert.ok(Array.isArray(detail.who), `who missing for ${sample}`);
    assert.equal(detail.how.length, 3, `unexpected how length for ${sample}`);
    assert.ok(detail.who.length >= 1, `unexpected who length for ${sample}`);
  }
});

test("missing details for logement and mobilite remain explicit", ()=>{
  const logement = ui.getMissingDetails("Verifier Mobili-Jeune / Loca-Pass", normalize);
  const mobilite = ui.getMissingDetails("Aide a la mobilite France Travail", normalize);

  assert.match(logement.tagline, /logement|alternance/i);
  assert.equal(logement.how.length, 3);
  assert.ok(logement.who.some((item)=> item.includes("Action Logement")));

  assert.match(mobilite.tagline, /mobilit|surco/i);
  assert.equal(mobilite.how.length, 3);
  assert.ok(mobilite.who.some((item)=> item.includes("France Travail")));
});

test("missing details for AIF stay specific and not generic", ()=>{
  const detail = ui.getMissingDetails("Aide individuelle a la formation", normalize);

  assert.match(detail.tagline, /AIF|complement|instruction/i);
  assert.equal(detail.how.length, 3);
  assert.ok(detail.who.some((item)=> item.includes("France Travail")));
});
