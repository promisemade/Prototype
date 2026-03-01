(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports){
    module.exports = api;
  }
  if(root){
    root.SimulatorCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  const META = { data_version: "V2.2", exported_on: "27/02/2026", territory: "Hauts-de-France" };
  const GENERIC_UNUSED_DISPOSITIFS = new Set([
    "Service public régional de la formation (exemple) + aides individuelles régionales"
  ]);

  function defaultState(){
    return {
      statut: "",
      age: "",
      handicap: "non",
      employeur: "non",
      alternance: "non",
      target_contract: "unknown",
      ptp_seniority: "unknown",
      apprentissage_exception: "unknown",
      contratpro_case: "unknown",
      allocation_ft: "unknown",
      territoire: "hdf",
      formation: "",
      prf_simple: "nspp",
      cost_peda: 0,
      cpf_amount: 0,
      cpf_action: "unknown",
      needs: {transport:false, hebergement:false, equipement:false}
    };
  }

  function normalize(value){
    return String(value || "").toLowerCase();
  }

  function hasAny(text, keywords){
    const haystack = normalize(text);
    return (keywords || []).some((keyword) => haystack.includes(keyword));
  }

  function formatEUR(value){
    try{
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0
      }).format(value);
    }catch{
      return `${Math.round(value)} €`;
    }
  }

  function statutLabel(code){
    return {
      de: "Demandeur d'emploi",
      sal: "Salarié",
      ind: "Indépendant / non-salarié",
      jeune: "Jeune (insertion)",
      alt: "Alternance",
      fp: "Agent public"
    }[code] || "-";
  }

  function formationLabel(code){
    return {
      bafa: "BAFA / BAFD",
      bnssa: "BNSSA / MNS",
      cpjeps: "CPJEPS",
      bpjeps: "BPJEPS",
      dejeps: "DEJEPS",
      desjeps: "DESJEPS",
      cqp: "CQP",
      autre: "Autre / je ne sais pas"
    }[code] || "-";
  }

  function prfLabel(status){
    return {
      confirmed: "confirmé",
      not_confirmed: "non confirmé",
      unknown: "à vérifier"
    }[status] || "à vérifier";
  }

  function detectPRF(state){
    if(state.prf_simple === "oui") return {status:"confirmed", why:"Confirmation (mail/convocation/prescription)"};
    if(state.prf_simple === "non") return {status:"not_confirmed", why:"Pas de confirmation"};
    return {status:"unknown", why:"À vérifier"};
  }

  function ageBand(value){
    const age = String(value || "");
    return ["<26", "26-29", "30-35", "36-44", "45+", "36+", "30+"].includes(age) ? age : "unknown";
  }

  function isAge30Plus(age){
    return age === "30+" || age === "30-35" || age === "36+" || age === "36-44" || age === "45+";
  }

  function isAge36Plus(age){
    return age === "36+" || age === "36-44" || age === "45+";
  }

  function isAge45Plus(age){
    return age === "45+";
  }

  function targetContractBand(value){
    const target = String(value || "");
    return ["12plus", "6to11", "none", "unknown"].includes(target) ? target : "unknown";
  }

  function apprentissageExceptionBand(value){
    const exception = String(value || "");
    return ["none", "handicap", "creation", "sport", "suite", "exam", "unknown"].includes(exception)
      ? exception
      : "unknown";
  }

  function contratProCaseBand(value){
    const proCase = String(value || "");
    return ["none", "rsa", "ass", "aah", "cui", "unknown"].includes(proCase)
      ? proCase
      : "unknown";
  }

  function worsenStatus(current, next){
    const rank = { eligible: 0, conditional: 1, ineligible: 2 };
    return rank[next] > rank[current] ? next : current;
  }

  function evaluatePackEligibility(id, state, prf){
    const st = {...defaultState(), ...state};
    const age = ageBand(st.age);
    const targetContract = targetContractBand(st.target_contract);
    const apprentissageException = apprentissageExceptionBand(st.apprentissage_exception);
    const contratProCase = contratProCaseBand(st.contratpro_case);
    const reasons = [];
    let status = "eligible";
    let note = "";

    if(id === "apprentissage"){
      if(st.alternance === "non"){
        status = "ineligible";
        reasons.push("L'apprentissage suppose une formation en alternance.");
      }else if(st.alternance !== "oui"){
        status = worsenStatus(status, "conditional");
        reasons.push("Valider que la formation se fait bien en alternance.");
      }

      if(age === "unknown"){
        status = worsenStatus(status, "conditional");
        reasons.push("\u00c2ge \u00e0 confirmer : l'apprentissage vise en principe les 16-29 ans r\u00e9volus.");
      }else if(isAge30Plus(age)){
        if(st.handicap === "oui" || apprentissageException === "handicap"){
          status = worsenStatus(status, "conditional");
          reasons.push("Exception d'\u00e2ge possible en apprentissage en cas de handicap.");
        }else if(apprentissageException === "creation"){
          status = worsenStatus(status, "conditional");
          reasons.push("Exception d'\u00e2ge possible en cas de cr\u00e9ation ou reprise d'entreprise.");
        }else if(apprentissageException === "sport"){
          status = worsenStatus(status, "conditional");
          reasons.push("Exception d'\u00e2ge possible pour les sportifs de haut niveau.");
        }else if(apprentissageException === "exam"){
          status = worsenStatus(status, "conditional");
          reasons.push("Prolongation possible si le contrat est prolong\u00e9 apr\u00e8s un \u00e9chec \u00e0 l'examen.");
        }else if(apprentissageException === "suite"){
          if(isAge36Plus(age)){
            status = "ineligible";
            reasons.push("La poursuite en apprentissage apr\u00e8s un premier contrat vise en pratique les 30-35 ans.");
          }else{
            status = worsenStatus(status, "conditional");
            reasons.push("Exception d'\u00e2ge possible pour une poursuite de parcours en apprentissage.");
          }
        }else if(apprentissageException === "none"){
          status = "ineligible";
          reasons.push("Sans d\u00e9rogation identifi\u00e9e, l'apprentissage est en principe limit\u00e9 \u00e0 29 ans r\u00e9volus.");
        }else{
          status = worsenStatus(status, "conditional");
          reasons.push("Au-del\u00e0 de 29 ans, il faut confirmer l'existence d'une d\u00e9rogation d'\u00e2ge.");
        }
      }

      if(st.employeur !== "oui"){
        status = worsenStatus(status, "conditional");
        reasons.push("Un employeur ou une promesse d'embauche reste n\u00e9cessaire.");
      }

      note = (status === "ineligible")
        ? "Non prioritaire selon l'\u00e2ge ou l'absence d'alternance."
        : (status === "conditional" ? "\u00c0 confirmer : \u00e2ge, alternance ou employeur." : "\u00c9ligibilit\u00e9 coh\u00e9rente avec les informations saisies.");
    }else if(id === "contratpro"){
      if(st.alternance === "non"){
        status = "ineligible";
        reasons.push("Le contrat de professionnalisation suppose une alternance.");
      }else if(st.alternance !== "oui"){
        status = worsenStatus(status, "conditional");
        reasons.push("Valider que la formation se fait bien en alternance.");
      }

      if(age === "unknown"){
        status = worsenStatus(status, "conditional");
        reasons.push("\u00c2ge \u00e0 confirmer : le contrat pro d\u00e9pend fortement de l'\u00e2ge et du statut.");
      }else if(age === "<26"){
        reasons.push("Le contrat pro est accessible avant 26 ans sous r\u00e9serve du contrat et de l'employeur.");
      }else if(st.statut === "de"){
        reasons.push("Apr\u00e8s 26 ans, le contrat pro reste ouvert aux demandeurs d'emploi.");
        if(isAge45Plus(age)){
          reasons.push("Pour l'employeur, les aides 26+ et 45+ peuvent se cumuler jusqu'à 4 000 € sous conditions, avec demande dans les 3 mois.");
        }else{
          reasons.push("Pour l'employeur, une aide France Travail 26+ peut \u00eatre mobilisable, sous conditions et demande dans les 3 mois.");
        }
      }else if(contratProCase === "rsa"){
        reasons.push("Apr\u00e8s 26 ans, le contrat pro reste ouvert aux b\u00e9n\u00e9ficiaires du RSA.");
      }else if(contratProCase === "ass"){
        reasons.push("Apr\u00e8s 26 ans, le contrat pro reste ouvert aux b\u00e9n\u00e9ficiaires de l'ASS.");
      }else if(contratProCase === "aah"){
        reasons.push("Apr\u00e8s 26 ans, le contrat pro reste ouvert aux b\u00e9n\u00e9ficiaires de l'AAH.");
        reasons.push("Des aides employeur li\u00e9es au handicap peuvent s'ajouter, \u00e0 confirmer selon le dossier.");
      }else if(contratProCase === "cui"){
        reasons.push("Apr\u00e8s 26 ans, le contrat pro reste ouvert aux personnes sortant d'un CUI.");
      }else if(contratProCase === "unknown"){
        status = worsenStatus(status, "conditional");
        reasons.push("Apr\u00e8s 26 ans, il faut confirmer si vous relevez d'un cas ouvrant le contrat pro : demandeur d'emploi, RSA, ASS, AAH ou sortie de CUI.");
      }else if(st.handicap === "oui"){
        status = worsenStatus(status, "conditional");
        reasons.push("Le handicap seul n'ouvre pas automatiquement le contrat pro apr\u00e8s 26 ans : v\u00e9rifier notamment l'AAH.");
      }else{
        status = "ineligible";
        reasons.push("Apr\u00e8s 26 ans, le contrat pro vise surtout les demandeurs d'emploi ou certains b\u00e9n\u00e9ficiaires (RSA, ASS, AAH, sortie de CUI).");
      }

      if(st.employeur !== "oui"){
        status = worsenStatus(status, "conditional");
        reasons.push("Un employeur ou une promesse d'embauche reste n\u00e9cessaire.");
      }

      note = (status === "ineligible")
        ? "Non prioritaire selon l'\u00e2ge ou le statut saisi."
        : (status === "conditional" ? "\u00c0 confirmer : \u00e2ge, cas d'ouverture apr\u00e8s 26 ans ou employeur." : "\u00c9ligibilit\u00e9 coh\u00e9rente avec les informations saisies.");
    }else if(id === "ptp"){
      if(st.statut === "sal"){
        if(st.ptp_seniority === "ok"){
          status = "eligible";
          reasons.push("Le profil salari\u00e9 et l'anciennet\u00e9 d\u00e9clar\u00e9e sont coh\u00e9rents avec un PTP.");
        }else if(st.ptp_seniority === "special"){
          status = "conditional";
          reasons.push("Le PTP peut rester possible dans certains cas particuliers, \u00e0 confirmer avec CEP / Transitions Pro.");
        }else if(st.ptp_seniority === "no"){
          status = "ineligible";
          reasons.push("Au vu des informations saisies, l'anciennet\u00e9 para\u00eet insuffisante pour un PTP standard.");
        }else{
          status = "conditional";
          reasons.push("Le PTP reste soumis \u00e0 l'anciennet\u00e9, au projet et aux d\u00e9lais de d\u00e9p\u00f4t.");
        }
      }else if(st.statut === "fp"){
        status = "conditional";
        reasons.push("En fonction publique, des r\u00e8gles sp\u00e9cifiques s'appliquent et doivent \u00eatre confirm\u00e9es.");
      }else{
        status = "ineligible";
        reasons.push("Le PTP cible d'abord les salari\u00e9s en poste.");
      }

note = (status === "ineligible")
        ? "Non prioritaire selon le statut ou l'anciennet\u00e9 saisis."
        : (status === "eligible"
          ? "\u00c9ligibilit\u00e9 PTP plausible sous r\u00e9serve du dossier."
          : "\u00c0 confirmer : anciennet\u00e9, calendrier et recevabilit\u00e9 du dossier.");
    }else if(id === "prf"){
      if(st.statut !== "de" && st.statut !== "jeune"){
        status = "ineligible";
        reasons.push("Les places PRF/SFER/AFC visent d'abord les demandeurs d'emploi ou jeunes en insertion.");
        note = "Non prioritaire selon le statut saisi.";
      }else if(prf && prf.status === "confirmed"){
        status = "eligible";
        reasons.push("Une session financée collectivement semble confirmée (PRF/SFER/AFC).");
        reasons.push("En principe, les frais pédagogiques sont alors déjà pris en charge.");
        note = "Piste solide si l'entrée en formation est bien validée.";
      }else if(prf && prf.status === "unknown"){
        status = "conditional";
        reasons.push("Avant CPF/AIF, il faut vérifier si une place PRF/SFER/AFC existe sur la session visée.");
        reasons.push("Si la session est financée collectivement, les frais pédagogiques sont en général déjà couverts.");
        note = "À confirmer via C2RP, PRIF ou France Travail.";
      }else{
        status = "ineligible";
        reasons.push("Vous avez indiqué qu'aucune prise en charge collective PRF/SFER n'était confirmée.");
        note = "Non prioritaire si la session n'est pas financée collectivement.";
      }
    }else if(id === "faf"){
      if(st.statut !== "ind"){
        status = "ineligible";
        reasons.push("Les FAF concernent les travailleurs ind\u00e9pendants.");
        note = "Non prioritaire selon le statut saisi.";
      }else{
        status = "conditional";
        reasons.push("Le FAF d\u00e9pend de l'activit\u00e9, de la CFP et du fonds comp\u00e9tent.");
        note = "\u00c0 confirmer selon l'activit\u00e9 et le FAF comp\u00e9tent.";
      }
    }else if(id === "cpf"){
      if(st.formation === "bafa"){
        status = "conditional";
        reasons.push("Le BAFA/BAFD n'entre pas dans le p\u00e9rim\u00e8tre CPF habituel ; v\u00e9rifier l'\u00e9ligibilit\u00e9 exacte de l'offre.");
        note = "\u00c9ligibilit\u00e9 CPF \u00e0 v\u00e9rifier pour cette formation.";
      }else if(["bpjeps", "cpjeps", "dejeps", "desjeps"].includes(st.formation)){
        status = "conditional";
        reasons.push("Le CPF suppose une session bien r\u00e9f\u00e9renc\u00e9e sur Mon Compte Formation.");
        note = "\u00c0 confirmer sur Mon Compte Formation.";
      }else if(st.formation === "cqp" || st.formation === "bnssa" || st.formation === "autre" || !st.formation){
        status = "conditional";
        reasons.push("L'\u00e9ligibilit\u00e9 CPF d\u00e9pend du code RNCP/RS ou du r\u00e9f\u00e9rencement de l'offre.");
        note = "\u00c9ligibilit\u00e9 CPF \u00e0 confirmer.";
      }

      const restCpf = Math.max(0, Number(st.cost_peda || 0) - Math.min(Number(st.cost_peda || 0), Number(st.cpf_amount || 0)));
      if(st.statut === "de" || st.statut === "jeune"){
        if(restCpf > 0){
          reasons.push("Avant une AIF, il faut d'abord vérifier si la formation n'est pas déjà financée via une place PRF/SFER ou AFC.");
          reasons.push("Si les droits CPF sont insuffisants, un abondement France Travail peut compléter tout ou partie du reste à charge après validation du conseiller.");
          reasons.push("Si le montage CPF ne suffit pas, une AIF peut aussi être étudiée quand les autres financements sont insuffisants.");
          reasons.push("En Hauts-de-France, un abondement régional peut s'ajouter selon le dispositif et les critères de la session.");
          note = note || "À confirmer avec France Travail et, selon le cas, avec la Région.";
        }else if(Number(st.cpf_amount || 0) > 0){
          reasons.push("Le CPF peut couvrir seul les frais pédagogiques si l'offre est bien éligible et le montant suffisant.");
        }else{
          reasons.push("Sans droits CPF mobilisables, il faut plutôt regarder l'AIF, la Région ou un autre financeur principal.");
          status = worsenStatus(status, "conditional");
          note = note || "À confirmer : CPF faible ou nul, abondement ou autre financeur à rechercher.";
        }
      }else if(st.statut === "sal" || st.statut === "fp"){
        if(restCpf > 0){
          reasons.push("Le CPF peut être complété par l'employeur, l'OPCO ou, selon le projet, par un PTP.");
        }else if(Number(st.cpf_amount || 0) > 0){
          reasons.push("Le CPF peut suffire si l'offre est éligible et le montant disponible couvre le coût.");
        }
      }else if(st.statut === "ind"){
        reasons.push("Le CPF peut se combiner avec un FAF selon l'activité et le fonds compétent.");
      }
    }

    if(id === "prf" && prf && prf.status !== "confirmed"){
      status = worsenStatus(status, "conditional");
      reasons.push("Le reste \u00e0 charge nul suppose une session PRF/SFER confirm\u00e9e.");
      note = "\u00c0 confirmer via PRF/SFER.";
    }

    if(id === "contratpro" && targetContract === "none"){
      status = worsenStatus(status, "conditional");
      reasons.push("Le type de contrat vis\u00e9 reste \u00e0 confirmer.");
    }

    return { status, note, reasons };
  }

  function buildPacks(state){
    const st = {...defaultState(), ...state};
    const prf = detectPRF(st);
    const age = ageBand(st.age);
    const apprentissageException = apprentissageExceptionBand(st.apprentissage_exception);
    const contratProCase = contratProCaseBand(st.contratpro_case);
    const packs = [];

    let apprentissageScore = 0;
    if(st.alternance === "oui") apprentissageScore += 35;
    if(st.employeur === "oui") apprentissageScore += 35;
    if(["bpjeps","dejeps","desjeps","cpjeps","cqp","bnssa"].includes(st.formation)) apprentissageScore += 10;
    if(st.formation === "bafa") apprentissageScore -= 20;
    if(age === "<26" || age === "26-29") apprentissageScore += 6;
    if(isAge30Plus(age)){
      apprentissageScore -= (apprentissageException !== "unknown" && apprentissageException !== "none") ? 10 : 18;
    }
    packs.push({
      id: "apprentissage",
      title: "Alternance - apprentissage",
      score: apprentissageScore,
      why: [
        "Solution prioritaire si l'alternance est possible et qu'un employeur est identifié.",
        "En pratique, les frais pédagogiques sont en général financés par le CFA / l'OPCO, et la personne est rémunérée par un salaire.",
        "À vérifier : l'âge, l'employeur, le calendrier CFA et les aides annexes possibles (THR / équipement)."
      ],
      whySources: [
        ["Contrat d'apprentissage - financement et aides employeur"],
        ["Contrat d'apprentissage - financement et aides employeur"],
        ["Contrat d'apprentissage - financement et aides employeur", "Carte Génération #HDF (apprentis) - équipement + aides THR"]
      ],
      dispositifNames: [
        "Contrat d'apprentissage - financement et aides employeur",
        "Carte Génération #HDF (apprentis) - équipement + aides THR"
      ]
    });

    let contratProScore = 0;
    if(st.alternance === "oui") contratProScore += 25;
    if(st.employeur === "oui") contratProScore += 30;
    if(["26-29", "30+", "30-35", "36+", "36-44", "45+"].includes(age)) contratProScore += 8;
    if(isAge30Plus(age)) contratProScore += 12;
    if(st.statut === "de" || ["rsa", "ass", "aah", "cui"].includes(contratProCase)) contratProScore += 6;
    if(st.formation === "bafa") contratProScore -= 15;
    packs.push({
      id: "contratpro",
      title: "Alternance - contrat de professionnalisation",
      score: contratProScore,
      why: [
        "Alternative à l'apprentissage si l'alternance est possible et qu'un employeur est identifié.",
        "En pratique, les frais pédagogiques sont pris en charge via l'employeur / l'OPCO et la personne est rémunérée par contrat.",
        "À vérifier : l'âge, le cas d'ouverture après 26 ans et les aides employeur mobilisables."
      ],
      whySources: [
        ["Contrat de professionnalisation - aides employeur (DE 26+ / 45+ / handicap)"],
        ["Contrat de professionnalisation - aides employeur (DE 26+ / 45+ / handicap)"],
        ["Contrat de professionnalisation - aides employeur (DE 26+ / 45+ / handicap)"]
      ],
      dispositifNames: ["Contrat de professionnalisation - aides employeur (DE 26+ / 45+ / handicap)"]
    });

    if(st.statut === "de" || st.statut === "jeune"){
      const prfScore = prf.status === "confirmed" ? 85 : (prf.status === "unknown" ? 44 : -20);
      const prfRegionalLabel = "PRF 2025 - SFER (Se Former pour un Emploi en R\u00e9gion) : Parcours D\u00e9couverte / Qualifiant / Perfectionnement";
      const prfEntryPointLabel = "Proch\u2019Info-Formation (PRIF)";
      const prfWhy = prf.status === "confirmed"
        ? [
            "Une session collective PRF / SFER / AFC semble confirmée pour cette formation.",
            "En pratique, les frais pédagogiques sont alors normalement déjà pris en charge par le financeur de la session.",
            "À vérifier : l'entrée validée, la convocation / prescription et la rémunération pendant la formation."
          ]
        : [
            "À vérifier en premier : une place PRF / SFER / AFC peut éviter de mobiliser le CPF ou une AIF.",
            "Si la session est financée collectivement, les frais pédagogiques sont en général déjà pris en charge.",
            "À confirmer via C2RP, PRIF ou France Travail avant tout autre montage."
          ];
      packs.push({
        id: "prf",
        title: "Session collective financée (PRF / SFER / AFC)",
        score: prfScore,
        why: prfWhy,
        whySources: [
          ["PRF 2025 - SFER (Se Former pour un Emploi en Région) - Découverte/Qualifiant/Perfectionnement"],
          ["Programme régional de formation", "Action de formation conventionnée"],
          ["Programme régional de formation", "Action de formation conventionnée"]
        ],
        dispositifNames: [
          "PRF 2025 - SFER (Se Former pour un Emploi en Région) - Découverte/Qualifiant/Perfectionnement",
          "Programme régional de formation",
          "Action de formation conventionnée"
        ]
      });
      packs[packs.length - 1].whySources = [
        [prfRegionalLabel],
        [prfRegionalLabel, prfEntryPointLabel],
        [prfRegionalLabel, prfEntryPointLabel]
      ];
      packs[packs.length - 1].dispositifNames = [
        prfRegionalLabel,
        prfEntryPointLabel
      ];
    }

    let cpfScore = 25;
    if(st.cpf_amount > 0) cpfScore += 15;
    if(st.cost_peda > st.cpf_amount) cpfScore += 10;
    if(st.statut === "sal") cpfScore += 10;
    if(st.statut === "de") cpfScore += 12;
    const cpfWhy = ["Piste utile si la formation est bien éligible au CPF."];
    const cpfWhySources = [["Compte personnel de formation"]];
    const cpfDispositifs = ["Compte personnel de formation"];
    if((st.statut === "de" || st.statut === "jeune") && Number(st.cost_peda || 0) > Number(st.cpf_amount || 0)){
      cpfWhy[0] = "Piste utile si la formation est éligible CPF et qu'aucune place collective PRF / SFER / AFC n'est confirmée.";
      cpfWhy.push("En pratique, on mobilise d'abord le CPF ; si cela ne suffit pas, on regarde ensuite un abondement France Travail, une AIF ou un abondement Région selon la session.");
      cpfWhy.push("À vérifier : l'éligibilité Mon Compte Formation, le reste à charge, l'ordre des demandes et la validation du conseiller.");
      cpfWhySources.push(["Compte personnel de formation", "Abondement France Travail sur un dossier CPF (financement complémentaire)"]);
      cpfWhySources.push(["Compte personnel de formation", "Aide individuelle à la formation", "Chèque Pass Formation / Pass Formation (abondement CPF)"]);
      cpfDispositifs.push("Abondement France Travail sur un dossier CPF (financement complémentaire)", "Aide individuelle à la formation", "Chèque Pass Formation / Pass Formation (abondement CPF)", "Chèque Pass Formation Sup (abondement CPF - formations ciblées)");
      for(let i = cpfDispositifs.length - 1; i >= 0; i--){
        if(normalize(cpfDispositifs[i]).includes("aide individuelle")){
          cpfDispositifs.splice(i, 1);
        }
      }
    }else if(st.statut === "sal" || st.statut === "fp"){
      cpfWhy[0] = "Piste utile si la formation est éligible CPF et que le projet est porté par l'employeur ou en reconversion.";
      cpfWhy.push("En pratique, le CPF finance une première part ; l'employeur, l'OPCO ou un PTP peut compléter selon le projet.");
      cpfWhy.push("À vérifier : l'éligibilité Mon Compte Formation, l'abondement employeur / OPCO et l'articulation éventuelle avec un PTP.");
      cpfWhySources.push(["Compte personnel de formation"]);
      cpfWhySources.push(["Compte personnel de formation", "Projet de transition professionnelle"]);
    }else if(st.statut === "ind"){
      cpfWhy[0] = "Piste utile si la formation est éligible CPF pour un travailleur indépendant.";
      cpfWhy.push("En pratique, le CPF finance une première part, puis le FAF compétent peut compléter selon l'activité et les barèmes annuels.");
      cpfWhy.push("À vérifier : le code de formation, le FAF compétent et les plafonds annuels.");
      cpfWhySources.push(["Compte personnel de formation", "CPF des travailleurs indépendants"]);
      cpfWhySources.push(["CPF des travailleurs indépendants", "FIF PL - financement formation professions libérales"]);
      cpfDispositifs.push("CPF des travailleurs indépendants");
    }else{
      cpfWhy.push("En pratique, le CPF sert de base, puis un financeur complémentaire peut intervenir sur le reste à charge (employeur, France Travail, Région, reconversion).");
      cpfWhy.push("À vérifier : l'éligibilité Mon Compte Formation et le bon complément selon le statut.");
      cpfWhySources.push(["Compte personnel de formation", "Abondement France Travail sur un dossier CPF (financement complémentaire)"]);
      cpfWhySources.push(["Compte personnel de formation", "Chèque Pass Formation / Pass Formation (abondement CPF)"]);
      cpfDispositifs.push("Abondement France Travail sur un dossier CPF (financement complémentaire)", "Chèque Pass Formation / Pass Formation (abondement CPF)", "Chèque Pass Formation Sup (abondement CPF - formations ciblées)");
    }
    packs.push({
      id: "cpf",
      title: "CPF + abondements (France Travail / Région HDF / employeur-OPCO)",
      score: cpfScore,
      why: cpfWhy,
      whySources: cpfWhySources,
      dispositifNames: [...new Set(cpfDispositifs)]
    });

    let ptpScore = 0;
    if(st.statut === "sal" || st.statut === "fp") ptpScore += 55;
    if(st.cost_peda > 0) ptpScore += 5;
    packs.push({
      id: "ptp",
      title: "Salariés - Projet de transition professionnelle (PTP)",
      score: ptpScore,
      why: [
        "Adapté aux salariés qui changent de métier ou s'engagent dans une reconversion structurée.",
        "En pratique, le PTP peut financer les frais pédagogiques et maintenir tout ou partie de la rémunération si le dossier est accepté.",
        "À vérifier : l'ancienneté, le calendrier, le CEP et le dépôt du dossier chez Transitions Pro."
      ],
      whySources: [
        ["Projet de transition professionnelle"],
        ["Projet de transition professionnelle"],
        ["Projet de transition professionnelle", "Conseil en évolution professionnelle"]
      ],
      dispositifNames: ["Projet de transition professionnelle", "Conseil en évolution professionnelle"]
    });

    let fafScore = 0;
    if(st.statut === "ind") fafScore += 60;
    if(st.cpf_amount > 0) fafScore += 6;
    packs.push({
      id: "faf",
      title: "Non-salariés - CPF + FAF (FIFPL / AGEFICE / FAFCEA...)",
      score: fafScore,
      why: [
        "Adapté aux indépendants lorsqu'un FAF existe pour l'activité exercée.",
        "En pratique, le FAF peut compléter ou prendre en charge une partie du coût, parfois en articulation avec le CPF.",
        "À vérifier : le FAF compétent, les barèmes annuels, les délais et les pièces à fournir."
      ],
      whySources: [
        ["CPF des travailleurs indépendants"],
        ["CPF des travailleurs indépendants", "FIF PL - financement formation professions libérales"],
        ["FIF PL - financement formation professions libérales", "AGEFICE - financement formation dirigeants non-salariés", "FAFCEA - financement formation artisans"]
      ],
      dispositifNames: [
        "CPF des travailleurs indépendants",
        "FIF PL - financement formation professions libérales",
        "AGEFICE - financement formation dirigeants non-salariés",
        "FAFCEA - financement formation artisans"
      ]
    });

    if(st.handicap === "oui"){
      for(const pack of packs) pack.score += 10;
    }

    if(st.alternance === "non"){
      packs.find((pack) => pack.id === "apprentissage").score -= 35;
      packs.find((pack) => pack.id === "contratpro").score -= 25;
    }
    if(st.employeur === "non"){
      packs.find((pack) => pack.id === "apprentissage").score -= 30;
      packs.find((pack) => pack.id === "contratpro").score -= 25;
    }
    if(st.statut !== "sal" && st.statut !== "fp") packs.find((pack) => pack.id === "ptp").score -= 40;
    if(st.statut !== "ind") packs.find((pack) => pack.id === "faf").score -= 30;

    for(const pack of packs){
      pack.eligibility = evaluatePackEligibility(pack.id, st, prf);
      if(pack.eligibility.status === "ineligible") pack.score -= 1000;
      else if(pack.eligibility.status === "conditional") pack.score -= 8;
    }

    packs.sort((left, right) => right.score - left.score);
    return {packs, prf};
  }

  function coverageForPack(id, state){
    if(id === "apprentissage"){
      const annexes = (state.needs && (state.needs.transport || state.needs.hebergement))
        ? "◐ (THR / mobilité)"
        : "◐";
      const equipement = (state.needs && state.needs.equipement)
        ? "◐ (équipement apprenti)"
        : "◐";
      return {pedagogique:"✓", remuneration:"✓ (salaire)", annexes, equipement, accompagnement:"◐"};
    }
    if(id === "contratpro"){
      const annexes = (state.needs && (state.needs.transport || state.needs.hebergement))
        ? "◐ (mobilité selon aides)"
        : "◐";
      const equipement = (state.needs && state.needs.equipement)
        ? "◐ (selon employeur / aides)"
        : "◐";
      return {pedagogique:"✓", remuneration:"✓ (salaire)", annexes, equipement, accompagnement:"◐"};
    }
    if(id === "prf"){
      let remuneration = "—";
      let annexes = "◐";
      if(state.statut === "de" || state.statut === "jeune"){
        if(state.allocation_ft === "are") remuneration = "✓ (AREF puis RFF selon droits)";
        else if(state.allocation_ft === "none") remuneration = "◐ (RFFT selon cas)";
        else remuneration = "◐ (AREF/RFFT selon cas)";
        if(state.needs && (state.needs.transport || state.needs.hebergement)) annexes = "◐ (aide mobilité FT)";
      }
      return {pedagogique:"✓", remuneration, annexes, equipement:"—", accompagnement:"◐"};
    }
    if(id === "cpf"){
      const annexes = (state.needs && (state.needs.transport || state.needs.hebergement))
        ? "◐ (FT / Région selon cas)"
        : "◐";
      return {pedagogique:"✓", remuneration:"—", annexes, equipement:"—", accompagnement:"◐ (CEP/PRIF)"};
    }
    if(id === "ptp") return {pedagogique:"✓", remuneration:"◐ (selon cas)", annexes:"◐", equipement:"—", accompagnement:"◐"};
    if(id === "faf") return {pedagogique:"◐", remuneration:"—", annexes:"—", equipement:"—", accompagnement:"◐"};
    return {pedagogique:"—", remuneration:"—", annexes:"—", equipement:"—", accompagnement:"—"};
  }

  function resteTriplet(packId, state){
    const st = {...defaultState(), ...state};
    const cost = Number(st.cost_peda || 0);
    const cpf = Number(st.cpf_amount || 0);
    const hasCost = cost > 0;

    let min = "—";
    let probable = "—";
    let opt = "—";
    let hint = "";
    let minValue = null;
    let maxValue = null;

    if(packId === "apprentissage" || packId === "contratpro"){
      min = hasCost ? "0 €" : "0 € (si contrat)";
      probable = "0 €";
      opt = "0 €";
      hint = "Sous réserve de signature du contrat et prise en charge OPCO/CFA.";
      minValue = 0;
      maxValue = 0;
      return {min, probable, opt, hint, minValue, maxValue};
    }

    if(packId === "prf"){
      min = "0 €";
      probable = "0 €";
      opt = "0 €";
      hint = "Sous réserve d'entrée validée (prescription/convocation).";
      minValue = 0;
      maxValue = 0;
      return {min, probable, opt, hint, minValue, maxValue};
    }

    if(packId === "ptp"){
      min = "0 € (si accepté)";
      probable = "0 € (si accepté)";
      opt = "0 €";
      hint = "Dépend de l'acceptation du dossier.";
      return {min, probable, opt, hint, minValue, maxValue};
    }

    if(packId === "cpf"){
      const caps = { rs: 1500, bilan: 1600, permis: 900 };
      const cap = (st.cpf_action && caps[st.cpf_action]) ? caps[st.cpf_action] : null;
      const effectiveCpf = cap !== null ? Math.min(cpf, cap) : cpf;
      const rest = Math.max(0, cost - Math.min(cost, effectiveCpf));

      min = hasCost ? formatEUR(rest) : "—";
      if(hasCost){
        minValue = rest;
        maxValue = rest;
      }

      let canGoToZero = false;
      if(st.statut === "de" || st.statut === "jeune") canGoToZero = true;
      if(st.statut === "sal" || st.statut === "fp") canGoToZero = true;
      if(st.statut === "ind") canGoToZero = true;

      probable = hasCost ? (canGoToZero ? `entre 0 € et ${formatEUR(rest)}` : formatEUR(rest)) : "—";
      opt = hasCost ? (canGoToZero ? "0 €" : formatEUR(rest)) : "—";

      if(cap !== null){
        hint = `Plafond CPF appliqué (${formatEUR(cap)} max mobilisable pour ce type d'action). Minimum calculé avec CPF plafonné.`;
      } else {
        hint = hasCost
          ? "Minimum = CPF saisi. Si votre action est RS/bilan/permis, un plafond peut s'appliquer (décret 2026-127)."
          : "Renseignez un coût pour calculer.";
      }
      return {min, probable, opt, hint, minValue, maxValue};
    }

    if(packId === "faf"){
      const rest = Math.max(0, cost - Math.min(cost, cpf));
      min = hasCost ? formatEUR(rest) : "—";
      if(hasCost){
        minValue = rest;
        maxValue = rest;
      }
      probable = hasCost ? `entre 0 € et ${formatEUR(rest)}` : "—";
      opt = hasCost ? "0 €" : "—";
      hint = "Complément selon FAF et barèmes annuels.";
      return {min, probable, opt, hint, minValue, maxValue};
    }

    return {min, probable, opt, hint, minValue, maxValue};
  }

  function missingToImprove(bestPackId, state, prf){
    const st = {...defaultState(), ...state};
    const missing = [];
    const cost = Number(st.cost_peda || 0);
    const cpf = Number(st.cpf_amount || 0);
    const restCpf = Math.max(0, cost - Math.min(cost, cpf));

    if(bestPackId === "apprentissage" || bestPackId === "contratpro"){
      if(st.employeur !== "oui") missing.push("Trouver un employeur (promesse d'embauche / contrat)");
      if(st.alternance !== "oui") missing.push("Valider que la formation est bien en alternance (CFA/OF)");
      missing.push("Constituer le dossier CFA (calendrier, pièces administratives)");
    } else if(bestPackId === "prf"){
      missing.push("Obtenir/Conserver une confirmation d'entrée (convocation/prescription)");
    } else if(bestPackId === "cpf"){
      if(restCpf > 0){
        if(st.statut === "de" || st.statut === "jeune") missing.push("Demander un complément via France Travail (selon projet)");
        missing.push("Vérifier si un chèque/abondement Région HDF est mobilisable (selon critères)");
        if(st.statut === "sal" || st.statut === "fp") missing.push("Vérifier un financement employeur/OPCO ou un PTP");
      }
      missing.push("Vérifier l'éligibilité CPF de la formation (lien MCF / code RNCP/RS)");
    } else if(bestPackId === "ptp"){
      missing.push("Prendre un rendez-vous CEP et vérifier l'éligibilité");
      missing.push("Préparer et déposer le dossier PTP dans les délais");
    } else if(bestPackId === "faf"){
      missing.push("Identifier le FAF compétent (selon activité) et déposer une demande");
    } else if((st.statut === "de" || st.statut === "jeune") && prf.status !== "confirmed"){
      missing.push("Vérifier si la session est financée collectivement (PRF/SFER/AFC) via C2RP, PRIF ou France Travail");
    }

    if(st.handicap === "oui") missing.push("Si pertinent : contacter Cap emploi / Agefiph/FIPHFP pour aides dédiées");
    if(st.needs.transport || st.needs.hebergement || st.needs.equipement){
      missing.push("Prévoir justificatifs (transport/hébergement/équipement) pour solliciter des aides annexes");
    }

    return missing.slice(0, 6);
  }

  function missingToImprove(bestPackId, state, prf){
    const st = {...defaultState(), ...state};
    const missing = [];
    const cost = Number(st.cost_peda || 0);
    const cpf = Number(st.cpf_amount || 0);
    const restCpf = Math.max(0, cost - Math.min(cost, cpf));
    const age = ageBand(st.age);
    const hasMobilityNeed = !!(st.needs.transport || st.needs.hebergement);
    const hasAnyAnnexNeed = !!(hasMobilityNeed || st.needs.equipement);
    const logementAlternanceLabelSafe = (age === "<26" || age === "26-29" || age === "unknown")
      ? "V\u00e9rifier Mobili-Jeune et l'avance Loca-Pass si un logement est n\u00e9cessaire pour l'alternance"
      : "V\u00e9rifier surtout l'avance Loca-Pass si un logement est n\u00e9cessaire pour l'alternance";

    if(bestPackId === "apprentissage" || bestPackId === "contratpro"){
      if(st.employeur !== "oui") missing.push("Trouver un employeur (promesse d'embauche / contrat)");
      if(st.alternance !== "oui") missing.push("Valider que la formation est bien en alternance (CFA/OF)");
      if(age === "unknown") missing.push("Confirmer la tranche d'âge pour valider l'alternance");
      if(bestPackId === "apprentissage" && isAge30Plus(age) && st.handicap === "oui") missing.push("Signaler la situation de handicap pour l'exception d'âge en apprentissage");
      if(bestPackId === "apprentissage" && isAge30Plus(age) && apprentissageExceptionBand(st.apprentissage_exception) === "unknown" && st.handicap !== "oui") missing.push("Vérifier si une dérogation d'âge en apprentissage s'applique");
      if(bestPackId === "contratpro" && age !== "<26" && st.statut !== "de" && contratProCaseBand(st.contratpro_case) === "unknown") missing.push("Vérifier si vous relevez d'un cas ouvrant le contrat pro après 26 ans (DE, RSA, ASS, AAH, sortie CUI)");
      if(bestPackId === "contratpro" && age !== "<26" && st.statut !== "de" && contratProCaseBand(st.contratpro_case) === "none") missing.push("Revoir le contrat pro : après 26 ans, il faut être demandeur d'emploi ou relever d'un cas ouvrant");
      missing.push("Constituer le dossier CFA (calendrier, pièces administratives)");
    } else if(bestPackId === "prf"){
      missing.push("Obtenir/Conserver une confirmation d'entrée (convocation/prescription)");
    } else if(bestPackId === "cpf"){
      if(restCpf > 0){
        if(st.statut === "de" || st.statut === "jeune") missing.push("Demander un complément via France Travail (selon projet)");
        missing.push("Vérifier si un chèque/abondement Région HDF est mobilisable (selon critères)");
        if(st.statut === "sal" || st.statut === "fp") missing.push("Vérifier un financement employeur/OPCO ou un PTP");
      }
      missing.push("Vérifier l'éligibilité CPF de la formation (lien MCF / code RNCP/RS)");
    } else if(bestPackId === "ptp"){
      missing.push("Prendre un rendez-vous CEP et vérifier l'éligibilité");
      if(st.statut === "sal" && st.ptp_seniority !== "ok") missing.push("Confirmer l'ancienneté requise ou un cas d'accès dérogatoire au PTP");
      missing.push("Préparer et déposer le dossier PTP dans les délais");
    } else if(bestPackId === "faf"){
      missing.push("Identifier le FAF compétent (selon activité) et déposer une demande");
    } else if((st.statut === "de" || st.statut === "jeune") && prf.status !== "confirmed"){
      missing.push("Vérifier si la session est financée Région (PRF/SFER) via C2RP ou PRIF");
    }

    if(st.handicap === "oui") missing.push("Si pertinent : contacter Cap emploi / Agefiph/FIPHFP pour aides dédiées");
    if(hasMobilityNeed && (st.statut === "de" || st.statut === "jeune")){
      if(st.allocation_ft === "none"){
        missing.push("Demander l'aide à la mobilité France Travail dans les 30 jours si la distance ou l'hébergement le justifie");
      }else{
        missing.push("Vérifier l'aide à la mobilité France Travail : indemnisation, distance/temps et justificatifs");
      }
    }
    if(st.needs.hebergement && (((bestPackId === "apprentissage" || bestPackId === "contratpro") && age !== "45+" && age !== "36-44" && age !== "36+") || st.statut === "alt")){
      const logementAlternanceLabel = (age === "<26" || age === "26-29" || age === "unknown")
        ? "VÃ©rifier Mobili-Jeune et l'avance Loca-Pass si un logement est nÃ©cessaire pour l'alternance"
        : "VÃ©rifier surtout l'avance Loca-Pass si un logement est nÃ©cessaire pour l'alternance";
      missing.push("Vérifier Mobili-Jeune et l'avance Loca-Pass si un logement est nécessaire pour l'alternance");
    }
    if(st.needs.hebergement && missing.length){
      const lastMissing = String(missing[missing.length - 1] || "");
      if(lastMissing.includes("Loca-Pass")){
        missing[missing.length - 1] = logementAlternanceLabelSafe;
      }
    }
    if(hasAnyAnnexNeed && (bestPackId === "apprentissage" || st.statut === "alt" || st.alternance === "oui")){
      missing.push("Activer la Carte Génération #HDF (THR / équipement) via le CFA si vous relevez de l'apprentissage");
    }
    if(st.needs.transport && (st.employeur === "oui" || st.alternance === "oui" || (prf && prf.status === "confirmed"))){
      missing.push("Vérifier En route pour l'emploi si la mobilité bloque l'accès au contrat, au stage ou à la formation");
    }
    if(hasAnyAnnexNeed){
      missing.push("Prévoir justificatifs (transport/hébergement/équipement) pour solliciter des aides annexes");
    }

    return missing.slice(0, 6);
  }

  function createCore(dataBundle){
    const data = dataBundle || {};
    const catalogue = Array.isArray(data.catalogue) ? data.catalogue : [];
    const regionHdf = Array.isArray(data.region_hdf) ? data.region_hdf : [];
    const byName = new Map();

    for(const dispositif of catalogue){
      byName.set(dispositif["Dispositif"], dispositif);
    }
    for(const dispositif of regionHdf){
      if(dispositif["Dispositif (Hauts-de-France)"]) byName.set(dispositif["Dispositif (Hauts-de-France)"], dispositif);
      if(dispositif["Dispositif"]) byName.set(dispositif["Dispositif"], dispositif);
    }

    function dispo(name){
      return byName.get(name);
    }

    function normalizeLoose(value){
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’'`]/g, " ")
        .replace(/[–—-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function getDispositifTitle(dispositif){
      return String(dispositif["Dispositif (Hauts-de-France)"] || dispositif["Dispositif"] || "").trim();
    }

    function getDispositifFamilyKey(dispositif){
      const title = normalizeLoose(getDispositifTitle(dispositif));
      const sigle = normalizeLoose(dispositif["Sigle"] || "");
      const haystack = `${title} ${sigle}`;

      if(
        haystack.includes("prf 2025") ||
        haystack.includes("sfer") ||
        haystack.includes("programme regional de formation") ||
        haystack.includes("action de formation conventionnee")
      ) return "prf-sfer-hdf";
      if(haystack.includes("cheque pass formation sup") || haystack.includes("chpf sup")) return "chpf-sup";
      if(haystack.includes("cheque pass formation") || haystack.includes("pass formation") || sigle === "chpf") return "chpf";
      if(haystack.includes("pass emploi entreprise") || sigle === "paee") return "pass-emploi-entreprise";
      if(haystack.includes("generation #hdf")) return "generation-hdf";
      if(haystack.includes("en route pour l") && haystack.includes("emploi")) return "en-route-emploi";
      if(haystack.includes("mobili-jeune") || haystack.includes("mobili jeune")) return "mobili-jeune";
      if(haystack.includes("loca-pass") || haystack.includes("loca pass")) return "loca-pass";
      if(haystack.includes("cheque pass vae") || haystack.includes("pass vae")) return "pass-vae-hdf";
      if((haystack.includes("proch") && haystack.includes("info")) || haystack.includes("prif")) return "prochinfo-formation";
      if((haystack.includes("proch") && haystack.includes("emploi")) || haystack.includes("prochemploi")) return "prochemploi";
      if(haystack.includes("contrat d'apprentissage") || haystack.includes("contrat d apprentissage")) return "apprentissage";
      if(haystack.includes("contrat de professionnalisation")) return "contratpro";
      if(haystack.includes("projet de transition professionnelle")) return "ptp";
      if(haystack.includes("participation financiere obligatoire au cpf")) return "ticket-cpf";
      if(haystack.includes("compte personnel de formation") && haystack.includes("fonction publique")) return "cpf-fp";
      if(haystack.includes("compte personnel de formation")) return "cpf-core";

      return haystack || title;
    }

    function regionalVariantScore(dispositif){
      const title = normalizeLoose(getDispositifTitle(dispositif));
      const sigle = normalizeLoose(dispositif["Sigle"] || "");
      const haystack = `${title} ${sigle}`;
      let score = 0;

      if(dispositif["Dispositif (Hauts-de-France)"]) score += 10;
      if(/hdf|hauts-de-france|prif|proch|sfer|chpf|generation #hdf|paee/.test(haystack)) score += 4;
      if(title.includes("programme regional de formation") || title.includes("action de formation conventionnee")) score -= 8;
      if(title.includes("service public regional de la formation")) score -= 8;

      return score;
    }

    function isOtherDispositifEligible(dispositif, state){
      const st = {...defaultState(), ...state};
      const age = ageBand(st.age);
      const name = normalizeLoose(getDispositifTitle(dispositif));
      const familyKey = getDispositifFamilyKey(dispositif);
      const hasMobilityNeed = !!(st.needs.transport || st.needs.hebergement);
      const hasAnyAnnexNeed = !!(hasMobilityNeed || st.needs.equipement);
      const prf = detectPRF(st);

      if(["apprentissage", "contratpro", "ptp", "ticket-cpf", "cpf-core"].includes(familyKey)){
        return false;
      }

      if(familyKey === "cpf-fp"){
        return st.statut === "fp";
      }

      if(
        name.includes("programme regional de formation") ||
        name.includes("action de formation conventionnee") ||
        name.includes("afc") ||
        name.includes("prf 2025") ||
        name.includes("sfer")
      ){
        return st.statut === "de" || st.statut === "jeune";
      }

      if(name.includes("aide individuelle a la formation")){
        return (st.statut === "de" || st.statut === "jeune")
          && Number(st.cost_peda || 0) > 0
          && (Number(st.cost_peda || 0) > Number(st.cpf_amount || 0) || st.formation === "bafa" || !st.cpf_amount);
      }

      if(name.includes("abondement france travail")){
        return (st.statut === "de" || st.statut === "jeune")
          && Number(st.cost_peda || 0) > Number(st.cpf_amount || 0)
          && st.formation !== "bafa";
      }

      if(name.includes("pass formation") || name.includes("cheque pass formation") || name.includes("chèque pass formation")){
        return (st.statut === "de" || st.statut === "jeune")
          && Number(st.cost_peda || 0) > Number(st.cpf_amount || 0);
      }

      if(
        name.includes("preparation operationnelle a l emploi individuelle") ||
        name.includes("poei") ||
        name.includes("pass emploi entreprise")
      ){
        return (st.statut === "de" || st.statut === "jeune")
          && st.employeur === "oui"
          && targetContractBand(st.target_contract) === "12plus";
      }

      if(name.includes("action de formation prealable au recrutement") || name.includes("afpr")){
        return (st.statut === "de" || st.statut === "jeune")
          && st.employeur === "oui"
          && targetContractBand(st.target_contract) === "6to11";
      }

      if(name.includes("contrat d engagement jeune")){
        if(st.statut !== "jeune") return false;
        if(age === "unknown") return true;
        if(age === "<26") return true;
        if(age === "26-29") return st.handicap === "oui";
        return false;
      }

      if(name.includes("contrat de securisation professionnelle")){
        return st.statut === "de";
      }

      if(name.includes("allocation d aide au retour a l emploi")){
        return st.statut === "de" || st.statut === "jeune";
      }

      if(name.includes("remuneration de formation de france travail")){
        return st.statut === "de" || st.statut === "jeune";
      }

      if(name.includes("fif pl") || name.includes("agefice") || name.includes("fafcea") || name.includes("vivea") || name.includes("cpf des travailleurs independants")){
        return st.statut === "ind";
      }

      if(name.includes("opco")){
        return st.statut === "sal" || st.statut === "alt" || st.employeur === "oui";
      }

      if(name.includes("sesame") || name.includes("sésame")){
        if(!(st.statut === "jeune" || st.statut === "de")) return false;
        if(age === "unknown") return true;
        if(age === "<26") return true;
        if(age === "26-29") return st.handicap === "oui";
        return false;
      }

      if(name.includes("aide a la mobilite")){
        return (st.statut === "de" || st.statut === "jeune") && hasMobilityNeed;
      }

      if(name.includes("mobili-jeune") || name.includes("mobili jeune")){
        return hasMobilityNeed
          && !!st.needs.hebergement
          && (st.alternance === "oui" || st.statut === "alt")
          && (st.employeur === "oui" || st.statut === "alt")
          && (age === "<26" || age === "26-29" || age === "unknown");
      }

      if(name.includes("loca-pass") || name.includes("loca pass")){
        return !!st.needs.hebergement
          && (
            ((st.alternance === "oui" || st.statut === "alt") && (st.employeur === "oui" || st.statut === "alt"))
            || ((st.statut === "de" || st.statut === "jeune") && (age === "<26" || age === "26-29" || age === "unknown"))
          );
      }

      if(name.includes("generation #hdf")){
        const apprentissageStatus = evaluatePackEligibility("apprentissage", st, prf).status;
        const apprentissageException = apprentissageExceptionBand(st.apprentissage_exception);
        const apprentissageContext = st.statut === "alt" || st.alternance === "oui";
        const employeurOrCfaSignal = st.statut === "alt" || st.employeur === "oui";
        const hasQualifiedAgeException = st.handicap === "oui" || ["handicap", "creation", "sport", "suite", "exam"].includes(apprentissageException);
        if(!hasAnyAnnexNeed) return false;
        if(!apprentissageContext || !employeurOrCfaSignal) return false;
        if(apprentissageStatus === "ineligible") return false;
        if(isAge30Plus(age) && !hasQualifiedAgeException) return false;
        return true;
      }

      if(name.includes("en route pour l emploi")){
        return !!(st.needs.transport && (st.employeur === "oui" || st.alternance === "oui" || prf.status === "confirmed"));
      }

      return true;
    }

    function categorizeDispositifs(dispositifs, state, activeViewMode){
      const out = {payer:[], vivre:[], bouger:[], tout:dispositifs};
      for(const dispositif of dispositifs){
        const name = (dispositif["Dispositif"] || "") + " " + (dispositif["Sigle"] || "");
        const domain = (dispositif["Domaine"] || "") + " " + (dispositif["Thématique"] || "");
        const financed = (dispositif["Ce qui est financé"] || "") + " " + (dispositif["Objectif / ce que ça permet"] || "");
        const haystack = normalize(name + " " + domain + " " + financed);

        const isBouger = haystack.includes("mobilit") || haystack.includes("transport") || haystack.includes("hébergement") || haystack.includes("hebergement") || haystack.includes("logement") || haystack.includes("déplacement") || haystack.includes("deplacement");
        const isVivre = haystack.includes("rémun") || haystack.includes("remun") || haystack.includes("allocation") || haystack.includes("indemn") || haystack.includes("are") || haystack.includes("rfft") || haystack.includes("aref") || haystack.includes("salaire");
        const isPayer = haystack.includes("frais") || haystack.includes("pédagog") || haystack.includes("pedagog") || haystack.includes("cout") || haystack.includes("coût") || haystack.includes("abond") || haystack.includes("prise en charge") || haystack.includes("financement") || haystack.includes("cpf") || haystack.includes("opco") || haystack.includes("ptp");

        if(isBouger) out.bouger.push(dispositif);
        if(isVivre) out.vivre.push(dispositif);
        if(isPayer || (!isBouger && !isVivre)) out.payer.push(dispositif);
      }

      if(activeViewMode !== "expert"){
        out.payer = out.payer.slice(0, 4);
        out.vivre = out.vivre.slice(0, 4);
        out.bouger = out.bouger.slice(0, 4);
      }

      return out;
    }

    function filterOtherDispositifs(state){
      const st = {...defaultState(), ...state};
      const statusKeywords = {
        de: ["demandeur", "france travail", "chômage", "are", "alloc"],
        sal: ["salari", "employeur", "entreprise", "opco"],
        ind: ["indépend", "non-salari", "dirigeant", "libéral", "artisan"],
        jeune: ["jeune", "mission locale", "cej", "16", "25"],
        fp: ["fonction publique", "agent public"],
        alt: ["apprentissage", "alternant"]
      }[st.statut] || [];

      const formationKeywords = {
        bafa:["bafa","bafd"],
        bnssa:["bnssa","mns"],
        cpjeps:["cpjeps"],
        bpjeps:["bpjeps"],
        dejeps:["dejeps"],
        desjeps:["desjeps"],
        cqp:["cqp"]
      }[st.formation] || [];

      const results = [];
      for(const dispositif of [...catalogue, ...regionHdf]){
        const publics = dispositif["Publics éligibles"] || "";
        const specifics = dispositif["Spécificités sport/animation (exemples)"] || "";
        const name = getDispositifTitle(dispositif);

        if([
          "Compte personnel de formation",
          "Participation financière obligatoire au CPF",
          "Projet de transition professionnelle",
          "Contrat d'apprentissage - financement et aides employeur",
          "Contrat de professionnalisation - aides employeur (DE 26+ / 45+ / handicap)"
        ].includes(name)){
          continue;
        }

        if(GENERIC_UNUSED_DISPOSITIFS.has(name)) continue;

        if(!isOtherDispositifEligible(dispositif, st)) continue;

        let score = 0;
        if(statusKeywords.length && hasAny(publics, statusKeywords)) score += 2;
        if(formationKeywords.length && hasAny(specifics, formationKeywords)) score += 2;
        if(st.handicap === "oui" && hasAny(name + " " + publics + " " + specifics, ["agefiph","fiphfp","handicap"])) score += 3;
        const looseName = normalizeLoose(`${name} ${dispositif["Sigle"] || ""}`);
        if(looseName.includes("abondement france travail") && (st.statut === "de" || st.statut === "jeune") && Number(st.cost_peda || 0) > Number(st.cpf_amount || 0)) score += 3;
        if(looseName.includes("aide individuelle a la formation") && (st.statut === "de" || st.statut === "jeune") && Number(st.cost_peda || 0) > 0) score += 2;
        if((looseName.includes("pass formation") || looseName.includes("cheque pass formation") || looseName.includes("chèque pass formation")) && (st.statut === "de" || st.statut === "jeune")) score += 2;
        if((looseName.includes("poei") || looseName.includes("pass emploi entreprise")) && st.employeur === "oui" && targetContractBand(st.target_contract) === "12plus") score += 2;
        if(looseName.includes("afpr") && st.employeur === "oui" && targetContractBand(st.target_contract) === "6to11") score += 2;
        if((looseName.includes("programme regional de formation") || looseName.includes("action de formation conventionnee") || looseName.includes("afc") || looseName.includes("sfer")) && (st.statut === "de" || st.statut === "jeune")) score += 2;
        if(looseName.includes("aide a la mobilite") && (st.needs.transport || st.needs.hebergement)){
          score += (st.allocation_ft === "none") ? 4 : 2;
          if(st.needs.hebergement) score += 1;
        }
        if((looseName.includes("mobili-jeune") || looseName.includes("mobili jeune")) && st.needs.hebergement){
          score += 4;
          if(st.employeur === "oui") score += 1;
        }
        if((looseName.includes("loca-pass") || looseName.includes("loca pass")) && st.needs.hebergement){
          score += 3;
          if(st.alternance === "oui" || st.statut === "alt") score += 1;
        }
        if(looseName.includes("generation #hdf") && (st.needs.transport || st.needs.hebergement || st.needs.equipement)){
          score += 3;
          if(st.needs.equipement) score += 1;
          if(st.needs.transport || st.needs.hebergement) score += 1;
        }
        if(looseName.includes("en route pour l emploi") && st.needs.transport){
          if(st.employeur === "oui" || st.alternance === "oui") score += 4;
          else if(detectPRF(st).status === "confirmed") score += 2;
        }
        if(score >= 2) results.push({d: dispositif, score});
      }

      const bestByFamily = new Map();
      for(const entry of results){
        const familyKey = getDispositifFamilyKey(entry.d);
        if(familyKey === "prochinfo-formation" || familyKey === "prochemploi") continue;

        const candidate = {
          ...entry,
          familyKey,
          variantScore: regionalVariantScore(entry.d),
          title: normalizeLoose(getDispositifTitle(entry.d))
        };
        const current = bestByFamily.get(familyKey);
        if(
          !current ||
          candidate.score > current.score ||
          (candidate.score === current.score && candidate.variantScore > current.variantScore) ||
          (candidate.score === current.score && candidate.variantScore === current.variantScore && candidate.title.localeCompare(current.title, "fr", { sensitivity: "base" }) < 0)
        ){
          bestByFamily.set(familyKey, candidate);
        }
      }

      return [...bestByFamily.values()]
        .sort((left, right)=>
          right.score - left.score ||
          right.variantScore - left.variantScore ||
          left.title.localeCompare(right.title, "fr", { sensitivity: "base" })
        )
        .slice(0, 10)
        .map((entry) => entry.d);
    }

    return {
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
      evaluatePackEligibility,
      buildPacks,
      coverageForPack,
      resteTriplet,
      missingToImprove,
      categorizeDispositifs,
      filterOtherDispositifs
    };
  }

  return { createCore };
});
