import type { TermsDocument } from "./types";

/** Blague canonique du départage — adaptée, jamais traduite (ADR-0010). */
export const TIE_BREAK_JOKE =
  "Toujours à égalité après tout ça ? La plus petite adresse de wallet l'emporte : le seul palmarès du football attribué à la naissance. Entraînez-vous tant que vous voudrez — 0x00 est née championne, et elle ne s'entraîne même pas.";

const fr: TermsDocument = {
  locale: "fr",
  title: "Conditions Générales",
  updated: "2026-07-05",
  sections: [
    {
      id: "preamble",
      heading: "1. À lire (oui, vraiment)",
      body: [
        "Les présentes Conditions Générales régissent ₵h@mpi0nz Pr3dict0r, une compétition de pronostics de football on-chain portant sur la saison 2026/27 de l'UEFA Champions League, opérée sur la Chiliz Chain. En achetant une entrée, vous acceptez chacune des clauses ci-dessous, y compris celles que vous comptiez lire en diagonale.",
        "Ces Conditions ont été écrites pour être lues : c'est pour cela qu'elles sont drôles. Les blagues sont porteuses — chacune signale une règle au sujet de laquelle quelqu'un, quelque part, rédigeait déjà une réclamation.",
      ],
      joke: "Chaque blague de ce document a fait l'objet d'une relecture juridique. Toutes les règles ont survécu ; plusieurs blagues, non. Une pensée émue pour la chute originale de l'article 7.",
    },
    {
      id: "skill-game",
      heading: "2. Un jeu d'adresse, pas un bookmaker",
      body: [
        "₵h@mpi0nz Pr3dict0r est une compétition de pronostics fondée sur l'habileté. Pas de cotes, pas de bookmaker, pas de marge de la maison sur les résultats : chaque cagnotte est financée exclusivement par les mises d'entrée, et le seul revenu de l'opérateur est la commission fixe indiquée à l'article 4.",
        "Nous ne prenons jamais position contre vous. L'issue des matchs nous est parfaitement indifférente — ce qui fait de nous le seul acteur du football dont ce soit vrai.",
      ],
      joke: "Si vous cherchez des profits garantis, ce n'est toujours pas pour vous — et il vous faudrait en plus pronostiquer mieux que tous ceux qui ont lu cette phrase et sont quand même restés.",
    },
    {
      id: "entry-tiers",
      heading: "3. Deux pass, embarquement immédiat",
      body: [
        "Le pass Saison Complète concourt en Étape 1 (phase de ligue, journées 1 à 8) et en Étape 2 (phase à élimination directe). Le pass Knockout concourt en Étape 2 uniquement. Une entrée par wallet et par étape ; un wallet Saison Complète est automatiquement inscrit aux deux étapes, sans seconde transaction en février.",
        "Voyez cela comme des classes d'embarquement : la Saison Complète embarque en premier et vole sur les deux tronçons ; le Knockout embarque à la porte des éliminatoires. Aucune différence d'espace pour les jambes — seulement moins de journées. Aucun des deux pass n'inclut de repas.",
      ],
      joke: "Pas de surclassement à la porte. La porte est un smart contract : elle a entendu toutes les excuses et n'en a retenu aucune.",
    },
    {
      id: "pricing-and-fees",
      heading: "4. Des prix exacts. Étonnamment exacts.",
      body: [
        "Une entrée Saison Complète coûte exactement 1,100 CHZ : 500 CHZ pour la Cagnotte de Ligue, 500 CHZ pour la Cagnotte Knockout et une commission fixe d'opérateur de 100 CHZ. Une entrée Knockout coûte exactement 550 CHZ : 500 CHZ pour la Cagnotte Knockout et une commission fixe de 50 CHZ. (Oui, 1,100 avec la virgule anglaise : les nombres sont identiques au byte près dans les six langues, et la virgule ne se discute pas.)",
        "Le contrat exige le montant exact, et les commissions restent sous séquestre dans le contrat jusqu'au verrouillage de l'étape, où elles sont transmises au destinataire des commissions. D'ici là, même notre propre commission nous échappe : nous avons construit une porte que nous ne pouvons pas ouvrir non plus.",
      ],
      joke: "Envoyez 1,099 CHZ : le contrat refuse. Envoyez 1,101 CHZ : il refuse aussi. Ce n'est pas du marchandage, c'est de l'arithmétique avec un physionomiste à l'entrée.",
    },
    {
      id: "entry-windows",
      heading: "5. Les guichets ferment à l'heure. L'arbitre n'attend pas.",
      body: [
        "La vente Saison Complète ferme définitivement au coup d'envoi du premier match de la journée 1. Pas « vers le coup d'envoi » : le sifflet est la cloche de clôture, et aucun sifflet de l'histoire n'a jamais attendu une transaction en attente.",
        "La vente Knockout ouvre à cette seconde précise — la boutique ne ferme jamais — et reste ouverte jusqu'à 60 minutes avant le coup d'envoi du dernier match aller des barrages.",
        "Si vous rejoignez tard dans la fenêtre knockout, chaque match déjà verrouillé vous rapporte 0 point. L'écran d'achat liste exactement les matchs manqués avant que vous ne puissiez payer : vous achetez en connaissance de cause, seule manière d'acheter qui résiste à toute demande de remboursement.",
      ],
      joke: "« Ça a déjà commencé, laissez-moi entrer ! » fonctionne pour l'Étape 2, et uniquement pour l'Étape 2. Pour l'Étape 1, la formule correcte est « rendez-vous en février ».",
    },
    {
      id: "refunds",
      heading: "6. Remboursements (article bref)",
      body: [
        "Les entrées sont définitives et non remboursables dès l'achat. « Dès l'achat » signifie dès l'achat : un pass Knockout acheté en septembre est verrouillé en septembre, pas en février.",
        "Il existe exactement une exception. Si une étape se verrouille avec moins de 20 participants, elle est annulée et chaque participant récupère l'intégralité de son entrée pour cette étape, commission fixe comprise. Dix-neuf personnes, ce n'est pas une compétition ; c'est une boucle WhatsApp avec un séquestre.",
      ],
      joke: "C'est l'article le plus court du document : chaque phrase supprimée était une façon plus longue de dire « non ».",
    },
    {
      id: "predictions",
      heading: "7. Changez d'avis. Prévoyez le gas.",
      body: [
        "Les pronostics de chaque match peuvent être soumis et modifiés librement jusqu'à 60 minutes avant son coup d'envoi, heure à laquelle ils se verrouillent. Modifier, c'est soumettre à nouveau on-chain : le nouveau pronostic écrase l'ancien, et vous payez les frais de réseau à chaque fois.",
        "Un match sans pronostic rapporte 0 point. Le contrat ne devine pas à votre place ; il a déjà vu ce que ça donne quand les gens devinent.",
      ],
      joke: "Changer d'avis est gratuit. Avoir changé d'avis coûte du gas. Des philosophes ont fait carrière sur bien moins que ça.",
    },
    {
      id: "scoring",
      heading: "8. Barème : 5/3/1 plus les bonus de match décisif",
      body: [
        "Chaque match n'attribue qu'un seul prix de score : 5 points pour le score exact, 3 points pour la bonne issue avec la bonne différence de buts, 1 point pour la bonne issue seule. Voilà tout le 5/3/1.",
        "Les matchs décisifs — le retour de chaque confrontation et la finale — portent en plus trois bonus de +1 : prolongation disputée, tirs au but disputés, et équipe qualifiée (ou soulevant le trophée) correctement désignée. Les matchs aller ne rapportent que le barème de base : un match aller ne peut pas aller en prolongation, quelle qu'ait été l'ambiance. Les bonus prolongation et tirs au but ne sont attribués que si vous avez aussi prédit la bonne issue des 90 minutes — savoir qu'un match reste à quatre-vingt-dix minutes n'est de la sagesse que si vous saviez qui le gagnait. Le bonus de qualification, lui, reste indépendant.",
      ],
      joke: "Le 5/3/1 n'est pas un schéma tactique. Comme schéma tactique, ce serait un motif de licenciement.",
    },
    {
      id: "ninety-minute-rule",
      heading: "9. La règle des 90 minutes (réponse anticipée du support)",
      body: [
        "Tous les points de score sont calculés sur le score après 90 minutes — le score du temps réglementaire — même quand tous les titres de presse donnent le score après prolongation comme « le résultat ». Prolongation et tirs au but ne comptent que par les bonus de l'article 8.",
      ],
      joke: "Oui, il y a eu prolongation. Non, ça ne nous intéresse pas. L'article 9 attend votre e-mail depuis la 91e minute et n'a encore jamais perdu un débat.",
    },
    {
      id: "results-oracle",
      heading: "10. Les résultats sont fixés par un robot",
      body: [
        "Les résultats sont publiés on-chain par un oracle automatisé qui lit les données de match de l'UEFA elle-même. Le robot n'accepte pas les pots-de-vin ; il ne prend même pas de week-end. Il n'a pas d'équipe de cœur, pas de beau-frère avec un ticket de paris, et aucun autre projet le mardi soir que celui-ci.",
        "Chaque résultat est provisoire pendant 24 heures, durant lesquelles il peut être corrigé — y compris lorsque l'UEFA amende ses propres données, ce qui arrive plus souvent que l'UEFA n'aimerait l'admettre. Les classements bougent immédiatement, marqués d'un badge provisoire, et le résultat devient définitif automatiquement à la clôture de la fenêtre.",
      ],
      joke: "On ne discute pas avec le robot. Vous pouvez écrire à un humain : il vérifiera ce que le robot a lu, confirmera que le robot a bien lu, et vous enverra très cordialement un lien vers l'article 11.",
    },
    {
      id: "mirror-uefa",
      heading: "11. Nous répliquons l'UEFA mot pour mot, forfaits compris",
      body: [
        "Ce que l'UEFA enregistre comme résultat du temps réglementaire est le résultat — forfaits, sanctions, retraits et résultats attribués compris. Si un match est arrêté puis rejoué, c'est ce que l'UEFA enregistre en dernier lieu pour cette affiche qui compte.",
        "Si l'UEFA accorde un 3-0 sur tapis vert, c'est le score. Adressez vos réclamations à Nyon. Prévoyez une petite laine : la ville est froide, et le bureau des recours l'est davantage.",
        "Un match n'est annulé que si nous avons créé une affiche qui n'aurait jamais dû exister. Nos erreurs comptent ; les décisions de l'UEFA, jamais.",
      ],
      joke: "Vous aviez pronostiqué 3-0 sur un match perdu 3-0 sur tapis vert ? Félicitations pour vos 5 points. L'univers prend parfois votre parti et, en vertu du présent article, nous répliquons aussi l'univers.",
    },
    {
      id: "tie-breaks",
      heading: "12. Départages, par ordre décroissant de dignité",
      body: [
        "Les égalités au classement sont tranchées dans l'ordre strict suivant : 1) total de points ; 2) plus grand nombre de scores exacts ; 3) horodatage d'inscription le plus précoce ; 4) adresse de wallet la plus basse.",
        "Trois de ces critères récompensent le talent ou l'engagement. Le quatrième récompense la chance de naissance — laquelle, comme vous le confirmera n'importe quel avant-centre, est aussi un talent.",
      ],
      joke: TIE_BREAK_JOKE,
    },
    {
      id: "prizes",
      heading: "13. Gains : la répartition du top 20",
      body: [
        "Chaque étape verse sa propre cagnotte à son top 20 : 25% au 1er, 15% au 2e, 10% au 3e, 30%÷7 à parts égales pour les places 4 à 10, et 20%÷10 à parts égales pour les places 11 à 20. La poussière d'arrondi entier revient au rang 1 — être premier a ses privilèges, dont certains sont microscopiques.",
        "L'Étape 1 est payée dès que le dernier résultat de la journée 8 a purgé sa fenêtre provisoire de 24 heures ; l'Étape 2 est payée après la finale. Aucun point, aucun fonds ne franchit jamais la frontière entre les deux cagnottes.",
        "L'Ultime ₵h@mpi0n — meilleur score combiné de la saison — reçoit un NFT-trophée on-chain d'une valeur monétaire d'exactement zéro, plus une couronne de profil et une page permanente au panthéon. Ce zéro est délibéré, structurel et éternel : le trophée porte la gloire, pas des fonds.",
      ],
      joke: "Le NFT-trophée vaut zéro par conception — l'unique fois dans l'histoire de la crypto où le marché a été parfaitement d'accord avec le whitepaper.",
    },
    {
      id: "public-chain",
      heading: "14. La blockchain est publique. Vous aussi.",
      body: [
        "Tous les pronostics sont inscrits sur une blockchain publique et lisibles par quiconque dès leur soumission : vos rivaux, votre groupe d'amis, votre ex, et un jour un archéologue muni d'un explorateur de blocs.",
        "Le verrouillage (article 7) est votre fenêtre de protection : une fois le match verrouillé, vous copier devient impossible. Avant le verrouillage, être copié est simplement le prix du jeu en public.",
      ],
      joke: "La blockchain n'a pas de navigation privée. Votre navigateur, à peine.",
    },
    {
      id: "smart-contract-risk",
      heading: "15. Risque logiciel (l'article sérieux)",
      body: [
        "Cette compétition repose sur des smart contracts. Les smart contracts sont du logiciel ; le logiciel a des bugs ; la blockchain rend les bugs permanents et publics. Nous testons, auditons et soumettons les contrats à des revues adversariales — et nous ne pouvons toujours pas promettre la perfection, car personne ne le peut honnêtement.",
        "Vous participez à vos risques et périls, jusqu'à la perte totale de votre mise incluse, par défaillance du contrat, de la chaîne ou de votre propre gestion de clés. Ne misez jamais ce que vous ne pouvez pas vous permettre de perdre.",
      ],
      joke: "C'est le seul article que notre avocate a lu deux fois sans rire une seule. Merci de le lire avec la même énergie qu'elle.",
    },
    {
      id: "eligibility",
      heading: "16. Éligibilité : vos devoirs, notre porte",
      body: [
        "En vous inscrivant, vous certifiez vous-même être majeur et que la participation à une compétition de pronostics payante fondée sur l'habileté est licite là où vous résidez. Ces devoirs sont les vôtres : nous ne pouvons pas les faire pour 195 pays, et ce paragraphe non plus.",
        "L'accès est bloqué depuis les 14 juridictions suivantes : CN, BD, DZ, EG, NP, AF, KP, IQ, IR, AE, ID, VN, QA, SG. Leurs visiteurs reçoivent un HTTP 451 — le seul code de statut nommé d'après un roman sur des livres qu'on brûle, ce qui reste la chose la plus littéraire qu'un pare-feu ait faite de sa vie.",
      ],
      joke: "Contourner le blocage ne vous rend pas éligible. Cela vous rend inéligible, avec des étapes en plus.",
    },
    {
      id: "uefa-affiliation",
      heading: "17. L'UEFA ne nous connaît pas (clause obligatoire)",
      body: [
        "₵h@mpi0nz Pr3dict0r n'est ni affilié à l'UEFA ou à l'UEFA Champions League, ni approuvé par elles, ni associé à elles de quelque manière que ce soit. Les noms, blasons et écussons des clubs sont la propriété de leurs détenteurs respectifs et n'apparaissent que pour identifier les matchs que vous pronostiquez.",
      ],
      joke: "C'est le seul article où la loi nous interdit d'être drôles — et, très franchement, l'UEFA préférerait que les dix-huit autres ne le soient pas non plus.",
    },
    {
      id: "final-authority",
      heading: "18. Quand les mots et le code divergent, le code gagne",
      body: [
        "Les présentes Conditions décrivent le smart contract déployé en six langues humaines. Si une phrase de l'une d'elles contredit ce que le contrat déployé fait réellement, l'autorité finale est le contrat déployé.",
      ],
      joke: "Ces Conditions sont l'adaptation cinéma ; le bytecode est le livre. Et vous savez déjà ce que tout le monde dit, toujours, du livre.",
    },
    {
      id: "credits",
      heading: "19. Crédits",
      body: [
        "Design visuel : BigMac Bobby, auteur du guide de style « Nuits européennes ». Ce crédit est contractuellement obligatoire et figure sur chaque page, y compris celle-ci.",
      ],
      joke: "BigMac Bobby a accepté d'être payé en visibilité. Cette clause est la visibilité. Le compte est, par les présentes, soldé.",
    },
  ],
};

export default fr;
