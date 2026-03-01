(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports){
    module.exports = api;
  }
  if(root){
    root.SimulatorUI = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  function renderChoiceButton(value, title, desc, current, groupA=true){
    const active = (value === current) ? "choice--active" : "";
    const group = groupA ? "A" : "B";
    return `<div class="choice ${active}" data-choice="${value}" data-group="${group}">
      <div class="choice__title">${title}</div>
      ${desc ? `<div class="choice__desc">${desc}</div>` : ""}
    </div>`;
  }

  function shouldAskAgeStep(state){
    const st = state || {};
    return st.statut === "alt" || st.statut === "jeune" || st.alternance === "oui" || st.alternance === "nspp";
  }

function createWizardController({ $, getState, onComplete, notify }){
    let wizIndex = 0;

    function steps(){
      return getWizardSteps({ choiceBtn: renderChoiceButton, state: getState(), $ });
    }

    function applyChoice(step, value, group){
      if(step.key === "alternance"){
        step.click(value, group === "A" ? "alt" : "emp");
        return;
      }
      if(step.key === "prf_simple"){
        step.click(value, group === "A" ? "prf" : "hand");
        return;
      }
      step.click(value);
    }

    function render(){
      const wizardSteps = steps();
      const total = wizardSteps.length;
      const progressText = $("progressText");
      const progressFill = $("progressFill");
      const wizardCard = $("wizardCard");
      const prevButton = $("btnPrev");
      const nextLabel = $("btnNext")?.querySelector(".btnlabel");
      if(!wizardCard || !progressText || !progressFill) return;

      progressText.textContent = `\u00c9tape ${wizIndex+1}/${total}`;
      progressFill.style.width = `${Math.round((wizIndex+1)/total*100)}%`;

      const state = getState();
      const step = wizardSteps[wizIndex];
      wizardCard.innerHTML = step.render(state);

      wizardCard.querySelectorAll(".choice").forEach((el)=>{
        el.addEventListener("click", ()=>{
          applyChoice(step, el.getAttribute("data-choice"), el.getAttribute("data-group"));
          render();
        });
      });

      if(prevButton) prevButton.disabled = (wizIndex === 0);
      if(nextLabel) nextLabel.textContent = (wizIndex === total-1) ? "Voir les r\u00e9sultats" : "Continuer";
    }

    function next(){
      const wizardSteps = steps();
      const step = wizardSteps[wizIndex];
      if(step.after) step.after();

      const state = getState();
      if(step.key === "statut" && !state.statut){ notify?.("Choisissez une situation."); return; }
      if(step.key === "formation" && !state.formation){ notify?.("Choisissez une formation (ou 'Je ne sais pas')."); return; }

      if(wizIndex >= wizardSteps.length-1){
        if(state.statut === "alt" && state.alternance === "non") state.alternance = "oui";
        onComplete?.(state);
        return;
      }

      wizIndex += 1;
      render();
    }

    function prev(){
      if(wizIndex > 0){
        wizIndex -= 1;
        render();
      }
    }

    function reset(){
      wizIndex = 0;
    }

    function getStepsForDebug(){
      return steps();
    }

    return { getSteps: getStepsForDebug, next, prev, render, reset };
  }

  function escapeHtml(value){
    return repairDisplayText(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function repairDisplayText(value){
    let text = String(value ?? "");
    if(!/[\u00c3\u00c2\u00e2\u0192]/.test(text)) return text;

    for(let i = 0; i < 5; i += 1){
      if(!/[\u00c3\u00c2\u00e2\u0192]/.test(text)) break;
      try{
        const repaired = decodeURIComponent(escape(text));
        if(!repaired || repaired === text) break;
        text = repaired;
      }catch{
        break;
      }
    }

    return text
      .replace(/\u00c2(?=\s|\u20ac|$|[!?:;,.()\/-])/g, "")
      .replace(/\u00e2\u201a\u00ac/g, "\u20ac")
      .replace(/\u00c3\u20ac/g, "\u00c0")
      .replace(/\u00c3\u2030/g, "\u00c9")
      .replace(/\u00c3\u02c6/g, "\u00c8")
      .replace(/\u00c3\u00a0/g, "\u00e0")
      .replace(/\u00c3\u00a2/g, "\u00e2")
      .replace(/\u00c3\u00a7/g, "\u00e7")
      .replace(/\u00c3\u00a8/g, "\u00e8")
      .replace(/\u00c3\u00a9/g, "\u00e9")
      .replace(/\u00c3\u00aa/g, "\u00ea")
      .replace(/\u00c3\u00ab/g, "\u00eb")
      .replace(/\u00c3\u00ae/g, "\u00ee")
      .replace(/\u00c3\u00af/g, "\u00ef")
      .replace(/\u00c3\u00b4/g, "\u00f4")
      .replace(/\u00c3\u00b6/g, "\u00f6")
      .replace(/\u00c3\u00b9/g, "\u00f9")
      .replace(/\u00c3\u00bb/g, "\u00fb")
      .replace(/\u00c3\u00bc/g, "\u00fc")
      .replace(/\u00e2\u20ac\u201c/g, "\u2013")
      .replace(/\u00e2\u20ac\u201d/g, "\u2014")
      .replace(/\u00e2\u20ac\u00a2/g, "\u2022")
      .replace(/\u00e2\u20ac\u02dc/g, "\u2018")
      .replace(/\u00e2\u20ac\u2122/g, "\u2019")
      .replace(/\u00e2\u20ac\u0153/g, "\u201c")
      .replace(/\u00e2\u20ac\u009d/g, "\u201d");
  }

  function renderPackIcon(id){
    const map = {
      apprentissage: "ri-briefcase-3-line",
      contratpro: "ri-briefcase-line",
      prf: "ri-map-pin-2-line",
      cpf: "ri-bank-card-line",
      ptp: "ri-route-line",
      faf: "ri-store-2-line"
    };
    const cls = map[id] || "ri-file-list-3-line";
    return `<i class="ri ${cls}" aria-hidden="true"></i>`;
  }

  function renderCoverageIcon(raw){
    const dash = "\u2014";
    const ellipsis = "\u2026";
    const value = String(raw ?? dash).trim();
    const symbol = value.charAt(0) || dash;
    let rest = value.slice(1).trim();
    if(rest.startsWith("(") && rest.endsWith(")")) rest = rest.slice(1, -1).trim();
    rest = rest.replace(/^[-\u2013\u2014]\s*/, "").trim();

    const lowered = rest.toLowerCase();
    let tag = "";
    if(!rest) tag = "";
    else if(lowered.includes("selon cas")) tag = "Selon cas";
    else if(lowered.includes("salaire")) tag = "Salaire";
    else if(lowered.includes("aref") || lowered.includes("rfft")) tag = "AREF/RFFT";
    else if(lowered.includes("cep") || lowered.includes("prif")) tag = "CEP/PRIF";
    else tag = rest.length > 18 ? `${rest.slice(0, 18)}${ellipsis}` : rest;

    const withTag = (kind, icon, label)=>{
      const tagHtml = tag ? `<span class="covtag" title="${escapeHtml(tag)}">${escapeHtml(tag)}</span>` : "";
      return `<span class="covcell"><span class="sym ${kind}" title="${label}" aria-hidden="true"><i class="ri ${icon}"></i></span>${tagHtml}</span>`;
    };

    if(symbol === "\u2713" || symbol === "\u2714") return withTag("sym--yes", "ri-check-line", "Pr\u00e9vu / tr\u00e8s probable");
    if(symbol === "\u25d0") return withTag("sym--maybe", "ri-time-line", "Possible sous conditions");
    if(symbol === dash || symbol === "-" || symbol === "\u2013") return withTag("sym--no", "ri-subtract-line", "Non pr\u00e9vu / non applicable");
    return `<span class="covtag">${escapeHtml(value)}</span>`;
  }

  function getMissingDetails(text, normalize){
    const t = normalize(text);
    const flat = String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const detail = (tagline, how, who)=>({ tagline, how, who });
    const has = (...needles)=> needles.some((needle)=>{
      const value = String(needle || "");
      const valueFlat = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return t.includes(value) || flat.includes(valueFlat);
    });

    if(has("employeur")){
      return detail(
        "Point bloquant : sans employeur, l'alternance ne finance pas la formation.",
        [
          "Lister des structures cibles (clubs, associations, collectivit\u00e9s, entreprises) et un rythme d'alternance plausible.",
          "Demander \u00e0 l'OF / CFA un support de prospection ou une fiche de poste type \u00e0 transmettre.",
          "Faire confirmer le calendrier, le contrat vis\u00e9 et l'interlocuteur recrutement."
        ],
        ["Organisme / CFA", "Employeurs cibles", "Mission locale / France Travail (appui recrutement)"]
      );
    }

    if(has("tranche d'age", "tranche d\u2019age", "tranche d'\u00e2ge")){
      return detail(
        "Point de tri : l'\u00e2ge peut faire basculer entre apprentissage, contrat pro ou autre solution.",
        [
          "Confirmer la tranche d'\u00e2ge exacte au moment de l'entr\u00e9e en formation.",
          "V\u00e9rifier ensuite si une exception d'\u00e2ge existe ou si un autre montage est plus adapt\u00e9.",
          "R\u00e9ajuster le sc\u00e9nario principal une fois cette information s\u00e9curis\u00e9e."
        ],
        ["Organisme / CFA", "Portail de l'alternance", "Conseiller France Travail / Mission locale"]
      );
    }

    if(has("contrat pro apres 26 ans", "contrat pro apr\u00e8s 26 ans")){
      return detail(
        "Point r\u00e9glementaire : apr\u00e8s 26 ans, le contrat pro d\u00e9pend d'un cas d'ouverture ou du statut.",
        [
          "V\u00e9rifier si vous relevez bien d'un cas ouvrant le contrat pro (demandeur d'emploi, RSA, ASS, AAH, sortie CUI).",
          "Faire confirmer le montage par l'employeur, l'OPCO et l'organisme de formation.",
          "Basculez vers apprentissage, CPF ou PTP si le contrat pro ne tient pas."
        ],
        ["Employeur", "OPCO", "Organisme de formation / CFA"]
      );
    }

    if(has("exception d'age", "exception d\u2019age", "exception d'\u00e2ge")){
      return detail(
        "Point justificatif : une exception d'\u00e2ge existe parfois, mais elle doit \u00eatre document\u00e9e.",
        [
          "Identifier l'exception exacte utilisable dans le dossier (handicap, cr\u00e9ation, sportif de haut niveau, suite de contrat, etc.).",
          "Faire confirmer cette ouverture avant l'inscription d\u00e9finitive ou la signature du contrat.",
          "Conserver les justificatifs utiles pour le CFA, l'employeur et l'OPCO."
        ],
        ["CFA / organisme de formation", "Employeur", "Cap emploi / Agefiph si besoin"]
      );
    }

    if(has("eligibilite cpf", "eligibilit\u00e9 cpf", "mon compte formation") || (t.includes("eligibil") && t.includes("cpf"))){
      return detail(
        "Point d'entr\u00e9e : le CPF n'est mobilisable que si l'offre est bien r\u00e9f\u00e9renc\u00e9e et \u00e9ligible.",
        [
          "Demander \u00e0 l'organisme le lien Mon Compte Formation ou le code RNCP / RS exact.",
          "V\u00e9rifier que la fiche correspond bien \u00e0 la bonne session, au bon prix et au bon lieu.",
          "Si l'action est RS, bilan ou permis, confirmer le plafond CPF applicable."
        ],
        ["Organisme de formation", "Mon Compte Formation"]
      );
    }

    if(has("aif", "aide individuelle a la formation", "aide individuelle \u00e0 la formation")){
      return detail(
        "Point d'instruction : l'AIF sert surtout en dernier compl\u00e9ment, quand la session n'est pas prise en charge autrement.",
        [
          "Faire confirmer que la session n'est pas d\u00e9j\u00e0 financ\u00e9e collectivement et que le CPF ne suffit pas.",
          "Pr\u00e9parer un devis, le calendrier, le projet vis\u00e9 et les arguments de retour \u00e0 l'emploi.",
          "Demander explicitement au conseiller si une AIF est mobilisable avant l'entr\u00e9e en formation."
        ],
        ["France Travail", "Organisme de formation", "PRIF si besoin d'orientation"]
      );
    }

    if(has("aide a la mobilite france travail", "aide \u00e0 la mobilit\u00e9 france travail", "mobilite france travail", "mobilit\u00e9 france travail", "mobilite ft") || (t.includes("mobilit") && t.includes("france travail"))){
      return detail(
        "Point annexe : l'aide mobilit\u00e9 n'est utile que s'il existe un vrai surco\u00fbt de trajet ou d'h\u00e9bergement.",
        [
          "Confirmer qu'il y a bien une entr\u00e9e en formation valid\u00e9e avec des frais de d\u00e9placement ou d'h\u00e9bergement.",
          "Pr\u00e9parer rapidement les justificatifs et le d\u00e9p\u00f4t dans le bon d\u00e9lai.",
          "Faire confirmer le cas exact avec le conseiller si vous \u00eates indemnis\u00e9 ou d\u00e9j\u00e0 en suivi."
        ],
        ["France Travail", "Espace personnel France Travail"]
      );
    }

    if(has("france travail") && !has("mobilite", "mobilit\u00e9")){
      return detail(
        "Point d'instruction : un compl\u00e9ment France Travail existe parfois, mais il n'est jamais automatique.",
        [
          "Prendre contact avec le conseiller en amont du d\u00e9p\u00f4t et pr\u00e9senter clairement le projet.",
          "Pr\u00e9parer un argumentaire court : m\u00e9tier vis\u00e9, d\u00e9bouch\u00e9s, dates, devis et reste \u00e0 charge.",
          "Demander explicitement si un abondement CPF ou une AIF est envisageable."
        ],
        ["France Travail", "PRIF si besoin d'orientation"]
      );
    }

    if(has("generation #hdf", "g\u00e9n\u00e9ration #hdf", "thr / equipement", "thr / \u00e9quipement")){
      return detail(
        "Point apprenti : les aides THR et \u00e9quipement passent souvent par le CFA et demandent des justificatifs.",
        [
          "Demander au CFA si la Carte G\u00e9n\u00e9ration #HDF est ouverte pour l'ann\u00e9e en cours.",
          "V\u00e9rifier les justificatifs demand\u00e9s pour le transport, l'h\u00e9bergement, la restauration ou l'\u00e9quipement.",
          "D\u00e9poser rapidement pour ne pas perdre l'aide en cours d'ann\u00e9e."
        ],
        ["CFA / organisme de formation", "Plateforme G\u00e9n\u00e9ration #HDF"]
      );
    }

    if(has("mobili-jeune", "mobili jeune")){
      return detail(
        "Point logement : Mobili-Jeune sert surtout pour les alternants de moins de 30 ans quand l'alternance impose un logement ou une double r\u00e9sidence.",
        [
          "Confirmer que le logement est bien n\u00e9cessaire pour suivre l'alternance ou la formation.",
          "Pr\u00e9parer bail, quittance ou d\u00e9p\u00f4t de garantie selon l'aide vis\u00e9e.",
          "Faire confirmer le cas exact sur Action Logement avant l'engagement d\u00e9finitif."
        ],
        ['<a href="https://www.actionlogement.fr/aide-mobili-jeune" target="_blank" rel="noopener">Action Logement - Mobili-Jeune</a>', '<a href="https://www.actionlogement.fr/l-avance-loca-pass" target="_blank" rel="noopener">Action Logement - Loca-Pass</a>', "CFA / employeur"]
      );
    }

    if(has("loca-pass", "loca pass")){
      return detail(
        "Point logement : l'avance Loca-Pass aide surtout \u00e0 couvrir le d\u00e9p\u00f4t de garantie si l'alternance impose un logement.",
        [
          "Confirmer que le logement est bien n\u00e9cessaire pour suivre l'alternance ou la formation.",
          "Pr\u00e9parer le bail, le montant du d\u00e9p\u00f4t de garantie et les pi\u00e8ces li\u00e9es au contrat ou \u00e0 l'employeur.",
          "Faire confirmer l'\u00e9ligibilit\u00e9 exacte sur Action Logement avant l'engagement d\u00e9finitif."
        ],
        ['<a href="https://www.actionlogement.fr/l-avance-loca-pass" target="_blank" rel="noopener">Action Logement - Loca-Pass</a>', "Employeur / CFA si alternance"]
      );
    }

    if(has("en route pour l'emploi", "en route pour l’emploi")){
      return detail(
        "Point mobilit\u00e9 : ce levier sert surtout quand le transport bloque r\u00e9ellement l'acc\u00e8s au contrat ou \u00e0 la formation.",
        [
          "V\u00e9rifier qu'il existe bien un contrat, une alternance, un stage ou une entr\u00e9e en formation \u00e0 s\u00e9curiser.",
          "Confirmer l'absence de solution de transport adapt\u00e9e et la faisabilit\u00e9 du pr\u00eat de v\u00e9hicule.",
          "Faire le point sur le permis, l'assurance et le point d'entr\u00e9e local."
        ],
        ["Partenaire mobilit\u00e9 / R\u00e9gion Hauts-de-France", "Organisme de formation / employeur"]
      );
    }

    if(has("cheque", "ch\u00e8que", "abondement region", "abondement r\u00e9gion", "region", "r\u00e9gion")){
      return detail(
        "Point compl\u00e9mentaire : les aides r\u00e9gionales d\u00e9pendent du public, de la session et des crit\u00e8res du dispositif.",
        [
          "V\u00e9rifier le bon dispositif r\u00e9gional mobilisable selon l'\u00e2ge, le statut et la formation vis\u00e9e.",
          "Conserver les justificatifs utiles (domicile, statut, devis, calendrier).",
          "Faire confirmer l'ouverture effective avant de compter dessus dans le montage."
        ],
        ["R\u00e9gion Hauts-de-France", '<a href="https://www.hautsdefrance.fr/prochinfo-formation/" target="_blank" rel="noopener">PRIF</a>']
      );
    }

    if(has("prf", "sfer", "c2rp")){
      return detail(
        "Point collectif : PRF / SFER ne se suppose pas, il faut confirmer la session et son financeur.",
        [
          "Chercher la session dans le catalogue C2RP.",
          "Rep\u00e9rer la ligne \"Dispositif financeur\" pour savoir si la place est bien financ\u00e9e collectivement.",
          "En cas de doute, faire confirmer par un prescripteur ou via PRIF."
        ],
        ['<a href="https://www.c2rp.fr/former-orienter/formations" target="_blank" rel="noopener">Catalogue C2RP</a>', '<a href="https://www.hautsdefrance.fr/prochinfo-formation/" target="_blank" rel="noopener">PRIF</a>', "France Travail / Cap emploi"]
      );
    }

    if(has("cep", "ptp", "transitions pro")){
      return detail(
        "Point dossier : le PTP est d\u00e9cisionnel, donc il faut anticiper t\u00f4t.",
        [
          "Prendre un rendez-vous CEP pour clarifier le projet et le calendrier.",
          "Rassembler devis, programme, calendrier et argumentaire de reconversion.",
          "D\u00e9poser le dossier complet dans les d\u00e9lais de Transitions Pro."
        ],
        ["CEP", "Transitions Pro", "Employeur / RH"]
      );
    }

    if(has("faf")){
      return detail(
        "Point fonds : les FAF ont des bar\u00e8mes annuels et des r\u00e8gles de d\u00e9p\u00f4t tr\u00e8s variables.",
        [
          "Identifier d'abord le FAF comp\u00e9tent selon votre activit\u00e9.",
          "V\u00e9rifier les bar\u00e8mes, les pi\u00e8ces demand\u00e9es et les formations recevables.",
          "D\u00e9poser avant l'entr\u00e9e en formation si le fonds l'exige."
        ],
        ["FAF comp\u00e9tent (FIF PL / AGEFICE...)", "Organisme de formation"]
      );
    }

    return detail(
      "Point de vigilance : une information manque encore pour s\u00e9curiser le montage.",
      [
        "R\u00e9cup\u00e9rer les informations manquantes (devis, dates, conditions).",
        "Faire confirmer le point bloquant par l'interlocuteur principal.",
        "R\u00e9ajuster ensuite le sc\u00e9nario recommand\u00e9."
      ],
      ["Organisme de formation / CFA"]
    );
  }

  function buildGaugeData(rr, formatEUR){
    const maxVal = (rr.maxValue !== null && rr.maxValue !== undefined) ? rr.maxValue : rr.minValue;
    const minVal = rr.minValue;
    const max = (typeof maxVal === "number" && maxVal >= 0) ? maxVal : null;
    const min = (typeof minVal === "number" && minVal >= 0) ? minVal : null;

    let markerPct = 0;
    let fillPct = 0;
    let maxLabel = (max !== null) ? formatEUR(max) : "\u2014";
    let note = rr.hint || "\u2014";
    if(max === null){
      maxLabel = "Non calculable";
      note = "Renseignez un coÃ»t (et CPF) pour estimer le reste Ã  charge minimum.";
    } else if(max === 0){
      maxLabel = "0 \u20ac";
    } else {
      markerPct = Math.max(0, Math.min(100, (min !== null ? (min / max) * 100 : 0)));
      fillPct = markerPct;
    }

    return {
      fillPct: fillPct.toFixed(0),
      markerPct: markerPct.toFixed(0),
      maxLabel,
      note
    };
  }

  function getTipContent(kind){
    return {
      org: {
        title: `<i class="ri ri-building-4-line" aria-hidden="true"></i> Organisme`,
        body: `<p><strong>Versement principal vers l'organisme de formation (ou CFA)</strong>.</p>
               <ul>
                 <li>Ex : prise en charge OPCO/CFA, financement RÃ©gion (PRF), PTP -> paiement direct au prestataire.</li>
                 <li>La personne peut malgrÃ© tout avoir un reste Ã  charge (selon cas).</li>
               </ul>`
      },
      pers: {
        title: `<i class="ri ri-user-line" aria-hidden="true"></i> Personne`,
        body: `<p><strong>Versement principal vers la personne</strong> (allocations, indemnisation, aides mobilitÃ©).</p>
               <ul>
                 <li>Ex : rÃ©munÃ©ration en alternance, indemnisation France Travail, aides transport/hÃ©bergement sur justificatifs.</li>
               </ul>`
      },
      mix: {
        title: `<i class="ri ri-arrow-left-right-line" aria-hidden="true"></i> Variable`,
        body: `<p><strong>DÃ©pend du dispositif et des rÃ¨gles locales</strong>.</p>
               <ul>
                 <li>Ex : Ã©quipement, certaines aides annexes, modalitÃ©s de remboursement vs paiement direct.</li>
                 <li>RÃ©flexe : vÃ©rifier les rÃ¨gles de l'organisme instructeur et les sources.</li>
               </ul>`
      }
    }[kind] || {title:"", body:""};
  }

  function createTipModal({ $, getContent }){
    const resolveContent = getContent || getTipContent;

    function sync(root=document){
      if(!root || typeof root.querySelectorAll !== "function") return;
      root.querySelectorAll("[data-tip]").forEach((el)=>{
        if(!el.hasAttribute("role")) el.setAttribute("role","button");
        if(!el.hasAttribute("tabindex")) el.setAttribute("tabindex","0");
      });
    }

    function open(kind){
      const modal = $("tipModal");
      const title = $("tipTitle");
      const body = $("tipBody");
      if(!modal || !title || !body) return;

      const content = resolveContent(kind);
      title.innerHTML = content.title;
      body.innerHTML = content.body;
      modal.classList.add("tipmodal--open");
      modal.setAttribute("aria-hidden","false");
    }

    function close(){
      const modal = $("tipModal");
      if(!modal) return;
      modal.classList.remove("tipmodal--open");
      modal.setAttribute("aria-hidden","true");
    }

    return { close, open, sync };
  }

function getWizardSteps({ choiceBtn, state, $ }){
    const renderChoice = choiceBtn || renderChoiceButton;
    const ageCurrent = (!state.age || state.age === "unknown") ? "unknown" : state.age;
    const ageNeedsException = ["30+", "30-35", "36+", "36-44", "45+"].includes(ageCurrent);
    const shouldAskContractTarget = state.employeur === "oui" && (state.statut === "de" || state.statut === "jeune");
    const shouldAskPtpSeniority = state.statut === "sal";
    const shouldAskApprentissageException = ageNeedsException && (state.statut === "alt" || state.alternance === "oui" || state.alternance === "nspp");
    const shouldAskContratProCase = ["26-29", "30+", "30-35", "36+", "36-44", "45+"].includes(ageCurrent) && state.statut !== "de" && (state.statut === "alt" || state.alternance === "oui" || state.alternance === "nspp");
    const shouldAskAllocationFt = state.statut === "de" || state.statut === "jeune";
    const shouldAskAnnexNeeds = state.statut === "de" || state.statut === "jeune" || state.statut === "alt" || state.alternance === "oui" || state.employeur === "oui";
    const steps = [
      { key:"statut", title:"Votre situation",
        render:(st)=> `
          <div class="wizard-q">Votre situation</div>
          <div class="choice-grid">
            ${renderChoice("de","Je cherche un emploi","Demandeur d'emploi / en recherche", st.statut)}
            ${renderChoice("sal","Je suis salari\u00e9(e)","Reconversion / \u00e9volution", st.statut)}
            ${renderChoice("alt","Je vise l'alternance","Apprentissage / contrat pro", st.statut)}
            ${renderChoice("ind","Je suis ind\u00e9pendant(e)","Auto-entrepreneur, etc.", st.statut)}
            ${renderChoice("fp","Je suis agent public","Fonction publique", st.statut)}
            ${renderChoice("jeune","Jeune (insertion)","16-25 / Mission locale", st.statut)}
          </div>
        `,
        click:(value)=>{ state.statut = value; }
      },
      { key:"alternance", title:"Alternance / employeur",
        render:(st)=> `
          <div class="wizard-q">Alternance possible / recherch\u00e9e ?</div>
          <div class="choice-grid">
            ${renderChoice("oui","Oui","", st.alternance, true)}
            ${renderChoice("non","Non","", st.alternance, true)}
            ${renderChoice("nspp","Je ne sais pas","", st.alternance, true)}
          </div>
          <div class="sep"></div>
          <div class="wizard-q">Employeur / promesse d'embauche ?</div>
          <div class="choice-grid">
            ${renderChoice("oui","Oui","", st.employeur, false)}
            ${renderChoice("non","Non","", st.employeur, false)}
            ${renderChoice("nspp","Je ne sais pas","", st.employeur, false)}
          </div>
        `,
        click:(value, group)=>{ if(group === "alt") state.alternance = value; else state.employeur = value; }
      }
    ];

    if(shouldAskAgeStep(state)){
      steps.push({
        key:"age", title:"\u00c2ge",
        render:(st)=> `
          <div class="wizard-q">Quelle est votre tranche d'\u00e2ge ?</div>
          <div class="choice-grid">
            ${renderChoice("<26","Moins de 26 ans","", st.age)}
            ${renderChoice("26-29","26-29 ans","", st.age)}
            ${renderChoice("30-35","30-35 ans","", st.age)}
            ${renderChoice("36-44","36-44 ans","", st.age)}
            ${renderChoice("45+","45 ans et +","Aides employeur sp\u00e9cifiques possibles", st.age)}
            ${renderChoice("unknown","Je ne sais pas","On restera prudent", (!st.age || st.age === "unknown") ? "unknown" : st.age)}
          </div>
        `,
        click:(value)=>{ state.age = (value === "unknown") ? "" : value; }
      });
    }

    if(shouldAskApprentissageException){
      steps.push({
        key:"apprentissage_exception", title:"D\u00e9rogation d'\u00e2ge",
        render:(st)=> `
          <div class="wizard-q">Voyez-vous une d\u00e9rogation d'\u00e2ge possible en apprentissage ?</div>
          <div class="choice-grid">
            ${renderChoice("unknown","Je ne sais pas","On restera prudent", st.apprentissage_exception || "unknown")}
            ${renderChoice("none","Aucune","Hors r\u00e8gle standard", st.apprentissage_exception)}
            ${renderChoice("handicap","Handicap / RQTH","Exception possible", st.apprentissage_exception)}
            ${renderChoice("creation","Cr\u00e9ation / reprise d'entreprise","Exception possible", st.apprentissage_exception)}
            ${renderChoice("sport","Sportif de haut niveau","Exception possible", st.apprentissage_exception)}
            ${renderChoice("suite","Suite de contrat / nouveau dipl\u00f4me","En pratique jusqu'\u00e0 35 ans", st.apprentissage_exception)}
          </div>
        `,
        click:(value)=>{
          state.apprentissage_exception = value;
          if(value === "handicap") state.handicap = "oui";
        }
      });
    }

    if(shouldAskContractTarget){
      steps.push({
        key:"target_contract", title:"Contrat vis\u00e9",
        render:(st)=> `
          <div class="wizard-q">Quel contrat est vis\u00e9 avec l'employeur ?</div>
          <div class="choice-grid">
            ${renderChoice("unknown","Je ne sais pas","On restera prudent", st.target_contract || "unknown")}
            ${renderChoice("12plus","CDI ou 12 mois et +","POEI possible", st.target_contract)}
            ${renderChoice("6to11","6 \u00e0 11 mois","AFPR possible", st.target_contract)}
            ${renderChoice("none","Pas de contrat d\u00e9fini","Pas encore cadr\u00e9", st.target_contract)}
          </div>
        `,
        click:(value)=>{ state.target_contract = value; }
      });
    }

    if(shouldAskContratProCase){
      steps.push({
        key:"contratpro_case", title:"Contrat pro apr\u00e8s 26 ans",
        render:(st)=> `
          <div class="wizard-q">Relevez-vous d'un cas ouvrant le contrat pro apr\u00e8s 26 ans ?</div>
          <div class="choice-grid">
            ${renderChoice("unknown","Je ne sais pas","On restera prudent", st.contratpro_case || "unknown")}
            ${renderChoice("none","Aucun de ces cas","", st.contratpro_case)}
            ${renderChoice("rsa","RSA","B\u00e9n\u00e9ficiaire du RSA", st.contratpro_case)}
            ${renderChoice("ass","ASS","B\u00e9n\u00e9ficiaire de l'ASS", st.contratpro_case)}
            ${renderChoice("aah","AAH","B\u00e9n\u00e9ficiaire de l'AAH", st.contratpro_case)}
            ${renderChoice("cui","Sortie CUI","Sortie d'un contrat unique d'insertion", st.contratpro_case)}
          </div>
        `,
        click:(value)=>{
          state.contratpro_case = value;
          if(value === "aah") state.handicap = "oui";
        }
      });
    }

    if(shouldAskPtpSeniority){
      steps.push({
        key:"ptp_seniority", title:"Anciennet\u00e9 PTP",
        render:(st)=> `
          <div class="wizard-q">Avez-vous l'anciennet\u00e9 requise pour un PTP salari\u00e9 ?</div>
          <div class="choice-grid">
            ${renderChoice("unknown","Je ne sais pas","On restera prudent", st.ptp_seniority || "unknown")}
            ${renderChoice("ok","Oui","Au moins 24 mois salari\u00e9, dont 12 dans l'entreprise", st.ptp_seniority)}
            ${renderChoice("special","Cas particulier","Int\u00e9rim ou situation d\u00e9rogatoire \u00e0 confirmer", st.ptp_seniority)}
            ${renderChoice("no","Non","Anciennet\u00e9 encore insuffisante", st.ptp_seniority)}
          </div>
        `,
        click:(value)=>{ state.ptp_seniority = value; }
      });
    }

    if(shouldAskAllocationFt){
      steps.push({
        key:"allocation_ft", title:"Indemnisation FT",
        render:(st)=> `
          <div class="wizard-q">Pendant la formation, avez-vous actuellement l'ARE ?</div>
          <div class="choice-grid">
            ${renderChoice("unknown","Je ne sais pas","On restera prudent", st.allocation_ft || "unknown")}
            ${renderChoice("are","Oui","La r\u00e9mun\u00e9ration peut basculer en AREF", st.allocation_ft)}
            ${renderChoice("none","Non","La r\u00e9mun\u00e9ration peut relever de la RFFT selon cas", st.allocation_ft)}
          </div>
        `,
        click:(value)=>{ state.allocation_ft = value; }
      });
    }

    if(shouldAskAnnexNeeds){
      steps.push({
        key:"annexes", title:"Frais annexes",
        render:(st)=> `
          <div class="wizard-q">Y a-t-il des frais annexes importants \u00e0 pr\u00e9voir ?</div>
          <div class="checkbox-row checkbox-row--cards wizard-annexes">
            <label class="choice-toggle choice-toggle--checkbox"><input id="w_need_transport" type="checkbox" ${st.needs.transport ? "checked" : ""} /><span>Transport / d\u00e9placements</span></label>
            <label class="choice-toggle choice-toggle--checkbox"><input id="w_need_hebergement" type="checkbox" ${st.needs.hebergement ? "checked" : ""} /><span>H\u00e9bergement / nuit\u00e9es</span></label>
            <label class="choice-toggle choice-toggle--checkbox"><input id="w_need_equipement" type="checkbox" ${st.needs.equipement ? "checked" : ""} /><span>\u00c9quipement / tenues / mat\u00e9riel</span></label>
          </div>
          <div class="hint">Cela permet de faire remonter les aides mobilit\u00e9, THR et \u00e9quipement quand elles sont plausibles.</div>
        `,
        after:()=>{
          state.needs.transport = !!$("w_need_transport")?.checked;
          state.needs.hebergement = !!$("w_need_hebergement")?.checked;
          state.needs.equipement = !!$("w_need_equipement")?.checked;
        }
      });
    }

    steps.push(
      { key:"formation", title:"Formation vis\u00e9e",
        render:(st)=> `
          <div class="wizard-q">Quelle formation visez-vous ?</div>
          <div class="choice-grid">
            ${renderChoice("bafa","BAFA / BAFD","Animation", st.formation)}
            ${renderChoice("bpjeps","BPJEPS","Sport/animation", st.formation)}
            ${renderChoice("cpjeps","CPJEPS","Animation", st.formation)}
            ${renderChoice("dejeps","DEJEPS","Encadrement", st.formation)}
            ${renderChoice("desjeps","DESJEPS","Direction", st.formation)}
            ${renderChoice("cqp","CQP","Branche / f\u00e9d\u00e9ration", st.formation)}
            ${renderChoice("bnssa","BNSSA / MNS","Aquatique", st.formation)}
            ${renderChoice("autre","Je ne sais pas","On proposera des pistes", st.formation)}
          </div>
        `,
        click:(value)=>{ state.formation = value; }
      },
      { key:"cost_peda", title:"Co\u00fbt",
        render:(st)=> `
          <div class="wizard-q">Co\u00fbt p\u00e9dagogique (estimation)</div>
          <div class="field">
            <label>Montant (\u20ac)</label>
            <input id="w_cost" type="number" min="0" step="50" placeholder="Ex : 6500" value="${st.cost_peda||""}" />
            <div class="hint">Si vous ne savez pas, laissez vide ou 0.</div>
          </div>
        `,
        after:()=>{ state.cost_peda = Number($("w_cost").value||0) || 0; }
      },
      { key:"cpf_amount", title:"CPF",
        render:(st)=> `
          <div class="wizard-q">Vos droits CPF (si vous savez)</div>
          <div class="field">
            <label>Montant CPF (\u20ac)</label>
            <input id="w_cpf" type="number" min="0" step="50" placeholder="Ex : 1500" value="${st.cpf_amount||""}" />
            <div class="hint">Sinon, mettez 0.</div>
          </div>
        `,
        after:()=>{ state.cpf_amount = Number($("w_cpf").value||0) || 0; }
      },
      { key:"cpf_action", title:"Type d'action CPF",
        render:(st)=> `
          <div class="wizard-q">Pour le CPF : quel type d'action ?</div>
          <div class="choice-grid">
            ${renderChoice("unknown","Je ne sais pas","On restera prudent", st.cpf_action)}
            ${renderChoice("rs","Certification RS","Plafond CPF : 1 500 \u20ac", st.cpf_action)}
            ${renderChoice("bilan","Bilan de comp\u00e9tences","Plafond CPF : 1 600 \u20ac", st.cpf_action)}
            ${renderChoice("permis","Permis (groupe l\u00e9ger)","Plafond CPF : 900 \u20ac", st.cpf_action)}
            ${renderChoice("rncp","Certification RNCP","Pas de plafond sp\u00e9cifique dans ce d\u00e9cret", st.cpf_action)}
          </div>
          <div class="hint" style="margin-top:10px;">
            D\u00e9cret 2026-127 (24/02/2026) : plafonds pour RS/bilan/permis. RNCP : mobilisable sans plafond sp\u00e9cifique dans ce d\u00e9cret.
          </div>
        `,
        click:(value)=>{ state.cpf_action = value; }
      },
      { key:"prf_simple", title:"Financement R\u00e9gion / handicap",
        render:(st)=> `
          <div class="wizard-q">Financement R\u00e9gion (PRF/SFER) confirm\u00e9 ?</div>
          <div class="choice-grid">
            ${renderChoice("oui","Oui","mail / convocation / prescription", st.prf_simple, true)}
            ${renderChoice("non","Non","pas de confirmation", st.prf_simple, true)}
            ${renderChoice("nspp","Je ne sais pas","on reste prudent", st.prf_simple, true)}
          </div>
          <div class="hint" style="margin-top:10px;">
            Pour v\u00e9rifier : <a href="https://www.c2rp.fr/former-orienter/formations" target="_blank" rel="noopener">catalogue C2RP</a>, <a href="https://www.hautsdefrance.fr/prochinfo-formation/" target="_blank" rel="noopener">PRIF</a>.
          </div>
          <div class="sep"></div>
          <div class="wizard-q">Handicap (RQTH) ?</div>
          <div class="choice-grid">
            ${renderChoice("non","Non","", st.handicap, false)}
            ${renderChoice("oui","Oui","", st.handicap, false)}
          </div>
        `,
        click:(value, group)=>{ if(group === "prf") state.prf_simple = value; else state.handicap = value; }
      }
    );

    return steps;
  }

  function renderEligibilityNotice(eligibility){
    if(!eligibility || eligibility.status === "eligible" || !eligibility.note) return "";
    const cls = eligibility.status === "ineligible" ? "pack__eligibility pack__eligibility--no" : "pack__eligibility pack__eligibility--warn";
    const icon = eligibility.status === "ineligible" ? "ri-close-circle-line" : "ri-error-warning-line";
    return `<div class="${cls}"><i class="ri ${icon}" aria-hidden="true"></i><span>${escapeHtml(eligibility.note)}</span></div>`;
  }

  function getConfidenceData(pack){
    const status = pack && pack.eligibility ? pack.eligibility.status : "conditional";
    if(status === "eligible"){
      return { label: "Confiance \u00e9lev\u00e9e", className: "" };
    }
    if(status === "ineligible"){
      return { label: "Confiance faible", className: " pack__confidence--low", summaryClassName: " summary-pill--low" };
    }
    return { label: "Confiance moyenne", className: " pack__confidence--medium", summaryClassName: " summary-pill--medium" };
  }

  function ageSummaryLabel(value){
    return ({
      "<26": "moins de 26 ans",
      "26-29": "26-29 ans",
      "30-35": "30-35 ans",
      "36-44": "36-44 ans",
      "45+": "45 ans et plus"
    }[String(value || "")] || "à préciser");
  }

  function displayPackTitle(pack){
    if(pack && pack.id === "faf"){
      return "Non-salariés - CPF + FAF (FIF PL / AGEFICE...)";
    }
    return pack ? pack.title : "";
  }

  function buildSummaryData({ best, alternatives, st, prf, resteTriplet, statutLabel, formationLabel, formatEUR, prfLabel, whoReceivesHTML }){
    if(!best) return null;

    const rr = resteTriplet(best.id, st);
    const eligibilityText = best.eligibility
      ? ({
          eligible: "\u00c9ligibilit\u00e9 r\u00e9glementaire : coh\u00e9rente au vu des informations saisies.",
          conditional: `\u00c9ligibilit\u00e9 r\u00e9glementaire : \u00e0 confirmer. ${best.eligibility.note || ""}`.trim(),
          ineligible: `\u00c9ligibilit\u00e9 r\u00e9glementaire : non prioritaire. ${best.eligibility.note || ""}`.trim()
        }[best.eligibility.status] || "\u00c9ligibilit\u00e9 r\u00e9glementaire : \u00e0 confirmer.")
      : "\u00c9ligibilit\u00e9 r\u00e9glementaire : \u00e0 confirmer.";
    const eligibilityDetailsHtml = (best.eligibility && Array.isArray(best.eligibility.reasons))
      ? best.eligibility.reasons.slice(0, 3).map((item)=>`<li>${escapeHtml(item)}</li>`).join("")
      : "";
    const compareHtml = Array.isArray(alternatives) && alternatives.length
      ? `<div class="summary-compare__title">Pourquoi cette piste passe devant les autres</div><ul>${alternatives.slice(0, 2).map((pack)=>{
          const reason = (pack.eligibility && pack.eligibility.reasons && pack.eligibility.reasons[0])
            ? pack.eligibility.reasons[0]
            : ((pack.why && pack.why[0]) || "Piste secondaire au vu des informations saisies.");
          return `<li><strong>${escapeHtml(displayPackTitle(pack))}</strong> : ${escapeHtml(reason)}</li>`;
        }).join("")}</ul>`
      : "";
    const confidence = getConfidenceData(best);
    const steps = ["R\u00e9cup\u00e9rer le devis et le calendrier exact de l'organisme"];
    if(best.id === "apprentissage"){
      steps.push("S\u00e9curiser un employeur et faire valider le calendrier avec le CFA");
      steps.push("V\u00e9rifier les aides apprentissage utiles : THR, \u00e9quipement et logement si besoin");
    } else if(best.id === "contratpro"){
      steps.push("S\u00e9curiser l'employeur, le type de contrat et l'OPCO comp\u00e9tent");
      steps.push("V\u00e9rifier le cas d'ouverture apr\u00e8s 26 ans et les aides employeur mobilisables");
    } else if(best.id === "prf"){
      steps.push("Faire confirmer la place PRF / SFER / AFC et l'entr\u00e9e en formation");
      steps.push("Pr\u00e9ciser la r\u00e9mun\u00e9ration pendant la formation : AREF, RFF ou RFFT selon le cas");
    } else if(best.id === "cpf"){
      steps.push("Confirmer l'\u00e9ligibilit\u00e9 de l'offre sur Mon Compte Formation");
      if(st.statut === "de" || st.statut === "jeune"){
      steps.push("Monter ensuite le compl\u00e9ment dans le bon ordre : France Travail, AIF ou R\u00e9gion selon la session");
      } else if(st.statut === "sal"){
        steps.push("Voir ensuite l'abondement employeur / OPCO ou l'articulation avec un PTP");
      } else if(st.statut === "fp"){
        steps.push("Voir ensuite avec l'administration le compl\u00e9ment \u00e9ventuel ou l'articulation avec un cong\u00e9 de transition / CFP");
      } else if(st.statut === "ind"){
        steps.push("V\u00e9rifier ensuite le compl\u00e9ment FAF selon votre activit\u00e9");
      } else {
        steps.push("Identifier ensuite le bon financeur compl\u00e9mentaire selon votre situation");
      }
    } else if(best.id === "ptp"){
      if(st.statut === "fp"){
        steps.push("Cadrer le projet avec le service RH / formation de l'administration");
        steps.push("Confirmer s'il faut mobiliser un cong\u00e9 de transition professionnelle ou un CFP");
      } else {
        steps.push("Prendre rendez-vous avec un CEP pour cadrer le projet et le calendrier");
        steps.push("Constituer puis d\u00e9poser le dossier Transitions Pro dans les d\u00e9lais");
      }
    } else if(best.id === "faf"){
      steps.push("Identifier le FAF comp\u00e9tent selon l'activit\u00e9 exerc\u00e9e");
      steps.push("V\u00e9rifier les bar\u00e8mes annuels et d\u00e9poser avant l'entr\u00e9e en formation");
    }

    const subtitleParts = [
      `Profil : ${statutLabel(st.statut)}`,
      `\u00c2ge : ${ageSummaryLabel(st.age)}`,
      `Formation : ${formationLabel(st.formation)}`,
      `CPF : ${formatEUR(st.cpf_amount || 0)}`,
      `PRF : ${prfLabel(prf.status)}`
    ];
    if(st.alternance === "oui") subtitleParts.push("Alternance : oui");
    if(st.employeur === "oui") subtitleParts.push("Employeur : identifi\u00e9");
    if(st.handicap === "oui") subtitleParts.push("RQTH : oui");

    return {
      actionsHtml: steps.slice(0, 3).map((item)=>`<li>${escapeHtml(item)}</li>`).join(""),
      bestTitle: displayPackTitle(best),
      minText: rr.min,
      rangeText: `Fourchette : ${rr.probable} \u2022 Optimiste : ${rr.opt}`,
      subtitle: subtitleParts.join(" \u2022 "),
      whoHtml: whoReceivesHTML(best.id, st, prf),
      whyText: (best.why && best.why.length) ? best.why[0] : "\u2014",
      eligibilityText,
      eligibilityDetailsHtml,
      compareHtml,
      confidenceLabel: confidence.label,
      confidenceClassName: confidence.summaryClassName || ""
    };
  }

  function renderResultsOverview({
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
  }){
    const renderWhyList = (pack)=>{
      const seenRefs = new Set();
      return pack.why.map((why, index)=>{
        const refs = (pack.whySources && pack.whySources[index]) ? pack.whySources[index] : (pack.dispositifNames || []);
        const refsHtml = sourcePills(refs, 2, { seen: seenRefs });
        return `
          <li>
            <div class="whylist__text">${escapeHtml(why)}</div>
            ${refsHtml ? `<div class="whylist__refs">${refsHtml}</div>` : ""}
          </li>
        `;
      }).join("");
    };

    const summary = buildSummaryData({
      best: top[0] || null,
      alternatives: top.slice(1),
      st,
      prf,
      resteTriplet,
      statutLabel,
      formationLabel,
      formatEUR,
      prfLabel,
      whoReceivesHTML
    });

    const cardsHtml = `<div class="cards">${top.map((pack, idx)=>{
      const cov = coverageForPack(pack.id, st);
      const rr = resteTriplet(pack.id, st);
      const miss = missingToImprove(pack.id, st, prf);
      const gauge = buildGaugeData(rr, formatEUR);
      const eligibilityHtml = renderEligibilityNotice(pack.eligibility);
      const confidence = getConfidenceData(pack);
      const regulationHtml = (pack.eligibility && Array.isArray(pack.eligibility.reasons) && pack.eligibility.reasons.length)
        ? `<div class="pack__regulation"><div class="pack__regulation-title">Base r\u00e9glementaire retenue</div><ul>${pack.eligibility.reasons.slice(0, 3).map((reason)=>`<li>${escapeHtml(reason)}</li>`).join("")}</ul></div>`
        : "";
      const dispoLinks = renderSourceList(pack.dispositifNames || []);

      const bestClass = (idx === 0) ? "pack pack--best" : "pack";
      const badge = (idx === 0)
        ? `<span class="badge badge--good pack__badge">Recommand\u00e9</span>`
        : `<span class="badge pack__badge">Sc\u00e9nario</span>`;

      const missingHtml = miss.length ? `
        <div class="missing">
          <div class="missing__title">Ce qu'il manque (cliquez pour voir comment faire)</div>
          <div class="misscards">
            ${miss.map((item)=>{
              const det = getMissingDetails(item, normalize);
              return `
                <div class="misscard" data-miss="${escapeHtml(item)}">
                  <div class="misscard__title">${escapeHtml(item)}</div>
                  <div class="misscard__meta">${escapeHtml(det.tagline)}</div>
                  <div class="misscard__cta"><i class="ri ri-information-line" aria-hidden="true"></i>Voir comment faire</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      ` : "";

      return `
        <article class="${bestClass}">
          <div class="pack__head">
            <div class="pack__title">${renderPackIcon(pack.id)}<span>${escapeHtml(displayPackTitle(pack))}</span></div>
            ${badge}
          </div>

          ${eligibilityHtml}
          <div class="pack__meta"><span class="pack__confidence${confidence.className || ""}">${escapeHtml(confidence.label)}</span></div>
          ${regulationHtml}

          <div class="sep"></div>

          <div class="kv">
            <div class="kv__label">Frais p\u00e9dagogiques</div><div class="kv__status">${renderCoverageIcon(cov.pedagogique)}</div><div class="kv__chips"><span class="chips"><span class="chip chip--org" data-tip="org" title="Versement principal vers l'organisme de formation"><i class="ri ri-building-4-line" aria-hidden="true"></i> Organisme</span></span></div>
            <div class="kv__label">R\u00e9mun\u00e9ration / indemnisation</div><div class="kv__status">${renderCoverageIcon(cov.remuneration)}</div><div class="kv__chips"><span class="chips"><span class="chip chip--pers" data-tip="pers" title="Versement principal vers la personne"><i class="ri ri-user-line" aria-hidden="true"></i> Personne</span></span></div>
            <div class="kv__label">Frais annexes</div><div class="kv__status">${renderCoverageIcon(cov.annexes)}</div><div class="kv__chips"><span class="chips"><span class="chip chip--pers" data-tip="pers" title="Versement principal vers la personne"><i class="ri ri-user-line" aria-hidden="true"></i> Personne</span></span></div>
            <div class="kv__label">\u00c9quipement</div><div class="kv__status">${renderCoverageIcon(cov.equipement)}</div><div class="kv__chips"><span class="chips"><span class="chip chip--mix" data-tip="mix" title="D\u00e9pend des dispositifs"><i class="ri ri-arrow-left-right-line" aria-hidden="true"></i> Variable</span></span></div>
            <div class="kv__label">Accompagnement</div><div class="kv__status">${renderCoverageIcon(cov.accompagnement)}</div><div class="kv__chips"><span class="chips"><span class="chip chip--mix" data-tip="mix" title="D\u00e9pend des dispositifs"><i class="ri ri-arrow-left-right-line" aria-hidden="true"></i> Variable</span></span></div>
          </div>

          <div class="sep"></div>

          <div class="gauge">
            <div class="gauge__label">Jauge - reste \u00e0 charge (frais p\u00e9dagogiques)</div>
            <div class="gauge__bar">
              <div class="gauge__fill" style="width:${gauge.fillPct}%"></div>
              <div class="gauge__marker" style="left:${gauge.markerPct}%"></div>
            </div>
            <div class="gauge__scale"><span>0 \u20ac</span><span>${escapeHtml(gauge.maxLabel)}</span></div>
            <div class="gauge__note">${escapeHtml(gauge.note)}</div>
          </div>

          <div class="kv3">
            <div class="rangebox">
              <div class="rangebox__k">Reste \u00e0 charge - min.</div>
              <div class="rangebox__v">${escapeHtml(rr.min)}</div>
              <div class="rangebox__h">Calculable (prudence).</div>
            </div>
            <div class="rangebox">
              <div class="rangebox__k">Reste \u00e0 charge - fourchette</div>
              <div class="rangebox__v">${escapeHtml(rr.probable)}</div>
              <div class="rangebox__h">D\u00e9pend d'instruction / enveloppes.</div>
            </div>
            <div class="rangebox">
              <div class="rangebox__k">Reste \u00e0 charge - optimiste</div>
              <div class="rangebox__v">${escapeHtml(rr.opt)}</div>
              <div class="rangebox__h">${escapeHtml(rr.hint)}</div>
            </div>
          </div>

          ${missingHtml}

          <div class="sep"></div>

          <div style="font-size:13px;">
            <div style="font-weight:800;">Pourquoi ce sc\u00e9nario ?</div>
            <ul class="whylist">${renderWhyList(pack)}</ul>
          </div>

          <div class="sep"></div>

          <div class="expert-only" style="font-size:13px;">
            <div style="font-weight:800;">Dispositifs associ\u00e9s (sources)</div>
            <div class="pack__source-list">${dispoLinks}</div>
          </div>
        </article>
      `;
    }).join("")}</div>`;

    return { cardsHtml, summary };
  }

  return {
    createTipModal,
    createWizardController,
    getMissingDetails,
    getTipContent,
    getWizardSteps,
    renderChoiceButton,
    renderResultsOverview
  };
});
