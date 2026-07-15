import type { TermsDocument } from "./types";

/** Broma canónica del desempate — adaptada, no traducida (ADR-0010). */
export const TIE_BREAK_JOKE =
  "¿Sigue el empate después de todo eso? Gana la dirección de wallet más baja: el único título del fútbol que se decide el día en que nace tu wallet. Entrena lo que quieras; 0x00 vino ganadora de fábrica.";

const es: TermsDocument = {
  locale: "es",
  title: "Términos y Condiciones",
  updated: "2026-07-05",
  sections: [
    {
      id: "preamble",
      heading: "1. Léete esto (sí, en serio)",
      body: [
        "Estos Términos y Condiciones rigen ₵h@mpi0nz Pr3dict0r, una competición de pronósticos de fútbol on-chain sobre la temporada 2026/27 de la UEFA Champions League, operada en la Chiliz Chain. Al comprar una entrada aceptas todas y cada una de las cláusulas siguientes, incluidas las que pensabas leer en diagonal.",
        "Estos Términos se escribieron para ser leídos, y por eso tienen gracia. Los chistes son estructurales: cada uno señala una norma sobre la que alguien, en algún lugar, ya estaba redactando un correo de queja.",
      ],
      joke: "Todos los chistes de este documento pasaron revisión jurídica. Las normas sobrevivieron todas; varios chistes, no. Un minuto de silencio por el remate original de la Sección 7.",
    },
    {
      id: "skill-game",
      heading: "2. Un juego de habilidad, no una casa de apuestas",
      body: [
        "₵h@mpi0nz Pr3dict0r es una competición de pronósticos basada en la habilidad. No hay cuotas, no hay corredor de apuestas y no hay margen de la casa sobre los resultados: cada bote de premios se financia exclusivamente con las entradas, y el único ingreso del operador es la comisión fija indicada en la Sección 4.",
        "Nunca apostamos contra ti. Nos da exactamente igual quién gane cada partido — lo que nos convierte en la única parte del fútbol de la que eso es verdad.",
      ],
      joke: "Si buscas beneficios garantizados, esto sigue sin ser para ti — y encima ahora tendrías que pronosticar mejor que todos los que leyeron esta frase y aun así se quedaron.",
    },
    {
      id: "entry-tiers",
      heading: "3. Dos pases, embarcando ya",
      body: [
        "El pase de Temporada Completa compite en la Etapa 1 (Fase Liga, jornadas 1–8) y en la Etapa 2 (Eliminatorias). El pase de Eliminatorias compite solo en la Etapa 2. Una entrada por wallet y etapa; una wallet de Temporada Completa queda inscrita automáticamente en ambas etapas, sin segunda transacción en febrero.",
        "Piénsalo como clases de embarque: la Temporada Completa embarca primero y vuela los dos trayectos; las Eliminatorias embarcan en la puerta de las eliminatorias. No hay diferencia de espacio para las piernas, solo menos jornadas. Ningún pase incluye comida.",
      ],
      joke: "No hay mejoras de clase en la puerta. La puerta es un contrato inteligente: ha escuchado todas las excusas y no ha aceptado ninguna.",
    },
    {
      id: "pricing-and-fees",
      heading: "4. Los precios son exactos. Inquietantemente exactos.",
      body: [
        "Una entrada de Temporada Completa cuesta exactamente 1,100 CHZ: 500 CHZ al Bote de Liga, 500 CHZ al Bote de Eliminatorias y una comisión fija de operador de 100 CHZ. Una entrada de Eliminatorias cuesta exactamente 550 CHZ: 500 CHZ al Bote de Eliminatorias y una comisión fija de 50 CHZ. (Sí, 1,100 con coma inglesa: las cifras son idénticas byte a byte en los seis idiomas, y la coma no negocia.)",
        "El contrato exige el importe exacto, y las comisiones quedan en depósito dentro del contrato hasta el cierre de la etapa, momento en que se envían al receptor de comisiones. Hasta entonces, ni nuestra propia comisión es nuestra: construimos una puerta que tampoco nosotros podemos abrir.",
      ],
      joke: "Envía 1,099 CHZ y el contrato lo rechaza. Envía 1,101 CHZ y también lo rechaza. No está regateando; es aritmética con portero de discoteca.",
    },
    {
      id: "entry-windows",
      heading: "5. Las ventanas cierran puntuales. El árbitro no espera.",
      body: [
        "La venta de Temporada Completa cierra en seco con el pitido inicial de la primera jornada. No 'más o menos al pitido': el silbato es la campana de cierre, y ningún silbato de la historia ha esperado jamás a una transacción pendiente.",
        "La venta de Eliminatorias abre en ese mismo segundo — la tienda nunca cierra — y permanece abierta hasta 60 minutos antes del último partido de ida del play-off.",
        "Si entras tarde en la ventana de eliminatorias, cada partido ya bloqueado te puntúa 0. La pantalla de compra enumera exactamente qué partidos te has perdido antes de que puedas pagar: compras con los ojos abiertos, que es la única forma de comprar a prueba de reembolsos.",
      ],
      joke: "«¡Ya ha empezado, déjame entrar!» funciona en la Etapa 2 y solo en la Etapa 2. Para la Etapa 1 la frase correcta es «nos vemos en febrero».",
    },
    {
      id: "refunds",
      heading: "6. Reembolsos (una sección breve)",
      body: [
        "Las entradas son definitivas y no reembolsables desde el momento de la compra. 'Desde la compra' significa desde la compra: un pase de Eliminatorias comprado en septiembre queda bloqueado en septiembre, no en febrero.",
        "Hay exactamente una excepción. Si una etapa se bloquea con menos de 20 participantes, esa etapa queda anulada y cada participante recupera íntegra su entrada de esa etapa, comisión fija incluida. Diecinueve personas no son una competición; son un grupo de WhatsApp con depósito en garantía.",
      ],
      joke: "Esta es la sección más corta del documento porque cada frase que quitamos era una manera más larga de decir «no».",
    },
    {
      id: "predictions",
      heading: "7. Cambia de opinión. Trae para el gas.",
      body: [
        "Los pronósticos de cada partido pueden enviarse y editarse libremente hasta 60 minutos antes de su saque inicial, momento en que se bloquean. Editar es reenviar on-chain: el nuevo pronóstico sobrescribe al anterior y pagas el gas de red cada vez.",
        "Un partido sin pronóstico puntúa 0. El contrato no adivina por ti; ya ha visto lo que pasa cuando la gente adivina.",
      ],
      joke: "Cambiar de opinión es gratis. Haber cambiado de opinión cuesta gas. Hay filósofos con cátedra por mucho menos.",
    },
    {
      id: "scoring",
      heading: "8. Puntuación: 5/3/1 más los bonus de partido decisivo",
      body: [
        "Cada partido otorga como máximo un premio de marcador: 5 puntos por el resultado exacto, 3 puntos por acertar el desenlace con la diferencia de goles correcta, 1 punto por acertar solo el desenlace. Ese es todo el 5/3/1.",
        "Los partidos decisivos de eliminatoria — la vuelta de cada cruce y la final — llevan además tres bonus de +1: que haya prórroga, que haya penaltis y acertar el equipo que pasa (o que levanta el trofeo). Las idas puntúan solo la base: una ida no puede irse a la prórroga, por mucho que lo pareciera. Los bonus de prórroga y penaltis solo se pagan si además acertaste el desenlace correcto de los 90 minutos — saber que un partido se queda en noventa minutos solo es sabiduría si sabías quién lo ganaba. El bonus del clasificado sigue siendo independiente.",
      ],
      joke: "El 5/3/1 no es un esquema táctico. Como esquema táctico sería un expediente disciplinario contra los laterales.",
    },
    {
      id: "ninety-minute-rule",
      heading: "9. La regla de los 90 minutos (respuesta anticipada de soporte)",
      body: [
        "Todos los puntos de marcador se calculan sobre el resultado a los 90 minutos — el marcador del tiempo reglamentario — aunque todos los titulares del planeta den el resultado tras la prórroga como 'el resultado'. La prórroga y los penaltis cuentan exclusivamente a través de los bonus de la Sección 8.",
      ],
      joke: "Sí, hubo prórroga. No, no nos importa. La Sección 9 lleva esperando tu correo desde el minuto 91 y todavía no ha perdido ni una discusión.",
    },
    {
      id: "results-oracle",
      heading: "10. Los resultados los pone un robot",
      body: [
        "Los resultados se publican on-chain mediante un oráculo automático que lee los propios datos de partido de la UEFA. El robot no acepta sobornos; ni siquiera acepta fines de semana. No tiene equipo favorito, no tiene un cuñado con boleto de apuestas y no tiene más plan un martes por la noche que este.",
        "Todo resultado es provisional durante 24 horas, plazo en el que puede corregirse — incluso cuando la UEFA corrige sus propios datos, cosa que ocurre más a menudo de lo que a la UEFA le gustaría reconocer. Las clasificaciones se mueven al instante, marcadas con una insignia de provisional, y el resultado se hace firme automáticamente al cerrarse la ventana.",
      ],
      joke: "Con el robot no se puede discutir. Puedes escribir a un humano, que comprobará lo que leyó el robot, confirmará que el robot lo leyó bien y te mandará, con todo el cariño, un enlace a la Sección 11.",
    },
    {
      id: "mirror-uefa",
      heading: "11. Copiamos a la UEFA al pie de la letra, sanciones incluidas",
      body: [
        "Lo que la UEFA registre como resultado del tiempo reglamentario es el resultado — incluidas las alineaciones indebidas, sanciones, retiradas y los resultados otorgados en los despachos. Si un partido se suspende y se repite, cuenta lo que la UEFA registre finalmente para ese encuentro.",
        "Si la UEFA lo da por 3-0 en los despachos, ese es el marcador. Las reclamaciones, a Nyon. Lleva abrigo: la ciudad es fría, y la ventanilla de apelaciones, más todavía.",
        "Un partido solo se anula si nosotros creamos un encuentro que nunca debió existir. Nuestros errores cuentan; las decisiones de la UEFA, jamás.",
      ],
      joke: "¿Pronosticaste 3-0 en un partido que acabó 3-0 en los despachos? Enhorabuena por tus 5 puntos. El universo a veces se pone de tu lado y, según esta sección, nosotros también copiamos al universo.",
    },
    {
      id: "tie-breaks",
      heading: "12. Desempates, en orden decreciente de dignidad",
      body: [
        "Los empates en la clasificación se resuelven en orden estricto: 1) puntos totales; 2) más resultados exactos; 3) marca de tiempo de inscripción más temprana; 4) dirección de wallet más baja.",
        "Tres de estos criterios premian la habilidad o el compromiso. El cuarto premia haber nacido con suerte — que, como te dirá encantado cualquier delantero, también es una habilidad.",
      ],
      joke: TIE_BREAK_JOKE,
    },
    {
      id: "prizes",
      heading: "13. Premios: el reparto del top-20",
      body: [
        "Cada etapa paga su propio bote a su top 20: 25% al 1.º, 15% al 2.º, 10% al 3.º, 30%÷7 a partes iguales entre los puestos 4–10 y 20%÷10 a partes iguales entre los puestos 11–20. El polvo de redondeo entero va al puesto 1: ser primero tiene ventajas, y algunas son microscópicas.",
        "La Etapa 1 paga en cuanto el último resultado de la jornada 8 supera su ventana provisional de 24 horas; la Etapa 2 paga tras la final. Ni un punto ni un céntimo cruzan jamás de un bote al otro.",
        "El ₵h@mpi0n Definitivo — la mejor puntuación combinada de la temporada — recibe un NFT-trofeo on-chain con un valor monetario de exactamente cero, más una corona en su perfil y una página permanente en el salón de la fama. El cero es deliberado, estructural y eterno: el trofeo lleva gloria, no fondos.",
      ],
      joke: "El NFT-trofeo vale cero por diseño: la única vez en la historia cripto en que el mercado ha estado totalmente de acuerdo con el whitepaper.",
    },
    {
      id: "public-chain",
      heading: "14. La blockchain es pública. Tú también.",
      body: [
        "Todos los pronósticos se guardan en una blockchain pública y cualquiera puede leerlos desde el momento en que los envías: tus rivales, tu grupo de WhatsApp, tu ex y, con el tiempo, un arqueólogo con un explorador de bloques.",
        "El bloqueo (Sección 7) es tu ventana de protección: cuando un partido se bloquea, copiarte se vuelve imposible. Antes del bloqueo, que te copien es simplemente el precio de jugar en público.",
      ],
      joke: "La blockchain no tiene modo incógnito. Tu navegador, a duras penas.",
    },
    {
      id: "smart-contract-risk",
      heading: "15. Riesgo de software (la sección seria)",
      body: [
        "Esta competición funciona sobre contratos inteligentes. Los contratos inteligentes son software; el software tiene errores; la blockchain hace los errores permanentes y públicos. Probamos, auditamos y sometemos los contratos a revisión adversarial — y aun así no podemos prometer perfección, porque nadie puede prometerla honestamente.",
        "Participas bajo tu propio riesgo, hasta e incluyendo la pérdida total de tu entrada por fallo del contrato, fallo de la cadena o tu propia gestión de claves. Nunca pongas en juego lo que no puedas permitirte perder.",
      ],
      joke: "Esta es la única sección que nuestra abogada leyó dos veces y de la que se rio cero veces. Te pedimos que leas con su misma energía.",
    },
    {
      id: "eligibility",
      heading: "16. Elegibilidad: tus deberes, nuestra puerta",
      body: [
        "Al inscribirte, certificas por ti mismo que eres mayor de edad y que participar en una competición de pronósticos de pago basada en la habilidad es legal donde vives. Esos deberes son tuyos: no podemos hacerlos por 195 países, y este párrafo tampoco.",
        "El acceso está bloqueado desde las siguientes 14 jurisdicciones: CN, BD, DZ, EG, NP, AF, KP, IQ, IR, AE, ID, VN, QA, SG. Sus visitantes reciben un HTTP 451, el único código de estado que lleva el nombre de una novela sobre quemar libros — sigue siendo lo más literario que ha hecho un cortafuegos en su vida.",
      ],
      joke: "Saltarte el bloqueo no te hace elegible. Te hace no elegible con pasos extra.",
    },
    {
      id: "uefa-affiliation",
      heading: "17. La UEFA no nos conoce (cláusula obligatoria)",
      body: [
        "₵h@mpi0nz Pr3dict0r no está afiliado a la UEFA ni a la UEFA Champions League, no cuenta con su respaldo ni está asociado con ellas en modo alguno. Los nombres, escudos e insignias de los clubes son propiedad de sus respectivos dueños y aparecen únicamente para identificar los partidos que pronosticas.",
      ],
      joke: "Esta es la única sección en la que legalmente no podemos tener gracia — y, francamente, la UEFA preferiría que las otras dieciocho tampoco la tuvieran.",
    },
    {
      id: "final-authority",
      heading: "18. Si las palabras y el código discrepan, gana el código",
      body: [
        "Estos Términos describen el contrato inteligente desplegado en seis idiomas humanos. Si cualquier frase de cualquiera de ellos discrepa de lo que el contrato desplegado realmente hace, la autoridad final es el contrato desplegado.",
      ],
      joke: "Estos Términos son la adaptación al cine; el bytecode es el libro. Y ya sabes lo que dice todo el mundo, siempre, sobre el libro.",
    },
    {
      id: "credits",
      heading: "19. Créditos",
      body: [
        "Diseño visual: BigMac Bobby, autor de la guía de estilo 'Noches europeas'. Este crédito es contractualmente obligatorio y aparece en todas las páginas, incluida esta.",
      ],
      joke: "BigMac Bobby aceptó cobrar en visibilidad. Esta cláusula es la visibilidad. La cuenta queda saldada por la presente.",
    },
  ],
};

export default es;
