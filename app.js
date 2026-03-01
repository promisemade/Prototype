/* Prototype V6 (Express + Detailed + ranges + share + kiosk) */
/* global DISPOSITIFS_DATA, QRCode */

const $ = (id) => document.getElementById(id);

const core = window.SimulatorCore.createCore(DISPOSITIFS_DATA);
const ui = window.SimulatorUI;
const {
  META,
  catalogue,
  regionHdf,
  dispo,
  defaultState,
  normalize,
  hasAny,
  formatEUR,
  statutLabel,
  formationLabel,
  prfLabel,
  detectPRF,
  buildPacks,
  coverageForPack,
  resteTriplet,
  missingToImprove,
  categorizeDispositifs,
  filterOtherDispositifs
} = core;

let mode = "express";
let kiosk = false;
let autoReset = true;
let viewMode = 'usager';
let inactivityMs = 90_000;
let inactivityTimer = null;
let cartographyEntries = null;
let lastNonMapScreen = "screenStart";

let state = defaultState();

function whoReceivesHTML(bestId, st, prf){
  const lines = [];

  if(bestId === "apprentissage" || bestId === "contratpro"){
    lines.push("<li><strong>Frais p&eacute;dagogiques</strong> : prise en charge (OPCO/CFA) &rarr; versement au <strong>prestataire (organisme/CFA)</strong>. Reste &agrave; charge usager g&eacute;n&eacute;ralement nul.</li>");
    lines.push("<li><strong>R&eacute;mun&eacute;ration</strong> : <strong>salaire vers&eacute; &agrave; la personne</strong> (employeur), selon les r&egrave;gles de l'alternance.</li>");
  } else if(bestId === "prf"){
    lines.push("<li><strong>Frais p&eacute;dagogiques</strong> : financement R&eacute;gion / action conventionn&eacute;e &rarr; paiement au <strong>prestataire (organisme)</strong>. Reste &agrave; charge usager g&eacute;n&eacute;ralement nul si l'entr&eacute;e est valid&eacute;e.</li>");
    if(st.statut === "de"){
      lines.push("<li><strong>Indemnisation</strong> : selon la situation, AREF/RFFT/ARE &rarr; <strong>vers&eacute;e &agrave; la personne</strong> (via l'organisme comp&eacute;tent).</li>");
    } else {
      lines.push("<li><strong>Indemnisation</strong> : selon la situation &rarr; g&eacute;n&eacute;ralement <strong>vers&eacute;e &agrave; la personne</strong> si applicable.</li>");
    }
  } else if(bestId === "ptp"){
    lines.push("<li><strong>Frais p&eacute;dagogiques</strong> : si le PTP est accept&eacute;, prise en charge &rarr; paiement au <strong>prestataire (organisme)</strong>.</li>");
    lines.push("<li><strong>R&eacute;mun&eacute;ration</strong> : maintien partiel/total possible &rarr; <strong>vers&eacute;e &agrave; la personne</strong> (selon les r&egrave;gles applicables).</li>");
  } else if(bestId === "faf"){
    lines.push("<li><strong>Frais p&eacute;dagogiques</strong> : selon le FAF, paiement possible au prestataire ou remboursement &rarr; souvent <strong>&agrave; la personne</strong> sur justificatifs.</li>");
  } else {
    lines.push("<li><strong>Frais p&eacute;dagogiques</strong> : CPF &rarr; paiement au <strong>prestataire (organisme)</strong>. Reste &agrave; charge &eacute;ventuel <strong>pay&eacute; par la personne</strong>.</li>");
  }

  lines.push("<li><strong>Frais annexes (transport/h&eacute;bergement)</strong> : le plus souvent <strong>vers&eacute;s/rembours&eacute;s &agrave; la personne</strong> (sur justificatifs) si une aide existe.</li>");
  lines.push("<li><strong>&Eacute;quipement</strong> : le plus souvent <strong>&agrave; la charge de la personne</strong>, avec parfois une aide d&eacute;di&eacute;e selon les dispositifs.</li>");

  return `<ul>${lines.join("")}</ul>`;
}

function getRadio(name, fallback=""){
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : fallback;
}

let activeDetailPicker = null;

function closeDetailPicker(picker, restoreFocus=false){
  if(!picker) return;
  const button = picker.querySelector(".detail-picker__button");
  const menu = picker.querySelector(".detail-picker__menu");
  picker.classList.remove("is-open");
  if(button) button.setAttribute("aria-expanded", "false");
  if(menu) menu.hidden = true;
  if(restoreFocus && button) button.focus();
  if(activeDetailPicker === picker) activeDetailPicker = null;
}

function syncDetailPicker(select){
  const picker = select?._detailPicker;
  if(!picker) return;
  const button = picker.querySelector(".detail-picker__button");
  const value = picker.querySelector(".detail-picker__value");
  const options = picker.querySelectorAll(".detail-picker__option");
  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  if(value) value.textContent = selectedOption ? selectedOption.textContent.trim() : "Choisir";
  options.forEach((optionEl)=>{
    const isActive = optionEl.dataset.value === select.value;
    optionEl.classList.toggle("is-active", isActive);
    optionEl.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  if(button) button.disabled = !!select.disabled;
}

function focusDetailPickerOption(picker, direction){
  const options = Array.from(picker.querySelectorAll(".detail-picker__option:not(:disabled)"));
  if(!options.length) return;
  const active = document.activeElement;
  const currentIndex = options.indexOf(active);
  let nextIndex = 0;
  if(direction === "first") nextIndex = 0;
  else if(direction === "last") nextIndex = options.length - 1;
  else if(currentIndex >= 0) nextIndex = (currentIndex + direction + options.length) % options.length;
  else {
    const selectedIndex = options.findIndex((optionEl)=> optionEl.classList.contains("is-active"));
    nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
  }
  options[nextIndex].focus();
}

function selectDetailPickerValue(select, value){
  if(select.value !== value){
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  syncDetailPicker(select);
  closeDetailPicker(select._detailPicker, true);
}

function initDetailPicker(select){
  if(!select || select._detailPicker) return;
  const field = select.closest(".field");
  const label = field ? field.querySelector(`label[for="${select.id}"]`) : null;
  const picker = document.createElement("div");
  const button = document.createElement("button");
  const value = document.createElement("span");
  const chevron = document.createElement("span");
  const menu = document.createElement("div");

  picker.className = "detail-picker";
  button.type = "button";
  button.className = "detail-picker__button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", label ? label.textContent.trim() : "Choisir une option");
  value.className = "detail-picker__value";
  chevron.className = "detail-picker__chevron";
  chevron.innerHTML = '<i class="ri ri-arrow-down-s-line" aria-hidden="true"></i>';
  menu.className = "detail-picker__menu";
  menu.hidden = true;
  menu.id = `${select.id}PickerMenu`;
  menu.setAttribute("role", "listbox");
  button.setAttribute("aria-controls", menu.id);
  button.append(value, chevron);
  picker.append(button, menu);
  select.insertAdjacentElement("afterend", picker);
  field?.classList.add("field--picker");

  Array.from(select.options).forEach((option)=>{
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "detail-picker__option";
    optionButton.dataset.value = option.value;
    optionButton.setAttribute("role", "option");
    optionButton.textContent = option.textContent.trim();
    optionButton.disabled = !!option.disabled;
    optionButton.addEventListener("click", ()=> selectDetailPickerValue(select, option.value));
    optionButton.addEventListener("keydown", (event)=>{
      if(event.key === "ArrowDown"){
        event.preventDefault();
        focusDetailPickerOption(picker, 1);
      }else if(event.key === "ArrowUp"){
        event.preventDefault();
        focusDetailPickerOption(picker, -1);
      }else if(event.key === "Home"){
        event.preventDefault();
        focusDetailPickerOption(picker, "first");
      }else if(event.key === "End"){
        event.preventDefault();
        focusDetailPickerOption(picker, "last");
      }else if(event.key === "Escape"){
        event.preventDefault();
        closeDetailPicker(picker, true);
      }
    });
    menu.appendChild(optionButton);
  });

  button.addEventListener("click", ()=>{
    if(activeDetailPicker && activeDetailPicker !== picker) closeDetailPicker(activeDetailPicker);
    if(picker.classList.contains("is-open")){
      closeDetailPicker(picker);
      return;
    }
    picker.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    activeDetailPicker = picker;
    focusDetailPickerOption(picker, 0);
  });

  button.addEventListener("keydown", (event)=>{
    if(["ArrowDown", "Enter", " "].includes(event.key)){
      event.preventDefault();
      button.click();
    }else if(event.key === "Escape"){
      closeDetailPicker(picker);
    }
  });

  if(label){
    label.addEventListener("click", (event)=>{
      event.preventDefault();
      event.stopPropagation();
      button.focus();
      button.click();
    });
  }

  select.addEventListener("change", ()=> syncDetailPicker(select));
  select._detailPicker = picker;
  syncDetailPicker(select);
}

function initDetailPickers(){
  document.querySelectorAll("[data-detail-picker]").forEach(initDetailPicker);
}

function syncDetailPickers(){
  document.querySelectorAll("[data-detail-picker]").forEach(syncDetailPicker);
}

document.addEventListener("click", (event)=>{
  if(activeDetailPicker && !activeDetailPicker.contains(event.target)){
    closeDetailPicker(activeDetailPicker);
  }
});

document.addEventListener("keydown", (event)=>{
  if(event.key === "Escape" && activeDetailPicker){
    closeDetailPicker(activeDetailPicker, true);
  }
});

function showScreen(id){
  if(id !== "screenMap") lastNonMapScreen = id;
  ["screenStart","screenExpress","screenDetailed","screenMap","screenResults"].forEach(s=>{
    $(s).classList.toggle("hidden", s !== id);
  });
  window.scrollTo({top:0, behavior:"smooth"});
}

function setPillActive(activeId, otherId){
  const a = $(activeId);
  const b = $(otherId);
  a.classList.add("is-active");
  b.classList.remove("is-active");
  a.setAttribute("aria-pressed","true");
  b.setAttribute("aria-pressed","false");
}

function autoResetLabel(){
  if(!autoReset) return "OFF";
  return `ON (${Math.round(inactivityMs / 1000)}s)`;
}

function syncAutoResetToggle(){
  const btn = $("toggleAutoReset");
  if(!btn) return;
  const stateEl = btn.querySelector(".switchbtn__state");
  if(stateEl) stateEl.textContent = autoResetLabel();
  btn.classList.toggle("is-on", autoReset);
}

function setKiosk(on){
  kiosk = on;
  document.body.classList.toggle("kiosk", kiosk);
  const s = $("toggleKiosk").querySelector(".switchbtn__state"); if(s) s.textContent = kiosk ? "ON" : "OFF"; $("toggleKiosk").classList.toggle("is-on", kiosk);

  if(kiosk){
    // For salons: keep it short, touch-friendly, and avoid long lists
    mode = "express";
    setPillActive("modeExpress","modeDetailed");
    setAutoReset(true);
    inactivityMs = 60_000;
  } else {
    inactivityMs = 90_000;
  }
  syncAutoResetToggle();
  resetInactivityTimer();
}

function setAutoReset(on){
  autoReset = on;
  syncAutoResetToggle();
  resetInactivityTimer();
}

function setViewMode(vm){
  viewMode = vm;
  document.body.classList.toggle("expert", viewMode === "expert");
  document.body.classList.toggle("usager", viewMode !== "expert");

  const btn = $("btnToggleView");
  if(btn){
    const lbl = btn.querySelector(".btnlabel"); if(lbl){ lbl.textContent = (viewMode === "expert") ? "Passer en vue usager" : "Passer en vue expert"; }
  }

  // Enable/disable the expert tab
  document.querySelectorAll(".tab").forEach(t=>{
    if(t.getAttribute("data-tab")==="tout"){
      t.disabled = (viewMode !== "expert");
      t.classList.toggle("tab--disabled", t.disabled);
    }
  });
}


function resetInactivityTimer(){
  if(inactivityTimer) clearTimeout(inactivityTimer);
  if(!autoReset) return;
  inactivityTimer = setTimeout(()=>{ hardReset(); }, inactivityMs);
}
["click","mousemove","keydown","touchstart","scroll"].forEach(evt=>{
  window.addEventListener(evt, resetInactivityTimer, {passive:true});
});

function hardReset(){
  state = defaultState();
  wizard.reset();
  clearUrlState();
  showScreen("screenStart");
}

function clearUrlState(){
  if(location.hash){
    history.replaceState(null, "", location.pathname + location.search);
  }
}

/* ---------- Data ---------- */

function compactSourceLabel(name, item){
  const sigle = item ? String(item["Sigle"] || "").trim() : "";
  if(sigle) return sigle;

  const raw = String(name || "").trim();
  if(raw.length <= 36) return raw;

  const parts = raw.split(" - ").map((part)=>part.trim()).filter(Boolean);
  let label = parts[0] || raw;
  if(label.length < 12 && parts[1]){
    label = `${label} - ${parts[1]}`;
  }
  if(label.length > 40){
    label = `${label.slice(0, 37).trimEnd()}...`;
  }
  return label;
}

function resolveDispositif(name){
  const direct = dispo(name);
  if(direct) return direct;

  const normalizedName = repairDisplayText(name || "").trim();
  if(!normalizedName) return null;
  const desiredKey = cartographyCanonicalKey(normalizedName, "");
  const pool = [...(catalogue || []), ...(regionHdf || [])].filter(Boolean);
  const candidates = pool.filter((entry)=>{
    const title = repairDisplayText(getDataField(entry, ["Dispositif", "Dispositif (Hauts-de-France)"]) || "");
    const sigle = repairDisplayText(getDataField(entry, ["Sigle"]) || "");
    return cartographyCanonicalKey(title, sigle) === desiredKey;
  });
  if(!candidates.length) return null;

  return candidates.reduce((best, entry)=>{
    const bestScore = scoreCartographyEntry(best) + (getDataField(best, ["Dispositif (Hauts-de-France)"]) ? 3 : 0) + ((best["Sources (URL)"] || []).length ? 1 : 0);
    const score = scoreCartographyEntry(entry) + (getDataField(entry, ["Dispositif (Hauts-de-France)"]) ? 3 : 0) + ((entry["Sources (URL)"] || []).length ? 1 : 0);
    return score > bestScore ? entry : best;
  }, candidates[0]);
}

function sourceReferenceScore(name, item){
  const title = repairDisplayText(name || "");
  const resolvedItem = item || resolveDispositif(title);
  const key = cartographyCanonicalKey(title, resolvedItem ? repairDisplayText(resolvedItem["Sigle"] || "") : "");
  const loose = normalizeLoose(title);
  let score = 0;

  if(resolvedItem && getDataField(resolvedItem, ["Dispositif (Hauts-de-France)"])) score += 6;
  if(resolvedItem && /hauts-de-france|region hdf|région hdf|hdf/i.test(repairDisplayText(JSON.stringify(resolvedItem)))) score += 3;
  if(["prf-sfer-hdf", "chpf", "chpf-sup", "generation-hdf", "pass-emploi-entreprise", "prochinfo-formation", "prochemploi", "pass-vae-hdf"].includes(key)) score += 4;
  if(/\bprif\b|proch|sfer|chpf|generation|paee|hauts-de-france|hdf/.test(loose)) score += 2;
  if(loose === "programme regional de formation" || loose === "action de formation conventionnee") score -= 8;
  if(loose.includes("service public regional de la formation")) score -= 8;
  if(title.length > 40) score += 1;

  return score;
}

function selectBestSourceNames(names){
  const groups = new Map();
  const order = [];

  for(const rawName of names || []){
    const name = repairDisplayText(rawName || "").trim();
    if(!name) continue;
    const item = resolveDispositif(name);
    const key = cartographyCanonicalKey(name, item ? repairDisplayText(item["Sigle"] || "") : "");
    if(!groups.has(key)){
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push({ name, item, score: sourceReferenceScore(name, item) });
  }

  return order.map((key)=>{
    const group = groups.get(key) || [];
    group.sort((a, b)=> b.score - a.score || b.name.length - a.name.length || a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
    return group[0]?.name;
  }).filter(Boolean);
}

function sourcePills(names, limit=2, options={}){
  const arr = selectBestSourceNames(names);
  const seen = options && options.seen instanceof Set ? options.seen : null;
  const used = [];

  for(const name of arr){
    const item = resolveDispositif(name);
    const key = cartographyCanonicalKey(name, item ? repairDisplayText(item["Sigle"] || "") : "");
    if(used.some((entry)=> entry.key === key)) continue;
    if(seen && seen.has(key)) continue;
    used.push({ key, name, item });
    if(seen) seen.add(key);
    if(used.length >= limit) break;
  }

  const pills = used.map(({ name, item })=>{
    const urls = item ? (item["Sources (URL)"] || []) : [];
    const url = urls.length ? urls[0] : "";
    const label = compactSourceLabel(name, item);
    if(!url) return `<span class="sourcelink sourcelink--dead">${escapeHtml(label)}</span>`;
    return `<a class="sourcelink" href="${url}" target="_blank" rel="noopener"><i class="ri ri-external-link-line" aria-hidden="true"></i>${escapeHtml(label)}</a>`;
  }).join("");
  return pills ? `<span class="why-sources">${pills}</span>` : "";
}

function renderSourceList(names){
  return selectBestSourceNames(names).map((name)=>{
    const label = repairDisplayText(name || "").trim();
    if(!label) return "";
    const item = resolveDispositif(name);
    const urls = item ? (item["Sources (URL)"] || []) : [];
    const url = urls.length ? urls[0] : "";
    const link = url ? `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(label)}</a>` : escapeHtml(label);
    return `<div class="pack__source-item"><span class="pack__source-bullet" aria-hidden="true">•</span><span class="pack__source-linkwrap">${link}</span></div>`;
  }).filter(Boolean).join("");
}

function buildCostVigilanceItems(top, st){
  const items = [];
  const ticket = dispo("Participation financière obligatoire au CPF");
  const cpfIsInPlay = (top || []).some((pack)=>
    ["cpf", "faf", "ptp"].includes(pack.id) ||
    (pack.dispositifNames || []).some((name)=> normalizeLoose(name).includes("compte personnel de formation"))
  ) || Number(st.cpf_amount || 0) > 0;

  if(ticket && cpfIsInPlay){
    const urls = ticket["Sources (URL)"] || [];
    const plafonds = repairDisplayText(getDataField(ticket, ["Plafonds / barèmes"])) || "";
    const amountMatch = plafonds.match(/(\d+(?:[.,]\d+)?\s*€)/);
    const amount = amountMatch ? amountMatch[1].replace(/\s+/g, " ") : "103,20 €";
    items.push({
      title: "Participation financière obligatoire au CPF",
      badge: "Coût à prévoir",
      text: `Ce n'est pas une aide. Si vous mobilisez le CPF, une participation forfaitaire de ${amount} peut rester à votre charge en 2026, sauf prise en charge par un tiers selon le dossier.`,
      meta: "À vérifier au moment du dépôt sur Mon Compte Formation, notamment selon les exonérations ou abondements couvrant cette participation.",
      url: urls[0] || ""
    });
  }

  return items;
}

function renderCostVigilanceItems(items){
  if(!items.length) return "";
  return `<div class="list">${items.map((item)=>`
    <div class="item item--warning">
      <div class="item__title">${escapeHtml(item.title)}</div>
      <div class="item__flag item__flag--warning"><i class="ri-alert-line" aria-hidden="true"></i><span>${escapeHtml(item.badge)}</span></div>
      <div class="item__text">${escapeHtml(item.text)}</div>
      <div class="item__meta">${escapeHtml(item.meta)}</div>
      ${item.url ? `<ul class="item__sources"><li><a href="${item.url}" target="_blank" rel="noopener">Source 1</a></li></ul>` : ""}
    </div>
  `).join("")}</div>`;
}


function renderTabPanels(cat){
  if($("tab_payer")) $("tab_payer").innerHTML = `<div class="list">${renderListItems(cat.payer)}</div>`;
  if($("tab_vivre")) $("tab_vivre").innerHTML = `<div class="list">${renderListItems(cat.vivre)}</div>`;
  if($("tab_bouger")) $("tab_bouger").innerHTML = `<div class="list">${renderListItems(cat.bouger)}</div>`;
  if($("tab_tout")) $("tab_tout").innerHTML = `<div class="list">${renderListItems(cat.tout)}</div>`;
}

function getDispositifTitle(entry){
  return repairDisplayText(getDataField(entry, ["Dispositif", "Dispositif (Hauts-de-France)"]) || "—");
}

function getDispositifSigle(entry){
  return repairDisplayText(getDataField(entry, ["Sigle"]));
}

function getDispositifCanonicalKey(entry){
  return cartographyCanonicalKey(getDispositifTitle(entry), getDispositifSigle(entry));
}

function getPreferredRegionalDisplayKey(entry){
  const raw = normalizeCompact(getDispositifTitle(entry));
  if(raw === "programme regional de formation" || raw === "action de formation conventionnee"){
    return "prf-sfer-hdf";
  }
  return getDispositifCanonicalKey(entry);
}

function getPreferredRegionalEntry(entry){
  if(!entry) return entry;
  const desiredKey = getPreferredRegionalDisplayKey(entry);
  const candidates = (regionHdf || []).filter((item)=> getDispositifCanonicalKey(item) === desiredKey);
  if(!candidates.length) return entry;
  return candidates.reduce((best, item)=> scoreCartographyEntry(item) > scoreCartographyEntry(best) ? item : best, candidates[0]);
}

function getRegionalRoleForKey(key){
  if(["prochinfo-formation", "prochemploi"].includes(key)) return "entry";
  return "aid";
}

function isCostRuleKey(key){
  return key === "participation financiere obligatoire au cpf";
}

function isRegionalEntryPoint(entry){
  const key = typeof entry === "string" ? entry : getDispositifCanonicalKey(entry);
  return getRegionalRoleForKey(key) === "entry";
}

function cartographyUsageLabel(entry){
  if(isCostRuleKey(entry?.key || "")){
    return "Règle / coût à prévoir";
  }
  if(entry?.perimeter?.key === "hdf" && isRegionalEntryPoint(entry.key)){
    return "Point d'entrée / relais";
  }
  if(entry?.perimeter?.key === "hdf"){
    return "Levier régional";
  }
  return "Levier mobilisable";
}

function buildConsolidatedDispositifs(dispos){
  const groups = new Map();

  (dispos || []).forEach((rawEntry)=>{
    const entry = getPreferredRegionalEntry(rawEntry);
    const title = getDispositifTitle(entry);
    if(!title || title === "—") return;
    const sigle = getDispositifSigle(entry);
    const key = cartographyCanonicalKey(title, sigle);
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ entry, title, sigle });
  });

  return Array.from(groups.entries()).map(([key, members])=>{
    let selected = members[0];
    members.forEach((member)=>{
      if(scoreCartographyEntry(member.entry) > scoreCartographyEntry(selected.entry)){
        selected = member;
      }
    });

    const merged = { ...selected.entry };
    const urls = [...new Set(members.flatMap((member)=> getDataField(member.entry, ["Sources (URL)"]) || []))];
    merged["Sources (URL)"] = urls;
    merged._canonicalKey = key;
    merged._regionalRole = getRegionalRoleForKey(key);
    merged._family = describeCartographyFamily(key, members.map((member)=>({ title: member.title, source: member.entry })));
    const override = getCartographyFamilyOverrides(key);
    if(override){
      if(override.title) merged._displayTitle = override.title;
      if(override.objective) merged._displayText = override.objective;
      if(override.plafonds) merged._displayPlaf = override.plafonds;
      if(override.demarches) merged._displayDem = override.demarches;
      if(override.domain) merged._displayDomain = override.domain;
    }

    return merged;
  });
}

function renderListItems(dispos){
  const items = buildConsolidatedDispositifs(dispos);
  if(!items.length){
    return `<div class="item item--soft-empty"><div class="item__text">Aucun dispositif suppl&eacute;mentaire &agrave; afficher ici.</div></div>`;
  }

  return items.map(d=>{
    const originalTitleRaw = repairDisplayText(getDataField(d, ["Dispositif", "Dispositif (Hauts-de-France)"]) || "—");
    let titleRaw = d._displayTitle || originalTitleRaw;
    const sigleValue = repairDisplayText(getDataField(d, ["Sigle"]));
    const sigle = d._displayTitle ? "" : (sigleValue ? ` • ${escapeHtml(sigleValue)}` : "");
    const domain = escapeHtml(d._displayDomain || repairDisplayText(getDataField(d, ["Domaine", "Thématique"]) || ""));
    const urls = getDataField(d, ["Sources (URL)"]) || [];
    let textRaw = d._displayText || repairDisplayText(getDataField(d, ["Ce qui est financé", "Objectif / ce que ça permet"]) || "");
    let plafRaw = d._displayPlaf || repairDisplayText(getDataField(d, ["Plafonds / barèmes"]) || "");
    let demRaw = d._displayDem || repairDisplayText(getDataField(d, ["Démarches / interlocuteurs", "Démarches / points d’entrée"]) || "");
    const family = d._family || { badge: "", note: "", parts: [] };

    if(/mobili-jeune/i.test(titleRaw)){
      if(!plafRaw || /[ÃÂâ]/.test(plafRaw)) plafRaw = titleRaw.includes("Action Logement")
        ? "Jusqu'à 100 € / mois (repère 2026)."
        : "Jusqu'à 100 € par mois en 2026 (repère Action Logement).";
      if(!demRaw || /[ÃÂâ]/.test(demRaw)) demRaw = titleRaw.includes("Action Logement")
        ? "Demande en ligne sur Action Logement avec contrat d'alternance et justificatifs logement."
        : "Demande en ligne sur Action Logement avec bail/quittance et contrat d'alternance.";
    }

    if(/loca-pass/i.test(titleRaw)){
      if(!textRaw || /[ÃÂâ]/.test(textRaw)) textRaw = titleRaw.includes("Action Logement")
        ? "Avancer le dépôt de garantie pour entrer dans le logement."
        : "Avance du dépôt de garantie à l'entrée dans le logement.";
      if(!plafRaw || /[ÃÂâ]/.test(plafRaw)) plafRaw = "Avance remboursable selon le plafond Action Logement.";
      if(!demRaw || /[ÃÂâ]/.test(demRaw)) demRaw = titleRaw.includes("Action Logement")
        ? "Demande en ligne sur Action Logement autour de l'entrée dans le logement."
        : "Demande en ligne sur Action Logement avant ou peu après l'entrée dans le logement.";
    }

    if(/pass vae|aides vae régionales 2025|cheque pass vae|chèque pass vae/i.test(titleRaw)){
      titleRaw = `[Non mobilisable en 2026] ${titleRaw}`;
      textRaw = "Alerte 2026 : ce levier régional n'est plus mobilisable. Orientez vers les solutions nationales VAE encore en vigueur.";
      plafRaw = "A compter du 01/01/2026 : non mobilisable en Hauts-de-France.";
      demRaw = "Ne pas déposer sur ce dispositif en 2026. Vérifier plutôt CPF VAE, CEP, employeur, France Travail ou Transitions Pro selon le profil.";
    }

    const title = escapeHtml(titleRaw);
    const text = escapeHtml(textRaw);
    const plaf = escapeHtml(plafRaw);
    const dem = escapeHtml(demRaw);
    const inactiveNeedle = `${titleRaw} ${textRaw} ${plafRaw} ${demRaw}`.toLowerCase();
    const isInactiveByText = [
      "non reconduites",
      "non reconduite",
      "non mobilisable",
      "supprimé",
      "supprime",
      "supprimée",
      "supprimee",
      "à compter du 01/01/2026",
      "a compter du 01/01/2026"
    ].some((needle)=> inactiveNeedle.includes(needle));
    const isInactiveById = /pass vae|aides vae régionales 2025|cheque pass vae|chèque pass vae/i.test(titleRaw);
    const isInactive = isInactiveByText || isInactiveById;
    const warningHtml = isInactive
      ? `<div class="item__flag item__flag--danger"><i class="ri-alert-line" aria-hidden="true"></i><span>Non mobilisable en 2026</span></div>
         <div class="item__text item__text--danger"><strong>Alerte :</strong> ce dispositif n'est pas reconduit en 2026 et ne peut plus être mobilisé. Il reste affiché uniquement comme point de vigilance d'orientation.</div>`
      : "";
    const usageHtml = d._regionalRole === "entry"
      ? `<div class="item__family"><strong>Relais HDF :</strong> cette carte correspond à un point d'entrée ou à un service d'orientation régional, pas à un financeur direct.</div>`
      : "";
    const familyPartsHtml = Array.isArray(family.parts) && family.parts.length
      ? `<div class="item__familychips">${family.parts.map((part)=>`<span class="map-chip map-chip--family">${escapeHtml(part)}</span>`).join("")}</div>`
      : "";
    const sourcesHtml = urls.length
      ? `<ul class="item__sources">${urls.map((u,i)=>`<li><a href="${u}" target="_blank" rel="noopener">Source ${i+1}</a></li>`).join("")}</ul>`
      : "";
    return `
        <div class="item${isInactive ? " item--danger" : ""}">
        <div class="item__title">${title}${sigle}</div>
        ${warningHtml}
        ${usageHtml}
        ${familyPartsHtml}
        <div class="item__meta">${domain}</div>
        <div class="item__text"><strong>Financement :</strong> ${text}</div>
        ${plaf ? `<div class="item__text"><strong>Plafonds/barèmes :</strong> ${plaf}</div>` : ""}
        ${dem ? `<div class="item__text"><strong>Démarches :</strong> ${dem}</div>` : ""}
        ${sourcesHtml}
      </div>
    `;
  }).join("");
}

function buildPlanSteps(st, topPacks, prf){
  const best = topPacks[0] || null;
  const steps = [];
  steps.push({title:"Dossier de base (10 minutes)", text:"Préparez : devis/programme/calendrier, coordonnées, CV/parcours."});
  if((st.statut==="de"||st.statut==="jeune") && prf.status!=="confirmed"){
    steps.push({title:"(Option Région) Vérifier PRF/SFER", text:`Vérifiez le financeur de la session dans le <a href="https://www.c2rp.fr/former-orienter/formations" target="_blank" rel="noopener">catalogue C2RP</a>, ligne "Dispositif financeur". Si doute : <a href="https://www.hautsdefrance.fr/prochinfo-formation/" target="_blank" rel="noopener">PRIF</a>.`});
  }
  if(best){
    if(best.id==="apprentissage"){
      steps.push({title:"Alternance : sécuriser employeur + contrat", text:"Sans employeur/contrat, l’alternance ne finance pas la formation. Faites valider le calendrier avec le CFA/OF."});
      steps.push({title:"Apprentissage : cadrer les aides annexes", text:"Demandez au CFA les pièces, le calendrier et les aides THR / équipement mobilisables selon votre situation."});
    }else if(best.id==="contratpro"){
      steps.push({title:"Contrat pro : sécuriser employeur + contrat", text:"Sans employeur/contrat, le contrat pro ne finance pas la formation. Faites valider le calendrier avec l’OF et l’entreprise."});
      steps.push({title:"Contrat pro : vérifier OPCO et aides employeur", text:"Confirmez l’OPCO compétent, le type de contrat visé et, après 26 ans, le cas d’ouverture ou les aides employeur mobilisables."});
    }else if(best.id==="prf"){
      steps.push({title:"PRF/SFER : sécuriser l’entrée", text:"Validez l’entrée avec le prescripteur et conservez une confirmation écrite (convocation/prescription)."});
      steps.push({title:"PRF/SFER : préciser la rémunération", text:"Faites confirmer l’AREF, la RFF, la RFFT ou l’autre rémunération de formation selon votre situation France Travail."});
    }else if(best.id==="cpf"){
      steps.push({title:"CPF : vérifier l’éligibilité de l’offre", text:"Confirmez le code RNCP/RS et la présence de l’offre sur Mon Compte Formation avant tout dépôt."});
      const cpfPlanText = (st.statut==="de" || st.statut==="jeune")
        ? "Déposez d’abord le CPF, puis traitez le complément éventuel dans le bon ordre : abondement France Travail, AIF ou Région selon la session."
        : (st.statut==="sal" || st.statut==="fp")
          ? "Déposez d’abord le CPF, puis voyez avec l’employeur, l’OPCO ou un PTP pour le complément éventuel."
          : (st.statut==="ind")
            ? "Déposez d’abord le CPF, puis vérifiez le complément FAF selon votre activité et les barèmes du fonds."
            : "Déposez d’abord le CPF, puis identifiez le bon financeur complémentaire selon votre situation.";
      steps.push({title:"CPF : traiter le complément si besoin", text: cpfPlanText});
    }else if(best.id==="ptp"){
      steps.push({title:"PTP : démarrer par le CEP", text:"Prenez un rendez-vous CEP pour cadrer le projet, le calendrier et la stratégie de financement."});
      steps.push({title:"PTP : déposer le dossier Transitions Pro", text:"Constituez un dossier complet dans les délais, avec devis, calendrier et pièces employeur si nécessaire."});
    }else if(best.id==="faf"){
      steps.push({title:"FAF : identifier le fonds compétent", text:"Repérez le FAF compétent selon votre activité et vérifiez les règles de prise en charge de l’année."});
      steps.push({title:"FAF : déposer avant l’entrée en formation", text:"Déposez tôt avec les justificatifs demandés ; le financement FAF se joue souvent sur le calendrier et les pièces."});
    }
  }
  if(st.needs.transport || st.needs.hebergement || st.needs.equipement) steps.push({title:"Frais annexes", text:"Préparez les justificatifs (transport/hébergement/équipement). Ces aides sont souvent conditionnelles."});
  if((st.statut==="de"||st.statut==="jeune") && (st.needs.transport || st.needs.hebergement)) steps.push({title:"Mobilité France Travail", text:"Si la formation génère un vrai surcoût de trajet ou d'hébergement, vérifiez vite l'aide à la mobilité et son délai de dépôt."});
  if(((best && (best.id==="apprentissage" || best.id==="contratpro")) || st.statut==="alt" || st.alternance==="oui") && st.needs.hebergement){
    const logementAlternanceText = (st.age === "<26" || st.age === "26-29" || !st.age)
      ? "Si un logement ou une double résidence est nécessaire, vérifiez Mobili-Jeune et l'avance Loca-Pass sur Action Logement."
      : "Si un logement ou une double résidence est nécessaire, vérifiez surtout l'avance Loca-Pass. Mobili-Jeune vise en principe les alternants de moins de 30 ans.";
    steps.push({title:"Logement alternance", text:logementAlternanceText});
  }
  if(((best && best.id==="apprentissage") || st.statut==="alt" || st.alternance==="oui") && (st.needs.transport || st.needs.hebergement || st.needs.equipement)) steps.push({title:"Apprentissage : THR / équipement", text:"Demandez au CFA si la Carte Génération #HDF est mobilisable pour le transport, l'hébergement, la restauration ou l'équipement."});
  if(st.handicap==="oui") steps.push({title:"Handicap (si pertinent)", text:"Selon statut : Cap emploi / Agefiph (privé) / FIPHFP (public). Aides possibles sur compensation/équipement/mobilité."});
  return steps;
}

let lastShareUrl = "";

function setUrlState(st){
  try{
    const payload = JSON.stringify({v:1, meta:META, st});
    const b64 = btoa(unescape(encodeURIComponent(payload)));
    // En file://, location.origin vaut "null" : on garde un lien relatif lisible.
    const base = (location.origin && location.origin !== "null") ? (location.origin + location.pathname) : ("./index.html");
    const url = `${base}#s=${b64}`;
    lastShareUrl = url;

    if($("shareLink")) $("shareLink").textContent = url;
    // QR gÃ©nÃ©rÃ© Ã  la demande (dans la modale de partage).
  }catch{}
}

function renderQr(url){
  const qrEl = $("qr");
  if(!qrEl) return;
  qrEl.innerHTML = "";
  if(!url){ qrEl.textContent = "QR indisponible"; return; }
  try{
    const qr = QRCode(url);
    const size = qr.getModuleCount();
    const scale = Math.max(2, Math.floor(170 / size));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#000000";
    for(let r=0;r<size;r++){
      for(let c=0;c<size;c++){
        if(qr.isDark(r,c)) ctx.fillRect(c*scale, r*scale, scale, scale);
      }
    }
    qrEl.appendChild(canvas);
  }catch{
    qrEl.textContent = "QR indisponible";
  }
}


function tryLoadFromUrl(){
  const h = location.hash || "";
  const m = h.match(/#s=([A-Za-z0-9+/=]+)/);
  if(!m) return false;
  try{
    const jsonStr = decodeURIComponent(escape(atob(m[1])));
    const obj = JSON.parse(jsonStr);
    if(obj && obj.st){
      state = {...defaultState(), ...obj.st};
      return true;
    }
  }catch{}
  return false;
}

function renderPlanAction(st, topPacks, prf){
  const steps = buildPlanSteps(st, topPacks, prf);
  return steps.map((step, index)=>`<div class="item"><div class="item__title">${index + 1}) ${step.title}</div><div class="item__text">${step.text}</div></div>`).join("");
}

function summaryText(st){
  const {packs, prf} = buildPacks(st);
  const top = packs.slice(0,3);
  const lines = [];
  lines.push("RELAIS - Hauts-de-France");
  lines.push("Repertoire des Eligibilites, Leviers, Aides et Informations sur les Solutions de financement");
  lines.push(`Mise \u00e0 jour : ${META.exported_on} (donn\u00e9es ${META.data_version})`);
  lines.push(`Profil : ${statutLabel(st.statut)} | \u00e2ge : ${st.age || "\u2014"} | handicap : ${st.handicap} | employeur : ${st.employeur} | alternance : ${st.alternance}`);
  lines.push(`Formation : ${formationLabel(st.formation)} | co\u00fbt : ${formatEUR(st.cost_peda||0)} | CPF : ${formatEUR(st.cpf_amount||0)} | PRF : ${prfLabel(prf.status)}`);
  lines.push("Top sc\u00e9narios :");
  top.forEach((pack, index)=>{
    const rr = resteTriplet(pack.id, st);
    lines.push(`${index+1}. ${pack.title} - reste \u00e0 charge min. : ${rr.min}`);
  });
  lines.push("NB : orientation non opposable. V\u00e9rifier via les sources.");
  return lines.join("\n");
}


function escapeHtml(s){
  return repairDisplayText(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function repairDisplayText(value){
  let text = String(value ?? "");
  if(!/[ÃÂâƒ]/.test(text)) return text;

  for(let i = 0; i < 3; i += 1){
    if(!/[ÃÂâƒ]/.test(text)) break;
    try{
      const repaired = decodeURIComponent(escape(text));
      if(!repaired || repaired === text) break;
      text = repaired;
    }catch{
      break;
    }
  }

  return text
    .replace(/Â(?=\s|€|$|[!?:;,.()\/-])/g, "")
    .replace(/â‚¬/g, "€")
    .replace(/\u00c3\u20ac/g, "À")
    .replace(/\u00c3\u2030/g, "É")
    .replace(/\u00c3\u02c6/g, "È")
    .replace(/\u00c3\u00a0/g, "à")
    .replace(/\u00c3\u00a2/g, "â")
    .replace(/\u00c3\u00a7/g, "ç")
    .replace(/\u00c3\u00a8/g, "è")
    .replace(/\u00c3\u00a9/g, "é")
    .replace(/\u00c3\u00aa/g, "ê")
    .replace(/\u00c3\u00ab/g, "ë")
    .replace(/\u00c3\u00ae/g, "î")
    .replace(/\u00c3\u00af/g, "ï")
    .replace(/\u00c3\u00b4/g, "ô")
    .replace(/\u00c3\u00b6/g, "ö")
    .replace(/\u00c3\u00b9/g, "ù")
    .replace(/\u00c3\u00bb/g, "û")
    .replace(/\u00c3\u00bc/g, "ü")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€¢/g, "•")
    .replace(/â€˜/g, "‘")
    .replace(/â€™/g, "’")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”");
}

function getDataField(entry, candidateKeys){
  const wanted = new Set((candidateKeys || []).map((key)=>repairDisplayText(key).toLowerCase()));
  for(const [rawKey, rawValue] of Object.entries(entry || {})){
    if(wanted.has(repairDisplayText(rawKey).toLowerCase())){
      return rawValue;
    }
  }
  return "";
}

function normalizeLoose(value){
  return repairDisplayText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCompact(value){
  return normalizeLoose(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferCartographyStatus(entry){
  const statusField = repairDisplayText(getDataField(entry, [
    "Statut (2026)",
    "Statut / actualités (2026)",
    "Statut / actualites (2026)"
  ])).replace(/\s*[.;:]+\s*$/u, "");
  const blob = normalizeLoose([
    statusField,
    getDataField(entry, ["Dispositif", "Dispositif (Hauts-de-France)"]),
    getDataField(entry, ["Ce qui est financé", "Objectif / ce que ça permet"]),
    getDataField(entry, ["Plafonds / barèmes"]),
    getDataField(entry, ["Démarches / interlocuteurs", "Démarches / points d’entrée"])
  ].join(" "));

  if([
    "non reconduit",
    "non mobilisable",
    "supprime",
    "supprimee",
    "non renouvele"
  ].some((needle)=> blob.includes(needle))){
    return {
      key: "inactive",
      label: "Non mobilisable 2026",
      detail: statusField || "Dispositif non mobilisable dans son cadre 2026."
    };
  }

  if([
    "a confirmer",
    "a surveiller",
    "a verifier",
    "verifier",
    "en evolution",
    "suspension"
  ].some((needle)=> blob.includes(needle))){
    return {
      key: "review",
      label: "Conditions \u00e0 v\u00e9rifier",
      detail: statusField || "Conditions d'acc\u00e8s, actualit\u00e9s ou bar\u00e8mes \u00e0 v\u00e9rifier avant mobilisation."
    };
  }

  return {
    key: "active",
    label: "Mobilisable 2026",
    detail: statusField || "Mobilisable en 2026 sous r\u00e9serve des conditions du dispositif."
  };
}

function inferCartographyPerimeter(entry){
  const blob = normalizeLoose([
    getDataField(entry, ["Dispositif", "Dispositif (Hauts-de-France)"]),
    getDataField(entry, ["Domaine", "Thématique"]),
    getDataField(entry, ["Financeur(s)", "Financeur"]),
    getDataField(entry, ["Point d’entrée / qui instruit", "Point d'entree / qui instruit"]),
    getDataField(entry, ["Statut (2026)", "Statut / actualités (2026)", "Statut / actualites (2026)"])
  ].join(" "));

  const hdfNeedles = [
    "hauts-de-france",
    "hdf",
    "proch'info",
    "proch’info",
    "proch'emploi",
    "proch’emploi",
    "prif",
    "sfer",
    "prf 2025",
    "generation #hdf",
    "carte generation",
    "cheque pass",
    "chèque pass",
    "pass formation",
    "pass emploi entreprise",
    "en route pour l'emploi",
    "en route pour l’emploi"
  ];

  if(hdfNeedles.some((needle)=> blob.includes(normalizeLoose(needle)))){
    return {
      key: "hdf",
      label: "Focus Hauts-de-France",
      badgeLabel: "Hauts-de-France"
    };
  }

  return {
    key: "socle",
    label: "Socle national / transversal",
    badgeLabel: "Socle national"
  };
}

function inferCartographyNeeds(entry){
  const blob = normalizeLoose([
    getDataField(entry, ["Dispositif", "Dispositif (Hauts-de-France)"]),
    getDataField(entry, ["Domaine", "Thématique"]),
    getDataField(entry, ["Ce qui est financé", "Objectif / ce que ça permet"]),
    getDataField(entry, ["Articulations possibles"])
  ].join(" "));
  const needs = [];

  if(/pedagog|formation|abondement|cpf|opco|faf|frais|cout|cofinancement|financ/.test(blob)) needs.push("payer");
  if(/remuner|allocation|aref|rff|rfft|salaire|indemni/.test(blob)) needs.push("vivre");
  if(/transport|hebergement|trajet|mobilite|deplacement|restauration|thr/.test(blob)) needs.push("bouger");
  if(/logement|loyer|double residence|loca-pass|mobili-jeune/.test(blob)) needs.push("logement");
  if(/orientation|accompagnement|cep|conseil|proch.?info|information|vae/.test(blob)) needs.push("accompagner");

  return [...new Set(needs)];
}

function inferCartographyFinanceurs(entry){
  const blob = normalizeLoose([
    getDataField(entry, ["Financeur(s)", "Financeur"]),
    getDataField(entry, ["Point d’entrée / qui instruit", "Point d'entree / qui instruit"]),
    getDataField(entry, ["Démarches / interlocuteurs", "Démarches / points d’entrée"]),
    getDataField(entry, ["Dispositif", "Dispositif (Hauts-de-France)"]),
    getDataField(entry, ["Domaine", "Thématique"])
  ].join(" "));
  const tags = [];

  if(/france travail|pole emploi|p[ôo]le emploi/.test(blob)) tags.push("ft");
  if(/region|hauts-de-france|hdf|conseil regional/.test(blob)) tags.push("region");
  if(/opco/.test(blob)) tags.push("opco");
  if(/employeur|entreprise/.test(blob)) tags.push("employeur");
  if(/cpf|caisse des depots|mon compte formation|cdc/.test(blob)) tags.push("cpf");
  if(/faf|fif pl|agefice|fafcea|vivea/.test(blob)) tags.push("faf");
  if(/action logement|mobili-jeune|loca-pass/.test(blob)) tags.push("actionlogement");
  if(/transitions pro|cep/.test(blob)) tags.push("transitionspro");
  if(!tags.length) tags.push("other");

  return [...new Set(tags)];
}

function cartographyFinanceurLabel(tag){
  const map = {
    ft: "France Travail",
    region: "R\u00e9gion HDF",
    opco: "OPCO",
    employeur: "Employeur",
    cpf: "CPF / CDC",
    faf: "FAF",
    actionlogement: "Action Logement",
    transitionspro: "Transitions Pro / CEP",
    other: "Autre"
  };
  return map[tag] || tag;
}

function cartographyNeedLabel(tag){
  const map = {
    payer: "Payer",
    vivre: "Vivre",
    bouger: "Bouger",
    logement: "Logement",
    accompagner: "Accompagner"
  };
  return map[tag] || tag;
}

function cartographyCanonicalKey(title, sigle=""){
  const raw = normalizeCompact(`${title} ${sigle}`);

  if(raw.includes("en route pour l emploi")) return "en-route-pour-emploi";
  if(raw.includes("prf 2025") && raw.includes("sfer")) return "prf-sfer-hdf";
  if(raw.includes("pass emploi entreprise") || raw.includes("paee")) return "pass-emploi-entreprise";
  if(raw.includes("proch info formation") || raw.includes("prif")) return "prochinfo-formation";
  if(raw.includes("proch emploi")) return "prochemploi";
  if(raw.includes("cheque pass formation sup") || raw.includes("chpf sup")) return "chpf-sup";
  if((raw.includes("cheque pass formation") || raw.includes("pass formation") || raw.includes("chpf")) && !raw.includes("sup")) return "chpf";
  if(raw.includes("carte generation hdf") || raw.includes("generation hdf")) return "generation-hdf";
  if(raw.includes("mobili jeune")) return "mobili-jeune";
  if(raw.includes("loca pass")) return "loca-pass";
  if(raw.includes("pass vae") || raw.includes("cheque pass vae")) return "pass-vae-hdf";

  return normalizeCompact(title);
}

function shouldHideCartographyEntry(title){
  const raw = normalizeCompact(title);
  if(raw === "programme regional de formation") return true;
  if(raw.includes("service public regional de la formation exemple")) return true;
  return false;
}

function describeCartographyFamily(key, members){
  const titles = [...new Set((members || []).map((member)=> member.title).filter(Boolean))];
  if(titles.length <= 1) return { badge: "", note: "", parts: [] };

  if(key === "generation-hdf"){
    return {
      badge: "Vue consolidée",
      note: "Cette carte regroupe les volets repérés de la Carte Génération #HDF : aide équipement et aides THR pour transport, hébergement et restauration.",
      parts: ["Équipement", "THR"]
    };
  }

  if(key === "chpf"){
    return {
      badge: "Vue consolidée",
      note: "Cette carte regroupe le même abondement CPF régional décrit avec deux libellés proches selon les sources.",
      parts: ["Abondement CPF"]
    };
  }

  if(key === "chpf-sup"){
    return {
      badge: "Vue consolidée",
      note: "Cette carte regroupe le même abondement CPF régional pour l'enseignement supérieur, avec deux formulations proches dans les sources.",
      parts: ["Abondement CPF", "Sup"]
    };
  }

  if(key === "prf-sfer-hdf"){
    return {
      badge: "Vue consolidée",
      note: "Cette carte regroupe le même levier PRF / SFER, présenté soit comme un dispositif global, soit comme des parcours détaillés.",
      parts: ["Découverte", "Qualifiant", "Perfectionnement"]
    };
  }

  return {
    badge: "Vue consolidée",
    note: "Cette carte regroupe plusieurs formulations proches d'un même levier pour éviter les doublons dans la cartographie.",
    parts: []
  };
}

function uniqList(values){
  return [...new Set((values || []).filter(Boolean))];
}

function mergeCartographyStatus(items){
  const rank = { active: 0, review: 1, inactive: 2 };
  return (items || []).reduce((worst, item)=>{
    if(!worst) return item.status;
    return (rank[item.status.key] || 0) > (rank[worst.key] || 0) ? item.status : worst;
  }, null) || { key: "review", label: "Conditions a verifier", detail: "Verifier l'actualite et les conditions d'acces avant mobilisation." };
}

function getCartographyFamilyOverrides(key){
  const overrides = {
    "generation-hdf": {
      title: "Carte G\u00e9n\u00e9ration #HDF (\u00e9quipement + aides THR)",
      sigle: "G\u00e9n\u00e9ration #HDF",
      domain: "Apprentissage (aides apprenti)",
      publics: "Apprentis, avec volets distincts selon la primo-entr\u00e9e, l'ann\u00e9e de formation et la validation par le CFA.",
      financeursText: "R\u00e9gion Hauts-de-France",
      objective: "Aides pour l'\u00e9quipement professionnel et pour les frais de transport, d'h\u00e9bergement et de restauration li\u00e9s \u00e0 l'apprentissage.",
      plafonds: "Rep\u00e8res : \u00e9quipement 200 \u20ac ; transport 200 \u20ac ; restauration 100 \u20ac ; h\u00e9bergement 80 \u20ac.",
      demarches: "Demande via l'espace G\u00e9n\u00e9ration #HDF ; validation par le CFA ou l'\u00e9tablissement selon le volet concern\u00e9."
    },
    "prf-sfer-hdf": {
      title: "PRF 2025 - SFER (d\u00e9couverte, qualifiant, perfectionnement)",
      sigle: "PRF/SFER (HDF)",
      domain: "R\u00e9gion Hauts-de-France (formation financ\u00e9e)",
      publics: "Demandeurs d'emploi, salari\u00e9s en contrat aid\u00e9, salari\u00e9s \u00e0 temps partiel inf\u00e9rieur \u00e0 24h/semaine, b\u00e9n\u00e9ficiaires de la Prestation partag\u00e9e d'\u00e9ducation de l'enfant (Pr\u00e9ParE) \u00e0 temps plein et priv\u00e9s d'emploi, personnels en uniforme en reconversion et sportifs de haut niveau HDF sans contrat.",
      objective: "Parcours r\u00e9gionaux financ\u00e9s pour d\u00e9couvrir un m\u00e9tier, se qualifier ou se perfectionner sans frais p\u00e9dagogiques pour l'usager.",
      demarches: "V\u00e9rifier la session dans le catalogue C2RP puis confirmer l'orientation avec France Travail, Mission locale, Cap Emploi, APEC ou le prescripteur concern\u00e9."
    },
    "chpf": {
      title: "Ch\u00e8que Pass Formation / Pass Formation (abondement CPF)",
      sigle: "CHPF",
      objective: "Abondement r\u00e9gional pour compl\u00e9ter un CPF insuffisant sur une formation \u00e9ligible, en compl\u00e9ment d'autres leviers si besoin.",
      demarches: "D\u00e9marrer sur Mon Compte Formation puis v\u00e9rifier le cadre r\u00e9gional Hauts-de-France avec France Travail, PRIF ou le guide des aides."
    },
    "chpf-sup": {
      title: "Ch\u00e8que Pass Formation Sup (abondement CPF cibl\u00e9)",
      sigle: "CHPF Sup",
      objective: "Abondement r\u00e9gional du CPF sur certaines formations cibl\u00e9es de niveau sup\u00e9rieur.",
      demarches: "V\u00e9rifier d'abord que la formation figure bien sur les listes r\u00e9gionales puis d\u00e9poser le projet via Mon Compte Formation avec appui si besoin."
    },
    "pass-emploi-entreprise": {
      title: "Pass Emploi Entreprise (formation avant recrutement)",
      sigle: "PAEE",
      objective: "Formation sur mesure avant embauche, construite avec l'entreprise quand un recrutement est identifi\u00e9.",
      demarches: "Montage avec l'entreprise et les relais r\u00e9gionaux, souvent via Proch'Emploi ou les op\u00e9rateurs partenaires."
    },
    "mobili-jeune": {
      title: "Mobili-Jeune (aide au loyer en alternance)",
      sigle: "Mobili-Jeune",
      financeursText: "Action Logement",
      objective: "Aide mensuelle pour r\u00e9duire le reste \u00e0 payer sur le loyer ou la redevance pendant l'alternance.",
      plafonds: "Rep\u00e8re : jusqu'\u00e0 100 \u20ac par mois selon les r\u00e8gles Action Logement en vigueur.",
      demarches: "Demande en ligne sur Action Logement avec contrat d'alternance et justificatifs de logement."
    },
    "loca-pass": {
      title: "Avance Loca-Pass (d\u00e9p\u00f4t de garantie)",
      sigle: "Loca-Pass",
      financeursText: "Action Logement",
      objective: "Avance pour financer le d\u00e9p\u00f4t de garantie \u00e0 l'entr\u00e9e dans le logement.",
      plafonds: "Avance remboursable dans la limite du plafond Action Logement en vigueur.",
      demarches: "Demande en ligne sur Action Logement avant ou peu apr\u00e8s l'entr\u00e9e dans le logement."
    },
    "pass-vae-hdf": {
      title: "Aides VAE r\u00e9gionales 2025 (Ch\u00e8que Pass VAE) - non reconduites en 2026",
      objective: "Point de vigilance : ce levier r\u00e9gional n'est plus mobilisable en 2026 ; il faut orienter vers les solutions nationales encore en vigueur.",
      plafonds: "A compter du 01/01/2026 : non mobilisable en Hauts-de-France.",
      demarches: "Ne pas d\u00e9poser sur ce dispositif en 2026 ; v\u00e9rifier plut\u00f4t CPF VAE, CEP et les dispositifs nationaux actifs.",
      status: { key: "inactive", label: "Non mobilisable 2026", detail: "Le Ch\u00e8que Pass VAE r\u00e9gional n'est pas reconduit en 2026" }
    },
    "prochinfo-formation": {
      title: "Proch'Info-Formation (orientation de proximit\u00e9)",
      sigle: "PRIF",
      objective: "Point d'entr\u00e9e pour s'orienter, identifier les bons interlocuteurs et v\u00e9rifier les solutions formation dans les Hauts-de-France."
    },
    "prochemploi": {
      title: "Proch'Emploi (appui emploi / recrutement)",
      objective: "Service de mise en relation et d'appui au recrutement, utile pour transformer un projet en opportunit\u00e9 d'emploi ou d'alternance."
    }
  };

  return overrides[key] || null;
}

function scoreCartographyEntry(entry){
  return [
    "Domaine",
    "Thématique",
    "Publics éligibles",
    "Public visé / profils",
    "Financeur(s)",
    "Point d’entrée / qui instruit",
    "Ce qui est financé",
    "Objectif / ce que ça permet",
    "Plafonds / barèmes",
    "Démarches / interlocuteurs",
    "Démarches / points d’entrée",
    "Statut (2026)",
    "Statut / actualités (2026)"
  ].reduce((score, key)=>{
    const value = repairDisplayText(getDataField(entry, [key]));
    return score + (value ? 1 : 0);
  }, 0);
}

function buildCartographyEntries(){
  const groups = [
    { source: "socle", entries: Array.isArray(DISPOSITIFS_DATA.catalogue) ? DISPOSITIFS_DATA.catalogue : [] },
    { source: "hdf", entries: Array.isArray(DISPOSITIFS_DATA.region_hdf) ? DISPOSITIFS_DATA.region_hdf : [] }
  ];
  const byTitle = new Map();

  groups.forEach(({ source, entries })=>{
    entries.forEach((entry)=>{
      const title = repairDisplayText(getDataField(entry, ["Dispositif", "Dispositif (Hauts-de-France)"]) || "");
      if(!title) return;
      if(shouldHideCartographyEntry(title)) return;
      const sigle = repairDisplayText(getDataField(entry, ["Sigle"]));
      const key = cartographyCanonicalKey(title, sigle);
      const candidate = {
        key,
        source,
        title,
        sigle,
        domain: repairDisplayText(getDataField(entry, ["Domaine", "Thématique"])),
        publics: repairDisplayText(getDataField(entry, ["Publics éligibles", "Public visé / profils"])),
        financeursText: repairDisplayText(getDataField(entry, ["Financeur(s)", "Financeur", "Porteur / financeur", "Point d’entrée / qui instruit"])),
        objective: repairDisplayText(getDataField(entry, ["Ce qui est financé", "Objectif / ce que ça permet"])),
        plafonds: repairDisplayText(getDataField(entry, ["Plafonds / barèmes"])),
        demarches: repairDisplayText(getDataField(entry, ["Démarches / interlocuteurs", "Démarches / points d’entrée"])),
        sources: getDataField(entry, ["Sources (URL)"]) || []
      };
      candidate.status = inferCartographyStatus(entry);
      candidate.needs = inferCartographyNeeds(entry);
      candidate.financeurTags = inferCartographyFinanceurs(entry);
      candidate.perimeter = inferCartographyPerimeter(entry);
      candidate.scopeLabel = candidate.perimeter.badgeLabel;
      candidate._members = [{ source, title, sigle }];
      candidate.searchBlob = normalizeLoose([
        candidate.title,
        candidate.sigle,
        candidate.domain,
        candidate.publics,
        candidate.financeursText,
        candidate.objective,
        candidate.plafonds,
        candidate.demarches,
        candidate.scopeLabel,
        candidate.perimeter.label
      ].join(" "));
      candidate._score = scoreCartographyEntry(entry) + (source === "hdf" ? 0.25 : 0);

      if(!byTitle.has(key)) byTitle.set(key, []);
      byTitle.get(key).push(candidate);
    });
  });

  return Array.from(byTitle.values()).map((items)=>{
    const selected = items.reduce((best, item)=> (!best || item._score > best._score ? item : best), null);
    const merged = {
      ...selected,
      sources: uniqList(items.flatMap((item)=> item.sources || [])),
      needs: uniqList(items.flatMap((item)=> item.needs || [])),
      financeurTags: uniqList(items.flatMap((item)=> item.financeurTags || [])),
      status: mergeCartographyStatus(items),
      _members: items.flatMap((item)=> item._members || [])
    };
    const family = describeCartographyFamily(merged.key, merged._members || []);
    const override = getCartographyFamilyOverrides(merged.key);

    if(override){
      Object.assign(merged, override);
    }

    merged.familyBadge = family.badge;
    merged.familyNote = family.note;
    merged.familyParts = family.parts;
    merged.usageLabel = cartographyUsageLabel(merged);
    merged.searchBlob = normalizeLoose([
      merged.title,
      merged.sigle,
      merged.domain,
      merged.publics,
      merged.financeursText,
      merged.objective,
      merged.plafonds,
      merged.demarches,
      merged.scopeLabel,
      merged.usageLabel,
      merged.perimeter.label,
      ...(merged.familyParts || []),
      ...((merged._members || []).map((member)=> member.title))
    ].join(" "));

    return merged;
  }).sort((a, b)=>{
    const statusRank = { active: 0, review: 1, inactive: 2 };
    const diff = (statusRank[a.status.key] || 9) - (statusRank[b.status.key] || 9);
    if(diff !== 0) return diff;
    const scopeDiff = a.perimeter.key.localeCompare(b.perimeter.key);
    if(scopeDiff !== 0) return scopeDiff;
    return a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
  });
}

function renderCartography(){
  if(!cartographyEntries) cartographyEntries = buildCartographyEntries();
  const q = normalizeLoose($("mapSearch")?.value || "");
  const status = $("mapStatus")?.value || "all";
  const perimeter = $("mapPerimeter")?.value || "all";
  const financeur = $("mapFinanceur")?.value || "all";
  const need = $("mapNeed")?.value || "all";

  const filtered = cartographyEntries.filter((entry)=>{
    if(q && !entry.searchBlob.includes(q)) return false;
    if(status !== "all" && entry.status.key !== status) return false;
    if(perimeter !== "all" && entry.perimeter.key !== perimeter) return false;
    if(financeur !== "all" && !entry.financeurTags.includes(financeur)) return false;
    if(need !== "all" && !entry.needs.includes(need)) return false;
    return true;
  });

  if($("mapCount")) $("mapCount").textContent = String(filtered.length);

  $("mapCards").innerHTML = filtered.length
    ? filtered.map((entry)=>{
        const financeurHtml = entry.financeurTags.slice(0, 3).map((tag)=>`<span class="map-chip">${escapeHtml(cartographyFinanceurLabel(tag))}</span>`).join("");
        const needHtml = entry.needs.length
          ? entry.needs.map((tag)=>`<span class="map-chip map-chip--soft">${escapeHtml(cartographyNeedLabel(tag))}</span>`).join("")
          : `<span class="map-chip map-chip--soft">A pr\u00e9ciser</span>`;
        const usageHtml = entry.usageLabel ? `<span class="map-chip map-chip--family">${escapeHtml(entry.usageLabel)}</span>` : "";
        const sourcesHtml = Array.isArray(entry.sources) && entry.sources.length
          ? `<ul class="item__sources">${entry.sources.slice(0, 3).map((url, index)=>`<li><a href="${url}" target="_blank" rel="noopener">Source ${index + 1}</a></li>`).join("")}</ul>`
          : "";
        const sigleHtml = entry.sigle ? `<span class="map-card__sigle">${escapeHtml(entry.sigle)}</span>` : "";
        const familyPartsHtml = Array.isArray(entry.familyParts) && entry.familyParts.length
          ? entry.familyParts.map((part)=>`<span class="map-chip map-chip--family">${escapeHtml(part)}</span>`).join("")
          : "";
        const publicsHtml = entry.publics ? `<div class="map-card__text"><strong>Public :</strong> ${escapeHtml(entry.publics)}</div>` : "";
        const financeursTextHtml = entry.financeursText ? `<div class="map-card__text"><strong>Financeur / instructeur :</strong> ${escapeHtml(entry.financeursText)}</div>` : "";
        const objectiveHtml = entry.objective ? `<div class="map-card__text"><strong>Ce que cela couvre :</strong> ${escapeHtml(entry.objective)}</div>` : "";
        const plafondsHtml = entry.plafonds ? `<div class="map-card__text"><strong>Plafonds / bar\u00e8mes :</strong> ${escapeHtml(entry.plafonds)}</div>` : "";
        const demarchesHtml = entry.demarches ? `<div class="map-card__text"><strong>D\u00e9marches :</strong> ${escapeHtml(entry.demarches)}</div>` : "";
        return `
          <article class="map-card map-card--${entry.status.key}">
            <div class="map-card__head">
              <div>
                <div class="map-card__title">${escapeHtml(entry.title)}${sigleHtml}</div>
                <div class="map-card__meta">${escapeHtml(entry.domain || entry.scopeLabel)}</div>
              </div>
              <div class="map-card__badges">
                <span class="map-pill map-pill--${entry.status.key}">${escapeHtml(entry.status.label)}</span>
                <span class="map-pill map-pill--scope">${escapeHtml(entry.scopeLabel)}</span>
              </div>
            </div>

            <div class="map-card__status">${escapeHtml(entry.status.detail)}</div>
            <div class="map-card__chips">${usageHtml}${financeurHtml}${needHtml}${familyPartsHtml}</div>
            ${publicsHtml}
            ${financeursTextHtml}
            ${objectiveHtml}
            ${plafondsHtml}
            ${demarchesHtml}
            ${sourcesHtml}
          </article>
        `;
      }).join("")
    : `<div class="app-block app-block--alt"><h3 class="fr-h5">Aucun dispositif ne correspond aux filtres</h3><p class="fr-text--sm fr-mb-0">Essayez d'enlever un filtre ou de simplifier la recherche.</p></div>`;
}

// IcÃ´nes par scÃ©nario (Remix Icons)
function packIcon(id){
  const map = {
    apprentissage: 'ri-briefcase-3-line',
    contratpro: 'ri-briefcase-line',
    prf: 'ri-map-pin-2-line',
    cpf: 'ri-bank-card-line',
    ptp: 'ri-route-line',
    faf: 'ri-store-2-line'
  };
  const cls = map[id] || 'ri-file-list-3-line';
  return `<i class="ri ${cls}" aria-hidden="true"></i>`;
}

// Remplace les symboles "âœ“ / â— / â€”" par des pictos (cohÃ©rent avec la lÃ©gende)
function covIconHTML(raw){
  const v0 = String((raw ?? 'â€”')).trim();
  const parse = (v)=>{
    // v = "âœ“ (salaire)" / "â— (selon cas)" / "â€”"
    const main = v.length ? v[0] : "â€”";
    let rest = v.slice(1).trim();
    if(rest.startsWith("(") && rest.endsWith(")")) rest = rest.slice(1,-1).trim();
    rest = rest.replace(/^[-â€“â€”]\s*/,"").trim();

    // Normalise quelques qualificatifs pour une esthÃ©tique homogÃ¨ne
    const r = rest.toLowerCase();
    let tag = "";
    if(!rest) tag = "";
    else if(r.includes("selon cas")) tag = "Selon cas";
    else if(r.includes("salaire")) tag = "Salaire";
    else if(r.includes("aref") || r.includes("rfft")) tag = "AREF/RFFT";
    else if(r.includes("cep") || r.includes("prif")) tag = "CEP/PRIF";
    else tag = rest.length > 18 ? (rest.slice(0,18) + "â€¦") : rest;

    return {main, tag, rawRest: rest};
  };

  const mk = (kind, icon, label, tag) => {
    const t = tag ? `<span class="covtag" title="${escapeHtml(tag)}">${escapeHtml(tag)}</span>` : '';
    return `<span class="covcell"><span class="sym ${kind}" title="${label}" aria-hidden="true"><i class="ri ${icon}"></i></span>${t}</span>`;
  };

  const {main, tag} = parse(v0);
  if(main === 'âœ“') return mk('sym--yes','ri-check-line','PrÃ©vu / trÃ¨s probable', tag);
  if(main === 'â—') return mk('sym--maybe','ri-time-line','Possible sous conditions', tag);
  if(main === 'â€”' || main === '-') return mk('sym--no','ri-subtract-line','Non prÃ©vu / non applicable', tag);
  return `<span class="covtag">${escapeHtml(v0)}</span>`;
}

function missingDetails(text){
  const t = normalize(text);
  // defaults
  let tagline = "Ã‰tape clÃ© du parcours";
  let how = ["RÃ©cupÃ©rer les informations manquantes (devis, dates, conditions)."];
  let who = ['Organisme de formation / CFA'];

  if(t.includes("employeur")){
    tagline = "Sans employeur, lâ€™alternance ne finance pas la formation.";
    how = [
      "Lister 10â€“15 structures proches (clubs, collectivitÃ©s, associations, entreprises).",
      "Cibler une pÃ©riode et un rythme (ex : 2 jours centre / 3 jours structure).",
      "Demander Ã  lâ€™OF/CFA un modÃ¨le dâ€™offre/fiche poste et les contacts OPCO utiles."
    ];
    who = ["Organisme / CFA", "Employeurs (clubs, collectivitÃ©s, associations)", "Mission locale / France Travail (appui recrutement)"];
  } else if(t.includes("Ã©ligibilitÃ© cpf") || t.includes("eligibilite cpf") || t.includes("mon compte formation")){
    tagline = "Le CPF nâ€™est mobilisable que si lâ€™action est bien Ã©ligible.";
    how = [
      "Demander Ã  lâ€™OF le lien Mon Compte Formation (ou un code RNCP/RS).",
      "VÃ©rifier sur la fiche que la session correspond (dates/lieu) et que le prix est cohÃ©rent.",
      "Si lâ€™action est RS/bilan/permis : vÃ©rifier le plafond applicable."
    ];
    who = ['Organisme de formation', 'Mon Compte Formation (fiche action)'];
  } else if(t.includes("france travail")){
    tagline = "Un complÃ©ment peut exister, mais il dÃ©pend dâ€™une instruction.";
    how = [
      "Prendre contact avec votre conseiller (ou accueil) en amont.",
      "PrÃ©parer un argumentaire court : projet mÃ©tier + dÃ©bouchÃ©s + dates + devis.",
      "Demander explicitement la possibilitÃ© dâ€™un co-financement/abondement."
    ];
    who = ["France Travail", 'PRIF (si besoin dâ€™orientation)'];
  } else if(t.includes("chÃ¨que") || t.includes("abondement rÃ©gion") || t.includes("rÃ©gion")){
    tagline = "Les aides rÃ©gionales sont conditionnelles (public, sessions, critÃ¨res).";
    how = [
      "VÃ©rifier les dispositifs rÃ©gionaux mobilisables (Ã¢ge, statut, type de formation).",
      "Conserver les justificatifs (domicile, statut, devis)."
    ];
    who = ['RÃ©gion Hauts-de-France (points dâ€™entrÃ©e)', '<a href="https://www.hautsdefrance.fr/prochinfo-formation/" target="_blank" rel="noopener">PRIF</a>'];
  } else if(t.includes("prf") || t.includes("sfer") || t.includes("c2rp")){
    tagline = "PRF/SFER : ne pas supposer â€” il faut confirmer la session.";
    how = [
      "Chercher la session dans le catalogue C2RP.",
      "RepÃ©rer la ligne â€œDispositif financeurâ€ (SFER / Conseil rÃ©gional HDF).",
      "En cas de doute : demander confirmation Ã  un prescripteur."
    ];
    who = ['<a href="https://www.c2rp.fr/former-orienter/formations" target="_blank" rel="noopener">Catalogue C2RP</a>', '<a href="https://www.hautsdefrance.fr/prochinfo-formation/" target="_blank" rel="noopener">PRIF</a>', "France Travail / Cap emploi"];
  } else if(t.includes("cep") || t.includes("ptp") || t.includes("transitions pro")){
    tagline = "PTP : le dossier est dÃ©cisionnel â€” il faut anticiper.";
    how = [
      "Prendre un RDV CEP (clarifier projet et cohÃ©rence).",
      "Rassembler les piÃ¨ces (devis, calendrier, argumentaire).",
      "DÃ©poser dans les dÃ©lais Transitions Pro."
    ];
    who = ["CEP", "Transitions Pro", "Employeur/RH"];
  } else if(t.includes("faf")){
    tagline = "Les FAF ont des barÃ¨mes annuels et des rÃ¨gles de dÃ©pÃ´t.";
    how = [
      "Identifier le FAF compÃ©tent selon votre activitÃ©.",
      "VÃ©rifier barÃ¨mes et piÃ¨ces avant lâ€™entrÃ©e en formation.",
      "DÃ©poser la demande dans les dÃ©lais."
    ];
    who = ["FAF compÃ©tent (FIFPL/AGEFICE/FAFCEAâ€¦)", "Organisme de formation"];
  }

  return {tagline, how, who};
}

function renderPacks(st){
  const {packs, prf} = buildPacks(st);
  const top = packs.slice(0,3);

  $("planAction").innerHTML = renderPlanAction(st, top, prf);

  const resultsView = ui.renderResultsOverview({
    top,
    st,
    prf,
    coverageForPack,
    resteTriplet,
    missingToImprove,
    formatEUR,
    sourcePills,
    renderSourceList,
    dispo,
    normalize,
    statutLabel,
    formationLabel,
    prfLabel,
    whoReceivesHTML
  });

  if(resultsView.summary && $("summaryBest")){
    $("summaryBest").textContent = resultsView.summary.bestTitle;
    if($("summaryConfidence")){
      $("summaryConfidence").textContent = resultsView.summary.confidenceLabel || "Confiance moyenne";
      $("summaryConfidence").className = `summary-pill${resultsView.summary.confidenceClassName || ""}`;
    }
    $("summaryMin").textContent = resultsView.summary.minText;
    $("summaryRange").textContent = resultsView.summary.rangeText;
    $("summaryWhy").textContent = resultsView.summary.whyText;
    if($("summaryEligibility")) $("summaryEligibility").textContent = resultsView.summary.eligibilityText || "\u2014";
    if($("summaryEligibilityDetails")) $("summaryEligibilityDetails").innerHTML = resultsView.summary.eligibilityDetailsHtml || "";
    if($("summaryCompare")) $("summaryCompare").innerHTML = resultsView.summary.compareHtml || "";
    $("summarySubtitle").textContent = resultsView.summary.subtitle;
    $("summaryActions").innerHTML = resultsView.summary.actionsHtml;
    if($("whoContent")) $("whoContent").innerHTML = resultsView.summary.whoHtml;
  }

  $("packs").innerHTML = resultsView.cardsHtml;
  syncTipTriggers($("packs"));

  document.querySelectorAll(".misscard").forEach(card=>{
    const open = ()=>{
      const key = card.getAttribute("data-miss") || "";
      const det = ui.getMissingDetails(key, normalize);
      openMissingDialog(key, det);
    };
    card.addEventListener("click", open);
    card.addEventListener("keypress", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        open();
      }
    });
    card.setAttribute("tabindex","0");
    card.setAttribute("role","button");
  });

  const otherDispositifs = filterOtherDispositifs(st);
  const otherDisplay = otherDispositifs.filter((entry)=> !isRegionalEntryPoint(entry));
  const categorizedDispositifs = categorizeDispositifs(otherDisplay, st, viewMode);
  renderTabPanels(categorizedDispositifs);
  const costVigilance = buildCostVigilanceItems(top, st);
  if($("costVigilance")) $("costVigilance").innerHTML = renderCostVigilanceItems(costVigilance);
  if($("costVigilanceBlock")) $("costVigilanceBlock").classList.toggle("hidden", !costVigilance.length);
  const regionDisplay = regionHdf.filter((entry)=> isRegionalEntryPoint(entry));
  $("regionHdf").innerHTML = renderListItems(regionDisplay);

  $("otherBlocks").classList.toggle("hidden", kiosk);
  setUrlState(st);
  return;
}


/* ---------- Missing dialog ---------- */
function openMissingDialog(title, det){
  const dlg = $("missingDialog");
  if(!dlg) return;

  const t = $("missingTitle");
  const b = $("missingBody");
  if(t) t.textContent = title || "â€”";

  if(b){
    const how = (det && det.how) ? det.how : [];
    const who = (det && det.who) ? det.who : [];
    const tagline = (det && det.tagline) ? det.tagline : "";

    let html = "";
    if(tagline){
      html += "<div style=\"font-weight:900; margin-top:0; margin-bottom:.35rem;\">Pourquoi c'est important</div>";
      html += "<p style=\"margin-top:0; color:var(--text-mention-grey); font-weight:700;\">" + escapeHtml(tagline) + "</p>";
    }
    html += "<div class=\"sep\"></div>";
    html += "<div style=\"font-weight:900; margin-bottom:.35rem;\">Que faire maintenant</div>";
    html += "<ul>" + how.map(x=>"<li>" + escapeHtml(x) + "</li>").join("") + "</ul>";
    html += "<div class=\"sep\"></div>";
    html += "<div style=\"font-weight:900; margin-bottom:.35rem;\">Qui contacter</div>";
    html += "<ul>" + who.map(x=>"<li>" + x + "</li>").join("") + "</ul>";

    b.innerHTML = html;
  }

  try{
    if(typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open","open");
  }catch{
    dlg.setAttribute("open","open");
  }
}

(function initMissingDialog(){
  const dlg = $("missingDialog");
  if(!dlg) return;
  dlg.addEventListener("click", (e)=>{
    if(e.target === dlg){
      try{ dlg.close(); }catch{ dlg.removeAttribute("open"); }
    }
  });
})();

/* ---------- Express wizard ---------- */

const wizard = ui.createWizardController({
  $,
  getState: ()=> state,
  onComplete: (currentState)=>{
    showScreen("screenResults");
    renderPacks(currentState);
  },
  notify: (message)=> alert(message)
});

function renderWizard(){
  wizard.render();
}

function nextWizard(){
  wizard.next();
}
function prevWizard(){ wizard.prev(); }

/* Share modal */
function openShare(){
  // Assure que le lien est a jour, puis genere le QR a la demande.
  if(!lastShareUrl) setUrlState(state);
  renderQr(lastShareUrl);
  $("shareModal").classList.add("modal--open");
  $("shareModal").setAttribute("aria-hidden","false");
}
function closeShare(){ $("shareModal").classList.remove("modal--open"); $("shareModal").setAttribute("aria-hidden","true"); }

function hydrateFromStateToDetailedForm(){
  $("d_statut").value = state.statut || "";
  $("d_age").value = state.age === "36+" ? "36-44" : (state.age || "");
  $("d_apprentissage_exception").value = state.apprentissage_exception || "unknown";
  document.querySelector(`input[name="d_handicap"][value="${state.handicap}"]`).checked = true;
  document.querySelector(`input[name="d_employeur"][value="${state.employeur}"]`).checked = true;
  document.querySelector(`input[name="d_alternance"][value="${state.alternance}"]`).checked = true;
  $("d_target_contract").value = state.target_contract || "unknown";
  $("d_contratpro_case").value = state.contratpro_case || "unknown";
  $("d_ptp_seniority").value = state.ptp_seniority || "unknown";
  $("d_formation").value = state.formation || "";
  $("d_cout").value = state.cost_peda || "";
  $("d_cpf").value = state.cpf_amount || "";
  
  $("d_cpf_action").value = state.cpf_action || "unknown";$("d_prf").value = state.prf_simple || "nspp";
  $("d_allocation_ft").value = state.allocation_ft || "unknown";
  $("d_annexesTransport").checked = !!state.needs.transport;
  $("d_annexesHebergement").checked = !!state.needs.hebergement;
  $("d_annexesEquipement").checked = !!state.needs.equipement;
  syncDetailPickers();
}

const tips = ui.createTipModal({ $, getContent: ui.getTipContent });

function syncTipTriggers(root=document){
  tips.sync(root);
}

function openTip(kind){
  tips.open(kind);
}

function closeTip(){
  tips.close();
}

initDetailPickers();

function initTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(btn.disabled) return;
      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach(b=> b.classList.toggle("tab--active", b===btn));
      ["payer","vivre","bouger","tout"].forEach(k=>{
        const el = $("tab_"+k);
        if(el) el.classList.toggle("hidden", k !== tab);
      });
    });
  });
}

/* Bindings */
$("modeExpress").addEventListener("click", ()=>{ mode="express"; setPillActive("modeExpress","modeDetailed"); });
$("modeDetailed").addEventListener("click", ()=>{ mode="detailed"; setPillActive("modeDetailed","modeExpress"); });

$("toggleKiosk").addEventListener("click", ()=> setKiosk(!kiosk));
$("toggleAutoReset").addEventListener("click", ()=> setAutoReset(!autoReset));
function openPrintView(){
  const st = {...state};
  const {packs, prf} = buildPacks(st);
  const top = packs.slice(0,3);
  const best = top[0] || null;

  const subtitle = `Mise \u00e0 jour : ${META.exported_on} (donn\u00e9es ${META.data_version})`;
  const profile = `Profil : ${statutLabel(st.statut)} • \u00c2ge : ${st.age || "—"} • Formation : ${formationLabel(st.formation)}`;
  const financial = `Co\u00fbt p\u00e9dagogique : ${formatEUR(st.cost_peda||0)} • CPF : ${formatEUR(st.cpf_amount||0)} • PRF : ${prfLabel(prf.status)}`;

  const topHtml = top.map((pack)=>{
    const reste = resteTriplet(pack.id, st);
    return `<li><strong>${escapeHtml(pack.title)}</strong> - reste \u00e0 charge minimum : <strong>${escapeHtml(reste.min)}</strong></li>`;
  }).join("");

  const planHtml = renderPlanAction(st, top, prf);
  const missing = best ? missingToImprove(best.id, st, prf) : [];
  const missingHtml = missing.length ? missing.map((item)=>`<li>${escapeHtml(item)}</li>`).join("") : "<li>—</li>";

  const sources = [];
  if(best){
    for(const name of (best.dispositifNames || [])){
      const item = dispo(name);
      if(!item) continue;
      const urls = item["Sources (URL)"] || [];
      if(urls.length) sources.push({name, url: urls[0]});
    }
  }
  const sourcesHtml = sources.length
    ? sources.map((entry)=>`<li><a href="${entry.url}">${escapeHtml(entry.name)}</a><span class="url"> - ${escapeHtml(entry.url)}</span></li>`).join("")
    : "<li>—</li>";

  const bestBlock = best ? (()=> {
    const reste = resteTriplet(best.id, st);
    return `
      <div class="card">
        <div class="k">Sc\u00e9nario recommand\u00e9</div>
        <div class="h">${escapeHtml(best.title)}</div>
        <div class="grid">
          <div class="mini"><div class="k2">Minimum</div><div class="v2">${escapeHtml(reste.min)}</div></div>
          <div class="mini"><div class="k2">Fourchette</div><div class="v2">${escapeHtml(reste.probable)}</div></div>
          <div class="mini"><div class="k2">Optimiste</div><div class="v2">${escapeHtml(reste.opt)}</div></div>
        </div>
        <div class="note">${escapeHtml(reste.hint || "")}</div>
      </div>
    `;
  })() : "";

  const css = `
    @font-face{font-family:'Marianne';src:url('assets/vendor/dsfr/fonts/Marianne-Regular.woff2') format('woff2'),url('assets/vendor/dsfr/fonts/Marianne-Regular.woff') format('woff');font-weight:400;font-style:normal;}
    @font-face{font-family:'Marianne';src:url('assets/vendor/dsfr/fonts/Marianne-Bold.woff2') format('woff2'),url('assets/vendor/dsfr/fonts/Marianne-Bold.woff') format('woff');font-weight:700;font-style:normal;}
    :root{--brand:#0F766E;--muted:#555;--border:#dedede;--bg:#fff;--accent:#7C3AED;}
    html,body{margin:0;padding:0;background:var(--bg);color:#111;font-family:Marianne,Arial,sans-serif;}
    body{padding:28px;}
    h1{font-size:18pt;margin:0 0 4px 0;}
    .sub{color:var(--muted);font-size:10.5pt;margin:0 0 10px 0;}
    .meta{color:var(--muted);font-size:10.5pt;margin:2px 0;}
    .hr{height:1px;background:var(--border);margin:14px 0;}
    .card{border:1px solid var(--border);border-radius:14px;padding:14px;margin-top:10px;}
    .k{color:var(--muted);font-weight:700;font-size:10pt;text-transform:uppercase;letter-spacing:.02em;}
    .h{font-weight:800;font-size:13pt;margin-top:2px;}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px;}
    .mini{border:1px solid var(--border);border-radius:12px;padding:10px;}
    .k2{color:var(--muted);font-weight:700;font-size:10pt;}
    .v2{font-weight:800;font-size:12.5pt;margin-top:2px;}
    .note{color:var(--muted);font-size:10.5pt;margin-top:8px;}
    h2{font-size:12.5pt;margin:18px 0 8px 0;}
    ul{margin:6px 0 0 18px;}
    li{margin:4px 0;}
    a{color:var(--brand);text-decoration:none;font-weight:700;}
    .url{color:var(--muted);font-size:9.5pt;word-break:break-all;}
    .cols{display:grid;grid-template-columns:1.2fr .8fr;gap:12px;}
    .small{font-size:10.5pt;color:var(--muted);}
    .plan .item{border:1px solid var(--border);border-radius:12px;padding:10px;margin:8px 0;}
    .plan .item__title{font-weight:800;}
    .plan .item__text{margin-top:6px;color:#222;}
    @media print{body{padding:16mm;} .url{display:none;} }
  `;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml("RELAIS - PDF")}</title><style>${css}</style></head><body>
    <h1>RELAIS - Synth\u00e8se usager</h1>
    <p class="sub">${escapeHtml("R\u00e9pertoire des \u00c9ligibilit\u00e9s, Leviers, Aides et Informations sur les Solutions de financement")}</p>
    <p class="sub">${escapeHtml(subtitle)}</p>
    <p class="meta">${escapeHtml(profile)}</p>
    <p class="meta">${escapeHtml(financial)}</p>
    ${bestBlock}

    <div class="hr"></div>

    <div class="cols">
      <div>
        <h2>Top 3 sc\u00e9narios</h2>
        <ul>${topHtml || "<li>—</li>"}</ul>

        <h2>Plan d'action</h2>
        <div class="plan">${planHtml || ""}</div>
      </div>
      <div>
        <h2>Ce qu'il manque (prioritaire)</h2>
        <ul>${missingHtml}</ul>

        <h2>Sources (\u00e0 v\u00e9rifier)</h2>
        <ul>${sourcesHtml}</ul>

        <p class="small">NB : document d'orientation (non opposable). Les d\u00e9cisions rel\u00e8vent des organismes instructeurs.</p>
      </div>
    </div>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden","true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(()=>{
    try{ iframe.contentWindow.focus(); iframe.contentWindow.print(); }catch(e){}
    setTimeout(()=>{ try{ iframe.remove(); }catch(e){} }, 800);
  }, 350);
}

function handleFooterPrint(){
  const onResults = $("screenResults") && !$("screenResults").classList.contains("hidden");
  if(onResults){
    openPrintView();
    return;
  }
  window.print();
}

window.openPrintView = openPrintView;
window.handleFooterPrint = handleFooterPrint;

$("btnStart").addEventListener("click", ()=>{
  resetInactivityTimer();
  if(mode==="express"){
    wizard.reset();
    showScreen("screenExpress");
    renderWizard();
  } else {
    showScreen("screenDetailed");
    hydrateFromStateToDetailedForm();
  }
});

$("btnPrev").addEventListener("click", prevWizard);
$("btnNext").addEventListener("click", nextWizard);

$("btnComputeDetailed").addEventListener("click", ()=>{
  state.statut = $("d_statut").value;
  state.age = $("d_age").value;
  state.apprentissage_exception = $("d_apprentissage_exception").value || "unknown";
  state.handicap = getRadio("d_handicap","non");
  state.employeur = getRadio("d_employeur","non");
  state.alternance = getRadio("d_alternance","non");
  state.target_contract = $("d_target_contract").value || "unknown";
  state.contratpro_case = $("d_contratpro_case").value || "unknown";
  state.ptp_seniority = $("d_ptp_seniority").value || "unknown";
  if(state.contratpro_case === "aah") state.handicap = "oui";
  state.formation = $("d_formation").value;
  state.cost_peda = Number($("d_cout").value||0) || 0;
  state.cpf_amount = Number($("d_cpf").value||0) || 0;
  state.cpf_action = $("d_cpf_action").value || "unknown";
  state.prf_simple = $("d_prf").value || "nspp";
  state.allocation_ft = $("d_allocation_ft").value || "unknown";
  state.needs.transport = $("d_annexesTransport").checked;
  state.needs.hebergement = $("d_annexesHebergement").checked;
  state.needs.equipement = $("d_annexesEquipement").checked;

  if(!state.statut){ alert("Choisissez une situation."); return; }
  if(!state.formation){ alert("Choisissez un type de formation."); return; }

  showScreen("screenResults");
  renderPacks(state);
  // Ne pas ouvrir automatiquement le QR/partage.
});

$("btnBack").addEventListener("click", ()=>{ if(mode==="express") showScreen("screenExpress"); else showScreen("screenDetailed"); });
$("btnReset").addEventListener("click", hardReset);
$("btnHome").addEventListener("click", ()=>{ clearUrlState(); showScreen("screenStart"); });
$("btnMap").addEventListener("click", ()=>{ showScreen("screenMap"); renderCartography(); });
$("btnMapBack").addEventListener("click", ()=>{ showScreen(lastNonMapScreen || "screenStart"); });

["mapSearch","mapStatus","mapPerimeter","mapFinanceur","mapNeed"].forEach((id)=>{
  const el = $(id);
  if(!el) return;
  el.addEventListener(id === "mapSearch" ? "input" : "change", renderCartography);
});

$("btnShare").addEventListener("click", ()=>{ setUrlState(state); openShare(); });

$("btnToggleView").addEventListener("click", ()=>{
  setViewMode(viewMode === "expert" ? "usager" : "expert");
  if($("screenResults") && !$("screenResults").classList.contains("hidden")){
    renderPacks(state);
  }
});

$("btnQuickShare").addEventListener("click", ()=>{
  setUrlState(state);
  openShare();
});

$("btnCloseShare").addEventListener("click", closeShare);
$("shareModal").addEventListener("click", (e)=>{ if(e.target === $("shareModal")) closeShare(); });

$("btnCopyLink").addEventListener("click", async ()=>{
  try{ await navigator.clipboard.writeText($("shareLink").textContent);
    const cl = $("btnCopyLink").querySelector(".btnlabel"); if(cl){ cl.textContent="Lien copiÃ©"; setTimeout(()=>{ cl.textContent="Copier le lien"; }, 1200); }
  }catch{ alert($("shareLink").textContent); }
});
$("btnCopySummary").addEventListener("click", async ()=>{
  const txt = summaryText(state);
  try{ await navigator.clipboard.writeText(txt);
    const cs = $("btnCopySummary").querySelector(".btnlabel"); if(cs){ cs.textContent="RÃ©sumÃ© copiÃ©"; setTimeout(()=>{ cs.textContent="Copier le rÃ©sumÃ©"; }, 1200); }
  }catch{ alert(txt); }
});
$("btnPrint").addEventListener("click", ()=> openPrintView());

/* Init */
const resumed = tryLoadFromUrl();
if(resumed){ showScreen("screenResults"); renderPacks(state); }
else { showScreen("screenStart"); }
setKiosk(false);
setAutoReset(true);
if(mode==="express") setPillActive("modeExpress","modeDetailed"); else setPillActive("modeDetailed","modeExpress");
resetInactivityTimer();

initTabs();
setViewMode('usager');

// Badge legend + chip explanations
syncTipTriggers(document);
document.addEventListener("click", (e)=>{
  const trigger = e.target.closest("[data-tip]");
  if(!trigger) return;
  openTip(trigger.getAttribute("data-tip"));
});
document.addEventListener("keydown", (e)=>{
  if(e.key !== "Enter" && e.key !== " ") return;
  const trigger = e.target.closest("[data-tip]");
  if(!trigger) return;
  e.preventDefault();
  openTip(trigger.getAttribute("data-tip"));
});
$("btnCloseTip").addEventListener("click", closeTip);
$("tipModal").addEventListener("click", (e)=>{ if(e.target === $("tipModal")) closeTip(); });
