# Audit Metier

Base de relecture rapide pour valider le simulateur sans ouvrir les tests.

## Comment relire un cas

1. Rejouer le cas en `mode express`, puis verifier que le top scenario reste coherent en `mode detaille`.
2. Lire le bloc `Pourquoi ce scenario ?` : il doit expliquer l'adaptation du scenario, le montage financier, puis le point a verifier.
3. Lire le `Plan d'action` : les etapes doivent etre concretes, ordonnees et sans saut de numerotation.
4. Ouvrir `Ce qu'il manque` : chaque carte doit donner un blocage clair, `3` actions utiles et au moins `1` contact.
5. Verifier que les cartes d'aides complementaires n'annoncent pas un dispositif inactif comme mobilisable.

## Cas usagers types

| Cas | Profil | Top scenario attendu | Points de vigilance |
| --- | --- | --- | --- |
| `apprentissage_standard` | Alternance, 26-29 ans, employeur oui, BPJEPS | `apprentissage` | CFA, calendrier, aides THR / equipement |
| `contratpro_30_rsa` | Alternance, 30-35 ans, employeur oui, cas RSA | `contratpro` | cas d'ouverture apres 26 ans, OPCO, aides employeur |
| `contratpro_45_de` | Demandeur d'emploi, 45+, alternance, employeur oui | `contratpro` | aides employeur 26+ / 45+, contrat vise |
| `salarie_ptp` | Salarie, BPJEPS, cout 6500 EUR, anciennete OK | `ptp` | CEP, dossier Transitions Pro, delais |
| `agent_public_ptp` | Agent public, BPJEPS, cout 5000 EUR | `ptp` | regles FP a confirmer, articulation employeur |
| `prf_confirmed` | Demandeur d'emploi, PRF confirme, ARE | `prf` | entree validee, AREF / RFF, prescription |
| `de_prf_unknown` | Demandeur d'emploi, PRF a verifier, ARE | `prf` | C2RP / PRIF / France Travail avant CPF |
| `de_cpf_shortfall` | Demandeur d'emploi, cout 5000 EUR, CPF 500 EUR | `cpf` | ordre CPF puis FT / AIF / Region |
| `de_cpf_no_alternance` | Demandeur d'emploi, pas d'alternance, pas d'employeur, CPF 0 | `cpf` | MCF, reste a charge, complements plausibles |
| `ind_faf` | Independant, BPJEPS, CPF 800 EUR | `faf` | FAF competent, baremes, delais |
| `jeune_cpf` | Jeune, moins de 26 ans, cout 4000 EUR, CPF 1200 EUR | `cpf` | CPF, abondements FT / Region, alternatives PRF |
| `alt_logement` | Alternance, 26-29 ans, employeur oui, besoin logement | `apprentissage` | Mobili-Jeune, Loca-Pass, aides annexes |

## Points de controle transverses

- Chaque scenario principal doit garder `3` blocs dans `Pourquoi ce scenario ?`
- Le top scenario ne doit pas etre `ineligible`
- Le scenario `CPF + abondements` doit expliquer clairement :
  - base CPF
  - complement France Travail / AIF / Region ou employeur / OPCO selon le profil
  - verifications restantes
- Les cartes `Ce qu'il manque` doivent garder :
  - un point bloquant
  - `3` actions concretes
  - au moins `1` contact

## Questions a noter en entretien

- L'usager a-t-il deja un devis, un calendrier ou un code RNCP/RS ?
- Le financeur collectif est-il confirme ou seulement suppose ?
- Le CPF couvre-t-il une partie reelle du cout ou faut-il un complement integral ?
- Le besoin principal est-il de payer la formation, vivre pendant la formation, ou bouger / se loger ?
- Y a-t-il un point reglementaire bloquant a confirmer : age, anciennete, employeur, statut, allocation ?

## Cas terrain a ajouter ensuite

- Salarie 45+ avec employeur pret a cofinancer via OPCO
- Demandeur d'emploi sans ARE avec session AFC ouverte
- Independant avec FAF refuse et report vers CPF seul
- Jeune en alternance sans logement stable
- Agent public avec projet de reconversion hors temps de travail

## Revue terrain v1

| Cas | Lecture attendue | Ce qui a ete verrouille |
| --- | --- | --- |
| `salarie_45_opco` | top `cpf` ou `ptp` selon anciennete / dossier ; leviers complementaires centres sur `OPCO`, `CEP`, bilan, compensation handicap si besoin | plus de remontée parasite `AGEFICE`, `FAFCEA` ou contrats d'alternance dans les complements |
| `de_sans_are_prf_confirme` | top `prf` ; lecture claire `session collective financee` puis remuneration FT selon cas | le scenario PRF garde maintenant la reference HDF `PRF 2025 - SFER` dans le moteur lui-meme |
| `independant_faf` | top `faf` ; complements centres sur FAF competents + CPF TI | plus de remontée parasite `ARE formation`, `CEJ` ou alternance dans les complements |
| `alternance_logement` | top `apprentissage` ; complements centres sur `Mobili-Jeune`, `Loca-Pass`, `Generation #HDF`, `En route pour l'emploi` si besoin transport | coherence logement / mobilite validee sur les aides annexes |
| `alt_30_handicap` | top `contratpro` ; apprentissage encore lisible mais derriere ; complements centres sur `Agefiph`, `OPCO`, compensation | plus de remontée parasite `CEJ` ou aides FT de demandeur d'emploi dans les complements |
| `fp_reconversion` | top `ptp` ou `cpf` selon maturite du dossier ; complements centres sur `CEP`, VAE, reconversion | les leviers employeur / independant ne remontent plus par defaut |

## Points sensibles revalides avant V1

| Point sensible | Regle retenue | Statut |
| --- | --- | --- |
| `Carte Generation #HDF` | ne doit pas remonter sur un simple profil `DE 30-35` / `CPF` sans vrai contexte apprentissage | verrouille |
| `Mobili-Jeune` | reserve aux alternants de moins de 30 ans | verrouille |
| `Loca-Pass` | reste possible plus largement que `Mobili-Jeune` ; en alternance 30-35, on peut encore le laisser en piste plausible si logement + employeur | verrouille |
| `Contrat pro + logement (30-35)` | message usager ajuste : on ne doit plus presenter `Mobili-Jeune` comme normal ; `Loca-Pass` seulement | verrouille |
| `PRF / SFER` | les references HDF doivent sortir directement du moteur, pas d'un patch UI | verrouille |
| `CPF + abondements` | la sous-liste experte doit rester lisible, sans aide intermediaire parasite ni faux doublon visuel | a reverifier visuellement apres refresh complet |

## Conclusion de cette passe

- Le moteur principal est coherent sur les scenarios structurants : apprentissage, contrat pro, PRF / SFER, CPF, PTP, FAF.
- Les complements affiches sont maintenant mieux alignes avec le statut reel de l'usager.
- Les references HDF prioritaires sont bien preferee quand une variante generique existe.
- L'exhaustivite du bundle est tracee par test, avec documentation explicite des 4 ajouts Action Logement hors classeur.

## Fichiers relies

- [tests/scenario-audit.test.js](c:/Users/lroos/Downloads/Simulateur/Prototype/tests/scenario-audit.test.js)
- [tests/simulator-core.test.js](c:/Users/lroos/Downloads/Simulateur/Prototype/tests/simulator-core.test.js)
- [tests/simulator-ui.test.js](c:/Users/lroos/Downloads/Simulateur/Prototype/tests/simulator-ui.test.js)
- [AUDIT_FUSIONS.md](c:/Users/lroos/Downloads/Simulateur/Prototype/AUDIT_FUSIONS.md)
