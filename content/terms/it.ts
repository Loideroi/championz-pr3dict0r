import type { TermsDocument } from "./types";

/** Battuta canonica dello spareggio — adattata, mai tradotta (ADR-0010). */
export const TIE_BREAK_JOKE =
  "Ancora pari dopo tutto questo? Vince l'indirizzo wallet più basso: l'unico trofeo del calcio assegnato al momento della nascita, senza nemmeno quattro minuti di VAR e una riga tracciata storta. Allenatevi pure — 0x00 è nato campione.";

const it: TermsDocument = {
  locale: "it",
  title: "Termini e Condizioni",
  updated: "2026-07-05",
  sections: [
    {
      id: "preamble",
      heading: "1. Da leggere (sì, sul serio)",
      body: [
        "I presenti Termini e Condizioni disciplinano ₵h@mpi0nz Pr3dict0r, una competizione di pronostici calcistici on-chain sulla stagione 2026/27 della UEFA Champions League, operata sulla Chiliz Chain. Acquistando un ingresso accettate ogni singola clausola qui sotto, comprese quelle che pensavate di scorrere in diagonale.",
        "Questi Termini sono stati scritti per essere letti: ecco perché fanno ridere. Le battute sono portanti — ognuna segnala una regola su cui qualcuno, da qualche parte, stava già scrivendo una mail di reclamo.",
      ],
      joke: "Ogni battuta di questo documento è passata dalla revisione legale. Le regole sono sopravvissute tutte; diverse battute no. Un minuto di raccoglimento per il finale originale della Sezione 7.",
    },
    {
      id: "skill-game",
      heading: "2. Un gioco di abilità, non un bookmaker",
      body: [
        "₵h@mpi0nz Pr3dict0r è una competizione di pronostici basata sull'abilità. Niente quote, niente bookmaker, nessun margine del banco sugli esiti: ogni montepremi è finanziato esclusivamente dalle quote d'ingresso, e l'unico ricavo dell'operatore è la commissione fissa indicata nella Sezione 4.",
        "Non prendiamo mai posizione contro di voi. Di chi vinca una partita non ci importa letteralmente nulla — il che fa di noi l'unico soggetto del calcio per cui questo sia vero.",
      ],
      joke: "Se cercate profitti garantiti, questo continua a non fare per voi — e in più ora dovreste pronosticare meglio di tutti quelli che hanno letto questa frase e sono rimasti lo stesso.",
    },
    {
      id: "entry-tiers",
      heading: "3. Due pass, imbarco immediato",
      body: [
        "Il pass Stagione Completa gareggia nella Fase 1 (campionato, giornate 1–8) e nella Fase 2 (eliminazione diretta). Il pass Knockout gareggia solo nella Fase 2. Un ingresso per wallet per fase; un wallet Stagione Completa è iscritto automaticamente a entrambe le fasi, senza una seconda transazione a febbraio.",
        "Pensatela come classi d'imbarco: la Stagione Completa imbarca per prima e vola su entrambe le tratte; il Knockout imbarca al gate delle eliminatorie. Nessuna differenza di spazio per le gambe, solo meno giornate. Nessuno dei due pass include il pasto.",
      ],
      joke: "Niente upgrade al gate. Il gate è uno smart contract: le ha sentite tutte e non ne ha accettata nemmeno una.",
    },
    {
      id: "pricing-and-fees",
      heading: "4. Prezzi esatti. Inquietantemente esatti.",
      body: [
        "Un ingresso Stagione Completa costa esattamente 1,100 CHZ: 500 CHZ al Montepremi Campionato, 500 CHZ al Montepremi Knockout e una commissione fissa dell'operatore di 100 CHZ. Un ingresso Knockout costa esattamente 550 CHZ: 500 CHZ al Montepremi Knockout e una commissione fissa di 50 CHZ. (Sì, 1,100 con la virgola all'inglese: le cifre sono identiche byte per byte in tutte e sei le lingue, e la virgola non tratta.)",
        "Il contratto esige l'importo esatto, e le commissioni restano in deposito nel contratto fino al blocco della fase, quando vengono inoltrate al destinatario delle commissioni. Fino ad allora nemmeno la nostra commissione è nostra: abbiamo costruito una porta che non possiamo aprire neanche noi.",
      ],
      joke: "Inviate 1,099 CHZ e il contratto rifiuta. Inviate 1,101 CHZ e rifiuta pure quello. Non sta contrattando: è aritmetica con il buttafuori.",
    },
    {
      id: "entry-windows",
      heading: "5. Le finestre chiudono in orario. L'arbitro non aspetta.",
      body: [
        "La vendita Stagione Completa chiude definitivamente al fischio d'inizio della prima partita della giornata 1. Non 'più o meno al fischio': il fischietto è la campanella di chiusura, e nessun fischietto nella storia ha mai aspettato una transazione in sospeso.",
        "La vendita Knockout apre in quello stesso secondo — il negozio non chiude mai — e resta aperta fino a 60 minuti prima del fischio d'inizio dell'ultima andata dei play-off.",
        "Chi entra tardi nella finestra knockout prende 0 punti su ogni partita già bloccata. La schermata di acquisto elenca esattamente quali partite avete perso, prima che possiate pagare: comprate a occhi aperti, l'unico modo di comprare a prova di rimborso.",
      ],
      joke: "«È già cominciata, fatemi entrare!» funziona per la Fase 2 e solo per la Fase 2. Per la Fase 1 la formula corretta è «ci vediamo a febbraio».",
    },
    {
      id: "refunds",
      heading: "6. Rimborsi (una sezione breve)",
      body: [
        "Gli ingressi sono definitivi e non rimborsabili dal momento dell'acquisto. 'Dall'acquisto' significa dall'acquisto: un pass Knockout comprato a settembre è vincolato a settembre, non a febbraio.",
        "Esiste esattamente un'eccezione. Se una fase si blocca con meno di 20 partecipanti, quella fase è annullata e ogni partecipante riottiene per intero l'ingresso di quella fase, commissione fissa inclusa. Diciannove persone non sono una competizione: sono un gruppo WhatsApp con deposito a garanzia.",
      ],
      joke: "Questa è la sezione più corta del documento, perché ogni frase che abbiamo tolto era un modo più lungo di dire «no».",
    },
    {
      id: "predictions",
      heading: "7. Cambiate pure idea. Portate i soldi per il gas.",
      body: [
        "I pronostici di ogni partita possono essere inviati e modificati liberamente fino a 60 minuti prima del suo calcio d'inizio, quando si bloccano. Modificare significa reinviare on-chain: il nuovo pronostico sovrascrive il vecchio e pagate il gas di rete ogni volta.",
        "Una partita senza pronostico vale 0 punti. Il contratto non indovina al posto vostro; ha già visto come va a finire quando la gente indovina.",
      ],
      joke: "Cambiare idea è gratis. Aver cambiato idea costa gas. C'è gente che ha vinto cattedre di filosofia con molto meno.",
    },
    {
      id: "scoring",
      heading: "8. Punteggio: 5/3/1 più i bonus delle partite decisive",
      body: [
        "Ogni partita assegna al massimo un premio sul risultato: 5 punti per il risultato esatto, 3 punti per l'esito corretto con la giusta differenza reti, 1 punto per il solo esito corretto. Tutto qui il 5/3/1.",
        "Le partite decisive — il ritorno di ogni doppio confronto e la finale — portano in più tre bonus da +1: supplementari giocati, rigori calciati e squadra che passa il turno (o alza il trofeo) indovinata. Le andate valgono solo il punteggio base: un'andata non può andare ai supplementari, per quanto sembrasse di sì.",
      ],
      joke: "Il 5/3/1 non è un modulo. Come modulo sarebbe un esonero a novembre.",
    },
    {
      id: "ninety-minute-rule",
      heading: "9. La regola dei 90 minuti (risposta preventiva dell'assistenza)",
      body: [
        "Tutti i punti sul risultato si calcolano sul punteggio dopo 90 minuti — il risultato dei tempi regolamentari — anche quando ogni titolo di giornale dà il punteggio dopo i supplementari come 'il risultato'. Supplementari e rigori contano esclusivamente attraverso i bonus della Sezione 8.",
      ],
      joke: "Sì, è andata ai supplementari. No, non ci interessa. La Sezione 9 aspetta la vostra mail dal 91º minuto e non ha ancora perso una sola discussione.",
    },
    {
      id: "results-oracle",
      heading: "10. I risultati li mette un robot",
      body: [
        "I risultati vengono pubblicati on-chain da un oracolo automatico che legge i dati partita della UEFA stessa. Il robot non accetta bustarelle; non si prende nemmeno i weekend. Non ha una squadra del cuore, non ha un cugino con la schedina e il martedì sera non ha altri programmi oltre a questo.",
        "Ogni risultato è provvisorio per 24 ore, durante le quali può essere corretto — anche quando la UEFA corregge i propri dati, cosa che succede più spesso di quanto la UEFA gradirebbe far sapere. Le classifiche si muovono subito, con un badge di provvisorietà, e il risultato diventa definitivo automaticamente alla chiusura della finestra.",
      ],
      joke: "Col robot non si discute. Potete scrivere a un umano, che controllerà cosa ha letto il robot, confermerà che il robot ha letto bene e vi manderà, con grande affetto, un link alla Sezione 11.",
    },
    {
      id: "mirror-uefa",
      heading: "11. Copiamo la UEFA alla lettera, tavolino compreso",
      body: [
        "Quello che la UEFA registra come risultato dei tempi regolamentari è il risultato — comprese sconfitte a tavolino, sanzioni, ritiri e risultati assegnati d'ufficio. Se una partita viene sospesa e rigiocata, conta ciò che la UEFA registra alla fine per quell'incontro.",
        "Se la UEFA assegna un 3-0 a tavolino, quello è il punteggio. I reclami vanno a Nyon. Portatevi una giacca: la città è fredda, e l'ufficio ricorsi lo è di più.",
        "Una partita viene annullata solo se abbiamo creato noi un incontro che non sarebbe mai dovuto esistere. I nostri errori contano; le decisioni della UEFA, mai.",
      ],
      joke: "Avevate pronosticato 3-0 su una partita finita 3-0 a tavolino? Complimenti per i vostri 5 punti. Ogni tanto l'universo si schiera con voi e, ai sensi di questa sezione, noi copiamo anche l'universo.",
    },
    {
      id: "tie-breaks",
      heading: "12. Spareggi, in ordine decrescente di dignità",
      body: [
        "I pareggi in classifica si risolvono in ordine rigoroso: 1) punti totali; 2) più risultati esatti; 3) marca temporale d'iscrizione più antica; 4) indirizzo wallet più basso.",
        "Tre di questi criteri premiano l'abilità o l'impegno. Il quarto premia l'essere nati fortunati — che, come vi confermerà volentieri qualunque centravanti, è anch'essa un'abilità.",
      ],
      joke: TIE_BREAK_JOKE,
    },
    {
      id: "prizes",
      heading: "13. Premi: la ripartizione del top 20",
      body: [
        "Ogni fase paga il proprio montepremi ai suoi primi 20: 25% al 1º, 15% al 2º, 10% al 3º, 30%÷7 in parti uguali ai piazzamenti 4–10 e 20%÷10 in parti uguali ai piazzamenti 11–20. La polvere degli arrotondamenti interi va al rango 1 — essere primi ha i suoi vantaggi, e alcuni sono microscopici.",
        "La Fase 1 paga appena l'ultimo risultato della giornata 8 supera la sua finestra provvisoria di 24 ore; la Fase 2 paga dopo la finale. Nessun punto e nessun fondo attraversa mai il confine tra i due montepremi.",
        "L'Ultimate ₵h@mpi0n — miglior punteggio combinato della stagione — riceve un NFT-trofeo on-chain dal valore monetario di esattamente zero, più una corona sul profilo e una pagina permanente nella hall of fame. Lo zero è voluto, strutturale ed eterno: il trofeo porta gloria, non fondi.",
      ],
      joke: "L'NFT-trofeo vale zero per progetto — l'unica volta nella storia delle cripto in cui il mercato si è trovato completamente d'accordo con il whitepaper.",
    },
    {
      id: "public-chain",
      heading: "14. La blockchain è pubblica. Anche voi.",
      body: [
        "Tutti i pronostici sono registrati su una blockchain pubblica e leggibili da chiunque dal momento dell'invio: i vostri rivali, il vostro gruppo, la vostra ex, e un giorno un archeologo con un block explorer.",
        "Il blocco (Sezione 7) è la vostra finestra di protezione: una volta bloccata la partita, copiarvi diventa impossibile. Prima del blocco, farsi copiare è semplicemente il prezzo di giocare in pubblico.",
      ],
      joke: "La blockchain non ha la navigazione in incognito. Il vostro browser, a malapena.",
    },
    {
      id: "smart-contract-risk",
      heading: "15. Rischio software (la sezione seria)",
      body: [
        "Questa competizione gira su smart contract. Gli smart contract sono software; il software ha bug; la blockchain rende i bug permanenti e pubblici. Testiamo, verifichiamo e sottoponiamo i contratti a revisioni avversariali — e comunque non possiamo promettere la perfezione, perché nessuno può prometterla onestamente.",
        "Partecipate a vostro rischio, fino alla perdita totale della quota inclusa, per guasto del contratto, della chain o della vostra gestione delle chiavi. Non mettete mai in gioco ciò che non potete permettervi di perdere.",
      ],
      joke: "Questa è l'unica sezione che la nostra avvocata ha letto due volte ridendo zero volte. Vi chiediamo di leggerla con la stessa energia.",
    },
    {
      id: "eligibility",
      heading: "16. Idoneità: compiti vostri, porta nostra",
      body: [
        "Iscrivendovi autocertificate di essere maggiorenni e che partecipare a una competizione di pronostici a pagamento basata sull'abilità è lecito dove vivete. Quei compiti sono vostri: non possiamo farli per 195 Paesi, e nemmeno questo paragrafo può.",
        "L'accesso è bloccato dalle seguenti 14 giurisdizioni: CN, BD, DZ, EG, NP, AF, KP, IQ, IR, AE, ID, VN, QA, SG. I loro visitatori ricevono un HTTP 451 — l'unico codice di stato che prende il nome da un romanzo sui libri bruciati, tuttora la cosa più letteraria mai fatta da un firewall.",
      ],
      joke: "Aggirare il blocco non vi rende idonei. Vi rende non idonei, con qualche passaggio in più.",
    },
    {
      id: "uefa-affiliation",
      heading: "17. La UEFA non ci conosce (clausola obbligatoria)",
      body: [
        "₵h@mpi0nz Pr3dict0r non è affiliato alla UEFA né alla UEFA Champions League, non è da esse approvato né in alcun modo associato. Nomi, stemmi e loghi dei club sono di proprietà dei rispettivi titolari e compaiono al solo scopo di identificare le partite che pronosticate.",
      ],
      joke: "Questa è l'unica sezione in cui per legge non possiamo far ridere — e, francamente, la UEFA preferirebbe che nemmeno le altre diciotto lo facessero.",
    },
    {
      id: "final-authority",
      heading: "18. Se parole e codice divergono, vince il codice",
      body: [
        "Questi Termini descrivono lo smart contract distribuito, in sei lingue umane. Se una qualsiasi frase in una qualsiasi di esse contraddice ciò che il contratto distribuito effettivamente fa, l'autorità finale è il contratto distribuito.",
      ],
      joke: "Questi Termini sono il film tratto dal libro; il bytecode è il libro. E sapete già cosa dicono tutti, sempre, del libro.",
    },
    {
      id: "credits",
      heading: "19. Crediti",
      body: [
        "Design visivo: BigMac Bobby, autore della guida di stile 'Notti europee'. Questo credito è contrattualmente obbligatorio e compare su ogni pagina, compresa questa.",
      ],
      joke: "BigMac Bobby ha accettato di farsi pagare in visibilità. Questa clausola è la visibilità. Il conto è da intendersi saldato.",
    },
  ],
};

export default it;
