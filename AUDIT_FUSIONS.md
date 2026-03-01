# Audit Fusions

Inventaire des familles fusionnees pour eviter les doublons, avec distinction entre :
- `fusionnee` : plusieurs lignes source sont regroupees en une seule carte visible
- `masquee` : une ligne generique est retiree de la cartographie pour eviter une lecture redondante
- `dedoublonnee entre sections` : dans le simulateur, une famille deja visible plus haut n'est pas repetee plus bas

## Regle generale

La cle de fusion est definie dans [app.js](c:/Users/lroos/Downloads/Simulateur/Prototype/app.js) via `cartographyCanonicalKey()`.
Cette meme cle sert :
- a la cartographie
- aux listes du simulateur (`Autres aides`, `Dispositifs regionaux Hauts-de-France`, onglets)

## Familles fusionnees dans la cartographie et dans le simulateur

| Famille visible | Variantes source regroupees | Cartographie | Simulateur | Vigilance |
| --- | --- | --- | --- | --- |
| `PRF 2025 - SFER (decouverte, qualifiant, perfectionnement)` | `PRF 2025 – SFER (Se Former pour un Emploi en Region) – Decouverte/Qualifiant/Perfectionnement` + `PRF 2025 – SFER (Se Former pour un Emploi en Region) : Parcours Decouverte / Qualifiant / Perfectionnement` | oui | oui | meme levier, deux formulations |
| `Cheque Pass Formation / Pass Formation (abondement CPF)` | `Cheque Pass Formation / Pass Formation (abondement CPF)` + `Cheque Pass Formation / Pass Formation (CHPF)` | oui | oui | meme abondement CPF regional |
| `Cheque Pass Formation Sup (abondement CPF cible)` | `Cheque Pass Formation Sup (abondement CPF – formations ciblees)` + `Cheque Pass Formation Sup (CHPF Sup)` | oui | oui | meme abondement CPF, segment superieur |
| `Pass Emploi Entreprise (formation avant recrutement)` | `Pass Emploi Entreprise (formation sur mesure avant recrutement)` + `Pass Emploi Entreprise (PAEE)` | oui | oui | meme dispositif, un libelle long et un sigle |
| `Carte Generation #HDF (equipement + aides THR)` | `Carte Generation #HDF (apprentis) – equipement + aides THR` + `Carte Generation #HDF – aide equipement (primo-entrant)` + `Carte Generation #HDF – aides THR (Transport / Hebergement / Restauration)` | oui | oui | famille multi-volets, doit rester clairement expliquee |
| `En route pour l'emploi` | `En route pour l'emploi (pret de vehicule a 1€/jour)` + `En route pour l'emploi (pret de vehicule a 1 € / jour)` | oui | oui | simple variante d'ecriture |
| `Mobili-Jeune (aide au loyer en alternance)` | `Mobili-Jeune (aide au loyer en alternance)` + `Mobili-Jeune (Action Logement)` | oui | oui | meme aide Action Logement |
| `Avance Loca-Pass (depot de garantie)` | `Avance Loca-Pass (depot de garantie)` + `Avance Loca-Pass (Action Logement)` | oui | oui | meme aide Action Logement |
| `Aides VAE regionales 2025 (Cheque Pass VAE) - non reconduites en 2026` | `PRF 2025 – Cheque Pass VAE (abondement CPF) – supprime au 01/01/2026` + `Aides VAE regionales 2025 (Cheque Pass VAE) : non reconduites en 2026` | oui | oui | famille inactive, affichee comme point de vigilance |
| `Proch'Info-Formation (orientation de proximite)` | `Proch'Info-Formation (point d'entree orientation)` + `Proch'Info-Formation (PRIF)` | oui | oui | meme service, deux formulations |
| `Proch'Emploi (appui emploi / recrutement)` | `Proch'Emploi (service sur-mesure emploi/recrutement)` + `Proch'Emploi` | oui | oui | meme service, formulation longue vs courte |

## Entrees masquees dans la cartographie uniquement

Ces cartes ne sont pas fusionnees dans une famille visible. Elles sont simplement retirees car elles creaient une redondance trop generale.

| Entree source | Traitement | Raison |
| --- | --- | --- |
| `Programme regional de formation` | masquee | trop generique par rapport a `PRF / SFER` |
| `Service public regional de la formation (exemple) + aides individuelles regionales` | masquee | carte de cadrage trop generale, confuse pour l'usager |

## Fiches generiques retirees du simulateur

Ces fiches ne sont plus proposees dans le simulateur car elles decrivent un cadre inter-regions ou un exemple non HDF, sans valeur d'orientation suffisante pour l'usager :

- `Service public regional de la formation (exemple) + aides individuelles regionales`

Cas particulier :

- `Programme regional de formation` n'est pas affiche tel quel ; il est rabattu vers la fiche HDF plus precise `PRF 2025 - SFER`.

## Revue finale des fiches generiques

### A retirer

- `Service public regional de la formation (exemple) + aides individuelles regionales`
  Motif : fiche inter-regions, source Nouvelle-Aquitaine, pas exploitable telle quelle pour un usager HDF.

### A rabattre vers une fiche HDF plus precise

- `Programme regional de formation`
  Remplacement : `PRF 2025 - SFER`
  Motif : le cadre PRF generique est trop large ; la fiche HDF est plus utile en orientation.

### A garder mais a presenter comme leviers nationaux ou cadres specifiques

- `Action de formation conventionnee (AFC)`
  Motif : ce n'est pas HDF, mais c'est un vrai levier France Travail, distinct du PRF regional.
- `Aide individuelle a la formation (AIF)`
  Motif : levier national concret, mobilisable selon instruction.
- `FNE-Formation`
  Motif : pas generique inter-regions, mais dispositif a surveiller et non prioritaire ; a garder avec prudence.
- `Aide BAFA de la Caf (aide nationale) + complements locaux`
  Motif : aide nationale reelle avec complements locaux variables.
- `VIVEA`
  Motif : peu pertinent pour votre terrain, mais regime reel et distinct pour les chefs d'exploitation agricole.
- `OPCO - branche du sport (AFDAS)` / `OPCO - branche Eclat (Uniformation)`
  Motif : pas des aides directes mais des acteurs utiles pour comprendre qui finance ou instruit selon la branche.

### Regle de lecture retenue

- on retire les fiches gabarit inter-regions ou d'exemple
- on remplace les fiches regionales trop generiques par leur version HDF
- on garde les dispositifs nationaux reels, meme variables, s'ils ont une vraie valeur d'orientation ou d'instruction

## Dedoublonnage specifique au simulateur

Dans le simulateur, il y a une logique supplementaire : une famille deja visible dans le scenario principal ou dans `Autres aides` n'est pas repetee dans `Dispositifs regionaux Hauts-de-France`.

Ce n'est pas une fusion supplementaire. C'est juste une suppression d'affichage redondant entre sections.

Exemples typiques :
- `Carte Generation #HDF`
- `PRF / SFER`
- `Mobili-Jeune`
- `Loca-Pass`
- `Pass VAE`

## Regle de repartition entre sections du simulateur

La repartition active est maintenant la suivante :

- `Aides et leviers complementaires (tries par besoin)` :
  tous les leviers mobilisables directement pour payer, vivre, se deplacer ou se loger, qu'ils soient nationaux, regionaux, employeur ou Action Logement
- `Relais et points d'entree Hauts-de-France` :
  uniquement les services regionaux d'orientation ou de mise en relation

Aujourd'hui, les familles classees en `Relais et points d'entree Hauts-de-France` sont :

- `Proch'Info-Formation`
- `Proch'Emploi`

Les autres familles HDF, meme regionales, restent dans les leviers par besoin si elles financent ou ouvrent directement un droit mobilisable :

- `PRF / SFER`
- `CHPF`
- `CHPF Sup`
- `Carte Generation #HDF`
- `En route pour l'emploi`
- `Mobili-Jeune`
- `Loca-Pass`
- `Pass VAE` (non mobilisable, point de vigilance)

## Non fusionnes volontairement

Les couples suivants restent distincts, car ils correspondent a des dispositifs differents ou a des cadres differents :

- `CPF` et `CPF permis`
- `CPF` et `CPF fonction publique`
- `POEI` et `POEC`
- `AFPR` et `POEI`
- `Cheque Pass Formation` et `Cheque Pass Formation Sup`
- `Mobili-Jeune` et `Aide a la mobilite France Travail`

## Reclassement hors aides

`Participation financiere obligatoire au CPF / Ticket moderateur CPF` n'est plus traitee comme une aide ou un levier complementaire dans le simulateur.

Traitement actif :

- retiree de `Aides et leviers complementaires`
- affichee dans `Points de vigilance / couts a prevoir` quand le CPF est mobilisable dans le parcours
- conservee dans la cartographie comme `Regle / cout a prevoir`

## Point de vigilance actuel

La logique de fusion est maintenant la meme dans la cartographie et dans les listes du simulateur.

En revanche, la cartographie porte aujourd'hui le niveau de reformulation le plus abouti. Le simulateur affiche deja les memes familles fusionnees, mais toutes les familles n'ont pas encore une reformulation aussi riche que la cartographie.
