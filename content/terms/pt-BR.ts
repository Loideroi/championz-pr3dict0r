import type { TermsDocument } from "./types";

/** Piada canônica do desempate — adaptada, nunca traduzida (ADR-0010). */
export const TIE_BREAK_JOKE =
  "Empate persistindo depois de tudo isso? Vence o menor endereço de carteira: o único título do futebol decidido no dia em que a sua carteira nasceu. Pode treinar à vontade — 0x00 já saiu do berço campeã.";

const ptBR: TermsDocument = {
  locale: "pt-BR",
  title: "Termos e Condições",
  updated: "2026-07-05",
  sections: [
    {
      id: "preamble",
      heading: "1. Leia isto (sim, de verdade)",
      body: [
        "Estes Termos e Condições regem o ₵h@mpi0nz Pr3dict0r, uma competição on-chain de palpites de futebol sobre a temporada 2026/27 da UEFA Champions League, operada na Chiliz Chain. Ao comprar uma inscrição, você aceita cada cláusula abaixo, inclusive as que planejava ler por cima.",
        "Estes Termos foram escritos para serem lidos — por isso têm graça. As piadas são estruturais: cada uma marca uma regra sobre a qual alguém, em algum lugar, já estava digitando um e-mail de reclamação.",
      ],
      joke: "Toda piada deste documento passou por revisão jurídica. As regras sobreviveram todas; várias piadas, não. Um minuto de silêncio pelo desfecho original da Seção 7.",
    },
    {
      id: "skill-game",
      heading: "2. Um jogo de habilidade, não uma casa de apostas",
      body: [
        "O ₵h@mpi0nz Pr3dict0r é uma competição de palpites baseada em habilidade. Não há odds, não há bookmaker e não há margem da banca sobre os resultados: cada premiação é financiada exclusivamente pelas inscrições, e a única receita do operador é a taxa fixa indicada na Seção 4.",
        "Nunca apostamos contra você. Para nós tanto faz quem vence cada jogo — o que nos torna a única parte do futebol para a qual isso é verdade.",
      ],
      joke: "Se você procura lucro garantido, isto continua não sendo para você — e agora ainda teria que dar palpite melhor do que todo mundo que leu esta frase e ficou mesmo assim.",
    },
    {
      id: "entry-tiers",
      heading: "3. Dois passes, embarque imediato",
      body: [
        "O passe Temporada Completa disputa a Fase 1 (fase de liga, rodadas 1–8) e a Fase 2 (mata-mata). O passe Mata-Mata disputa apenas a Fase 2. Uma inscrição por carteira por fase; uma carteira Temporada Completa entra automaticamente nas duas fases, sem segunda transação em fevereiro.",
        "Pense em classes de embarque: a Temporada Completa embarca primeiro e voa os dois trechos; o Mata-Mata embarca no portão do mata-mata. Não há diferença de espaço para as pernas, só menos rodadas. Nenhum dos passes inclui refeição.",
      ],
      joke: "Não existe upgrade no portão. O portão é um contrato inteligente: já ouviu todas as desculpas e não aceitou nenhuma.",
    },
    {
      id: "pricing-and-fees",
      heading: "4. Preços exatos. Perturbadoramente exatos.",
      body: [
        "Uma inscrição Temporada Completa custa exatamente 1,100 CHZ: 500 CHZ para o Bolão da Liga, 500 CHZ para o Bolão do Mata-Mata e uma taxa fixa de operador de 100 CHZ. Uma inscrição Mata-Mata custa exatamente 550 CHZ: 500 CHZ para o Bolão do Mata-Mata e uma taxa fixa de 50 CHZ. (Sim, 1,100 com vírgula inglesa: os números são idênticos byte a byte nos seis idiomas, e a vírgula não negocia.)",
        "O contrato exige o valor exato, e as taxas ficam em custódia dentro do contrato até o travamento da fase, quando são repassadas ao recebedor de taxas. Até lá, nem a nossa própria taxa é nossa: construímos uma porta que nós também não conseguimos abrir.",
      ],
      joke: "Mande 1,099 CHZ e o contrato recusa. Mande 1,101 CHZ e ele recusa também. Não é pechincha; é aritmética com segurança na porta.",
    },
    {
      id: "entry-windows",
      heading: "5. As janelas fecham no horário. O árbitro não espera.",
      body: [
        "A venda da Temporada Completa fecha em definitivo no apito inicial do primeiro jogo da rodada 1. Não é 'perto do apito': o apito é o sino de fechamento, e nenhum apito na história esperou uma transação pendente.",
        "A venda do Mata-Mata abre nesse exato segundo — a loja nunca fecha — e permanece aberta até 60 minutos antes do último jogo de ida dos play-offs.",
        "Quem entra tarde na janela do mata-mata marca 0 ponto em todo jogo já travado. A tela de compra lista exatamente quais jogos você perdeu antes de você poder pagar: você compra de olhos abertos, o único jeito de comprar à prova de reembolso.",
      ],
      joke: "«Já começou, deixa eu entrar!» funciona para a Fase 2 e somente para a Fase 2. Para a Fase 1, a frase correta é «a gente se vê em fevereiro».",
    },
    {
      id: "refunds",
      heading: "6. Reembolsos (uma seção curta)",
      body: [
        "As inscrições são definitivas e não reembolsáveis a partir do momento da compra. 'A partir da compra' significa a partir da compra: um passe Mata-Mata comprado em setembro trava em setembro, não em fevereiro.",
        "Existe exatamente uma exceção. Se uma fase travar com menos de 20 participantes, essa fase é anulada e cada participante recebe de volta a inscrição daquela fase por inteiro, taxa fixa inclusa. Dezenove pessoas não são uma competição; são um grupo de WhatsApp com dinheiro em custódia.",
      ],
      joke: "Esta é a seção mais curta do documento porque cada frase que cortamos era um jeito mais longo de dizer «não».",
    },
    {
      id: "predictions",
      heading: "7. Mude de ideia. Traga dinheiro para o gas.",
      body: [
        "Os palpites de cada jogo podem ser enviados e editados livremente até 60 minutos antes do pontapé inicial, quando travam. Editar é reenviar on-chain: o palpite novo sobrescreve o antigo, e você paga o gas da rede a cada vez.",
        "Jogo sem palpite vale 0 ponto. O contrato não chuta por você; ele já viu o que acontece quando as pessoas chutam.",
      ],
      joke: "Mudar de ideia é de graça. Ter mudado de ideia custa gas. Tem filósofo com cátedra por muito menos.",
    },
    {
      id: "scoring",
      heading: "8. Pontuação: 5/3/1 mais os bônus de jogo decisivo",
      body: [
        "Cada jogo concede no máximo um prêmio de placar: 5 pontos pelo placar exato, 3 pontos pelo resultado certo com o saldo de gols certo, 1 ponto só pelo resultado certo. Esse é todo o 5/3/1.",
        "Os jogos decisivos — a volta de cada confronto e a final — carregam ainda três bônus de +1: prorrogação disputada, pênaltis cobrados e time classificado (ou campeão) acertado. Jogos de ida valem só a pontuação base: ida não tem prorrogação, por mais que tenha parecido que teve.",
      ],
      joke: "5/3/1 não é esquema tático. Como esquema tático, seria demissão na terça-feira.",
    },
    {
      id: "ninety-minute-rule",
      heading: "9. A regra dos 90 minutos (resposta antecipada do suporte)",
      body: [
        "Todos os pontos de placar são calculados sobre o placar aos 90 minutos — o placar do tempo normal — mesmo quando todas as manchetes do planeta dão o placar da prorrogação como 'o resultado'. Prorrogação e pênaltis contam exclusivamente pelos bônus da Seção 8.",
      ],
      joke: "Sim, foi para a prorrogação. Não, a gente não liga. A Seção 9 espera o seu e-mail desde o minuto 91 — e segue invicta em discussões.",
    },
    {
      id: "results-oracle",
      heading: "10. Quem coloca os resultados é um robô",
      body: [
        "Os resultados são publicados on-chain por um oráculo automático que lê os dados de jogo da própria UEFA. O robô não aceita propina; não tira nem fim de semana. Não tem time do coração, não tem primo com bilhete de aposta e não tem outro plano na terça à noite além deste.",
        "Todo resultado fica provisório por 24 horas, prazo em que pode ser corrigido — inclusive quando a UEFA corrige os próprios dados, o que acontece mais vezes do que a UEFA gostaria de admitir. As classificações se movem na hora, marcadas com um selo de provisório, e o resultado se torna definitivo automaticamente quando a janela fecha.",
      ],
      joke: "Com o robô não se discute. Você pode escrever para um humano, que vai conferir o que o robô leu, confirmar que o robô leu certo e mandar, com muito carinho, um link para a Seção 11.",
    },
    {
      id: "mirror-uefa",
      heading: "11. Espelhamos a UEFA ao pé da letra, tapetão incluso",
      body: [
        "O que a UEFA registrar como resultado do tempo normal é o resultado — incluindo W.O., punições, desistências e resultados decididos no tapetão. Se um jogo for suspenso e remarcado, vale o que a UEFA registrar por fim para aquela partida.",
        "Se a UEFA decretar 3-0 no tapetão, o placar é esse. Reclamações? Em Nyon, na Suíça. Leve casaco: a cidade é fria, e o balcão de recursos é mais frio ainda.",
        "Um jogo só é anulado se nós criamos uma partida que nunca deveria ter existido. Erros nossos contam; decisões da UEFA, jamais.",
      ],
      joke: "Palpitou 3-0 num jogo que terminou 3-0 no tapetão? Parabéns pelos seus 5 pontos. De vez em quando o universo joga no seu time — e, nos termos desta seção, nós espelhamos o universo também.",
    },
    {
      id: "tie-breaks",
      heading: "12. Desempates, em ordem decrescente de dignidade",
      body: [
        "Empates na classificação são resolvidos em ordem estrita: 1) total de pontos; 2) mais placares exatos; 3) inscrição com o registro de data e hora mais antigo; 4) menor endereço de carteira.",
        "Três desses critérios premiam habilidade ou compromisso. O quarto premia nascer com sorte — o que, como qualquer centroavante confirma com prazer, também é uma habilidade.",
      ],
      joke: TIE_BREAK_JOKE,
    },
    {
      id: "prizes",
      heading: "13. Prêmios: a divisão do top 20",
      body: [
        "Cada fase paga o próprio bolão ao seu top 20: 25% ao 1º, 15% ao 2º, 10% ao 3º, 30%÷7 em partes iguais para as posições 4–10 e 20%÷10 em partes iguais para as posições 11–20. A poeira de arredondamento inteiro vai para o rank 1 — ser primeiro tem privilégios, e alguns são microscópicos.",
        "A Fase 1 paga assim que o último resultado da rodada 8 vence sua janela provisória de 24 horas; a Fase 2 paga depois da final. Nenhum ponto e nenhum fundo cruza jamais a fronteira entre os dois bolões.",
        "O ₵h@mpi0n Definitivo — melhor pontuação combinada da temporada — recebe um NFT-troféu on-chain com valor monetário de exatamente zero, mais uma coroa no perfil e uma página permanente no hall da fama. O zero é proposital, estrutural e eterno: o troféu carrega glória, não fundos.",
      ],
      joke: "O NFT-troféu vale zero por projeto — a única vez na história cripto em que o mercado concordou integralmente com o whitepaper.",
    },
    {
      id: "public-chain",
      heading: "14. A blockchain é pública. Você também.",
      body: [
        "Todos os palpites ficam gravados numa blockchain pública e podem ser lidos por qualquer pessoa desde o envio: seus rivais, seu grupo, sua ex e, um dia, um arqueólogo com um explorador de blocos.",
        "O travamento (Seção 7) é sua janela de proteção: depois que o jogo trava, copiar você se torna impossível. Antes de travar, ser copiado é simplesmente o preço de jogar em público.",
      ],
      joke: "A blockchain não tem aba anônima. O seu navegador, aliás, mal tem.",
    },
    {
      id: "smart-contract-risk",
      heading: "15. Risco de software (a seção séria)",
      body: [
        "Esta competição roda em contratos inteligentes. Contratos inteligentes são software; software tem bugs; a blockchain torna os bugs permanentes e públicos. Testamos, auditamos e submetemos os contratos a revisões adversariais — e ainda assim não podemos prometer perfeição, porque ninguém pode prometer isso honestamente.",
        "Você participa por sua conta e risco, até e inclusive a perda total da sua inscrição por falha do contrato, falha da rede ou da sua própria gestão de chaves. Nunca coloque em jogo o que você não pode perder.",
      ],
      joke: "Esta é a única seção que a nossa advogada leu duas vezes e riu zero vezes. Pedimos que leia com a mesma energia dela.",
    },
    {
      id: "eligibility",
      heading: "16. Elegibilidade: o dever de casa é seu, a porta é nossa",
      body: [
        "Ao se inscrever, você autodeclara que é maior de idade e que participar de uma competição paga de palpites baseada em habilidade é legal onde você mora. Esse dever de casa é seu: não conseguimos fazê-lo por 195 países, e este parágrafo também não.",
        "O acesso está bloqueado a partir das seguintes 14 jurisdições: CN, BD, DZ, EG, NP, AF, KP, IQ, IR, AE, ID, VN, QA, SG. Visitantes desses lugares recebem um HTTP 451 — o único código de status batizado em homenagem a um romance sobre queimar livros, até hoje a coisa mais literária que um firewall já fez.",
      ],
      joke: "Burlar o bloqueio não torna você elegível. Torna você inelegível com etapas extras.",
    },
    {
      id: "uefa-affiliation",
      heading: "17. A UEFA não nos conhece (cláusula obrigatória)",
      body: [
        "O ₵h@mpi0nz Pr3dict0r não é afiliado à UEFA nem à UEFA Champions League, não é endossado por elas nem está associado a elas de forma alguma. Nomes, escudos e brasões dos clubes são propriedade dos seus respectivos donos e aparecem apenas para identificar os jogos dos seus palpites.",
      ],
      joke: "Esta é a única seção em que a lei nos proíbe de ter graça — e, sinceramente, a UEFA preferiria que as outras dezoito também não tivessem.",
    },
    {
      id: "final-authority",
      heading: "18. Quando as palavras e o código divergem, o código vence",
      body: [
        "Estes Termos descrevem o contrato inteligente implantado em seis línguas humanas. Se qualquer frase em qualquer uma delas divergir do que o contrato implantado realmente faz, a autoridade final é o contrato implantado.",
      ],
      joke: "Estes Termos são a adaptação para o cinema; o bytecode é o livro. E você já sabe o que todo mundo sempre diz sobre o livro.",
    },
    {
      id: "credits",
      heading: "19. Créditos",
      body: [
        "Design visual: BigMac Bobby, autor do guia de estilo 'Noites europeias'. Este crédito é contratualmente obrigatório e aparece em todas as páginas, inclusive nesta.",
      ],
      joke: "BigMac Bobby aceitou receber em visibilidade. Esta cláusula é a visibilidade. A conta está, por meio desta, quitada.",
    },
  ],
};

export default ptBR;
