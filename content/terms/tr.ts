import type { TermsDocument } from "./types";

/** Kanonik eşitlik-bozma esprisi — çevrilmez, uyarlanır (ADR-0010). */
export const TIE_BREAK_JOKE =
  "Bütün bunlardan sonra hâlâ eşit misiniz? En düşük cüzdan adresi kazanır: futbol tarihinde doğum anında verilen tek kupa. İstediğiniz kadar antrenman yapın — 0x00 kupayla doğdu, üstelik idmana da gelmiyor.";

const tr: TermsDocument = {
  locale: "tr",
  title: "Şartlar ve Koşullar",
  updated: "2026-07-05",
  sections: [
    {
      id: "preamble",
      heading: "1. Bunu okuyun (evet, gerçekten)",
      body: [
        "Bu Şartlar ve Koşullar, Chiliz Chain üzerinde işletilen ve 2026/27 UEFA Şampiyonlar Ligi sezonunu kapsayan zincir üstü futbol tahmin yarışması ₵h@mpi0nz Pr3dict0r'ı düzenler. Bir katılım satın aldığınızda aşağıdaki her maddeyi kabul etmiş olursunuz — göz gezdirip geçmeyi planladıklarınız dahil.",
        "Bu Şartlar okunsun diye yazıldı; komik olmalarının sebebi bu. Espriler taşıyıcı kolondur: her biri, birilerinin bir yerlerde hakkında şikâyet e-postası yazmaya başladığı bir kuralı işaretler.",
      ],
      joke: "Bu belgedeki her espri hukuki incelemeden geçti. Kuralların tamamı hayatta kaldı; birkaç espri kalamadı. Bölüm 7'nin orijinal final cümlesi için bir dakikalık saygı duruşu.",
    },
    {
      id: "skill-game",
      heading: "2. Beceri oyunu, bahis bürosu değil",
      body: [
        "₵h@mpi0nz Pr3dict0r beceriye dayalı bir tahmin yarışmasıdır. Oran yok, bahisçi yok, sonuçlar üzerinde kasa avantajı yok: her ödül havuzu yalnızca katılım bedelleriyle finanse edilir ve işletmecinin tek geliri Bölüm 4'te belirtilen sabit katılım ücretidir.",
        "Size karşı asla pozisyon almayız. Hangi maçı kimin kazandığı bizim için gerçekten fark etmez — bu da bizi, futbolda bu cümlenin doğru olduğu tek taraf yapar.",
      ],
      joke: "Garantili kazanç arıyorsanız burası hâlâ size göre değil — üstelik artık bu cümleyi okuyup yine de kalan herkesten daha iyi tahmin yapmanız gerekecek.",
    },
    {
      id: "entry-tiers",
      heading: "3. İki bilet, biniş başladı",
      body: [
        "Tam Sezon bileti hem Aşama 1'de (lig aşaması, 1–8. maç haftaları) hem Aşama 2'de (eleme) yarışır. Eleme bileti yalnızca Aşama 2'de yarışır. Cüzdan başına aşama başına bir katılım; Tam Sezon cüzdanı her iki aşamaya otomatik kayıtlıdır, şubatta ikinci bir işlem gerekmez.",
        "Bunu uçuş sınıfları gibi düşünün: Tam Sezon önce biner ve yolculuğun iki bacağını da uçar; Eleme bileti eleme kapısından biner. Diz mesafesi farkı yoktur, yalnızca daha az maç haftası vardır. İki bilete de yemek dahil değildir.",
      ],
      joke: "Kapıda sınıf yükseltme yoktur. Kapı bir akıllı sözleşmedir: bütün bahaneleri dinlemiş, hiçbirini kabul etmemiştir.",
    },
    {
      id: "pricing-and-fees",
      heading: "4. Fiyatlar kesindir. Rahatsız edici derecede kesin.",
      body: [
        "Tam Sezon katılımı tam olarak 1,100 CHZ'dir: 500 CHZ Lig Havuzu'na, 500 CHZ Eleme Havuzu'na, 100 CHZ da sabit işletmeci ücreti. Eleme katılımı tam olarak 550 CHZ'dir: 500 CHZ Eleme Havuzu'na ve 50 CHZ sabit ücret. (Evet, 1,100 İngiliz virgülüyle: rakamlar altı dilde de bayt bayt aynıdır ve virgül pazarlık kabul etmez.)",
        "Sözleşme tutarın tam olmasını şart koşar; ücretler aşama kilidine kadar sözleşmenin içinde emanette tutulur ve kilitle birlikte ücret alıcısına aktarılır. O ana kadar kendi ücretimiz bile bizim değildir: kendimizin de açamadığı bir kapı inşa ettik.",
      ],
      joke: "1,099 CHZ gönderin, sözleşme reddeder. 1,101 CHZ gönderin, onu da reddeder. Pazarlık etmiyor; kapısında güvenlik olan bir aritmetik bu.",
    },
    {
      id: "entry-windows",
      heading: "5. Gişeler vaktinde kapanır. Hakem beklemez.",
      body: [
        "Tam Sezon satışı, 1. haftanın ilk maçının başlama vuruşuyla kesin olarak kapanır. 'Aşağı yukarı başlama vuruşunda' değil: düdük kapanış zilidir ve tarihte hiçbir düdük bekleyen bir işlemi beklememiştir.",
        "Eleme satışı tam o saniyede açılır — dükkân hiç kapanmaz — ve play-off'ların son ilk maçının başlama vuruşundan 60 dakika öncesine kadar açık kalır.",
        "Eleme penceresine geç katılırsanız, çoktan kilitlenmiş her maçtan 0 puan alırsınız. Satın alma ekranı, ödemeden önce tam olarak hangi maçları kaçırdığınızı listeler: gözünüz açık alırsınız — iade taleplerine dayanıklı tek alışveriş biçimi budur.",
      ],
      joke: "«Başladı bile, alın beni içeri!» yalnızca Aşama 2'de işe yarar. Aşama 1 için doğru cümle: «Şubatta görüşürüz.»",
    },
    {
      id: "refunds",
      heading: "6. İadeler (kısa bir bölüm)",
      body: [
        "Katılımlar satın alma anından itibaren kesindir ve iade edilmez. 'Satın alma anından itibaren', satın alma anından itibaren demektir: eylülde alınan bir Eleme bileti eylülde kilitlenir, şubatta değil.",
        "Tam olarak bir istisna vardır. Bir aşama 20'den az katılımcıyla kilitlenirse o aşama iptal edilir ve her katılımcı o aşamanın katılım bedelini sabit ücret dahil eksiksiz geri alır. On dokuz kişi bir yarışma değildir; emanet hesabı olan bir aile WhatsApp grubudur.",
      ],
      joke: "Bu, belgenin en kısa bölümü — çünkü çıkardığımız her cümle, «hayır» demenin daha uzun bir yoluydu.",
    },
    {
      id: "predictions",
      heading: "7. Fikrinizi değiştirin. Gas parasını da getirin.",
      body: [
        "Her maçın tahmini, başlama vuruşundan 60 dakika öncesine kadar serbestçe gönderilebilir ve düzenlenebilir; o anda kilitlenir. Düzenlemek, zincir üstünde yeniden göndermek demektir: yeni tahmin eskisinin üzerine yazılır ve her seferinde ağ gas ücretini siz ödersiniz.",
        "Tahminsiz maç 0 puandır. Sözleşme sizin yerinize tahmin yürütmez; insanlar tahmin yürütünce ne olduğunu görmüştür.",
      ],
      joke: "Fikir değiştirmek bedava. Fikrini değiştirmiş olmak gas ücretine tabi. Filozoflar bundan daha azıyla kürsü kaptı.",
    },
    {
      id: "scoring",
      heading: "8. Puanlama: 5/3/1 artı karar maçı bonusları",
      body: [
        "Her maç en fazla bir skor ödülü verir: kesin skor için 5 puan, doğru sonuç ve doğru averaj için 3 puan, yalnızca doğru sonuç için 1 puan. 5/3/1'in tamamı bu.",
        "Karar maçları — her eşleşmenin rövanşı ve final — ayrıca üç adet +1 bonusu taşır: uzatma oynanması, penaltılara gidilmesi ve turu geçen (veya kupayı kaldıran) takımın doğru bilinmesi. İlk maçlar yalnızca taban puanı verir: bir ilk maç uzatmaya gidemez, ne kadar gitmiş gibi hissettirirse hissettirsin.",
      ],
      joke: "5/3/1 bir diziliş değildir. Diziliş olsaydı, teknik direktörün basın toplantısına gerek kalmadan gönderilirdi.",
    },
    {
      id: "ninety-minute-rule",
      heading: "9. 90 dakika kuralı (destek ekibinin hazır cevabı)",
      body: [
        "Tüm skor puanları 90 dakika sonundaki skora — normal süre skoruna — göre hesaplanır; dünyadaki her manşet uzatma sonrası skoru 'sonuç' diye verse bile. Uzatma ve penaltılar yalnızca Bölüm 8'deki karar maçı bonusları üzerinden sayılır.",
      ],
      joke: "Evet, maç uzatmaya gitti. Hayır, umurumuzda değil. Bölüm 9, e-postanızı 91. dakikadan beri bekliyor ve bugüne kadar tek bir tartışma kaybetmedi.",
    },
    {
      id: "results-oracle",
      heading: "10. Sonuçları bir robot girer",
      body: [
        "Maç sonuçları, UEFA'nın kendi maç verilerini okuyan otomatik bir oracle tarafından zincire yazılır. Robot rüşvet almaz; hafta sonu tatili bile yapmaz. Tuttuğu takım yok, elinde kuponla bekleyen bir eniştesi yok ve salı geceleri bundan başka hiçbir planı yok.",
        "Her sonuç 24 saat boyunca geçicidir ve bu sürede düzeltilebilir — UEFA kendi verisini düzelttiğinde bile, ki bu UEFA'nın kabul etmek isteyeceğinden daha sık olur. Sıralamalar anında hareket eder, geçici rozetiyle işaretlenir ve pencere kapandığında sonuç otomatik olarak kesinleşir.",
      ],
      joke: "Robotla tartışılmaz. Bir insana yazabilirsiniz: robotun ne okuduğuna bakar, doğru okuduğunu teyit eder ve size en içten dileklerle Bölüm 11'in bağlantısını gönderir.",
    },
    {
      id: "mirror-uefa",
      heading: "11. UEFA'yı harfiyen yansıtırız, hükmen dahil",
      body: [
        "UEFA'nın normal süre sonucu olarak kaydettiği her ne ise sonuç odur — hükmen galibiyetler, cezalar, çekilmeler ve masa başı sonuçlar dahil. Bir maç yarıda kalıp yeniden oynanırsa, UEFA'nın o karşılaşma için en son kaydettiği geçerlidir.",
        "UEFA maçı hükmen 3-0 sayarsa skor budur. İtirazınızı Nyon'a iletebilirsiniz. Yanınıza mont alın: şehir soğuktur, itiraz masası daha da soğuk.",
        "Bir maç yalnızca biz hiç var olmaması gereken bir karşılaşma oluşturduysak iptal edilir. Bizim hatalarımız sayılır; UEFA'nın kararları asla.",
      ],
      joke: "Hükmen 3-0 biten maça 3-0 mı demiştiniz? 5 puanınız hayırlı olsun. Evren ara sıra sizden yana oynar — ve bu bölüm uyarınca biz evreni de harfiyen yansıtırız.",
    },
    {
      id: "tie-breaks",
      heading: "12. Eşitlik bozma, azalan haysiyet sırasıyla",
      body: [
        "Sıralamadaki eşitlikler katı bir sırayla bozulur: 1) toplam puan; 2) en çok kesin skor; 3) en erken katılım zaman damgası; 4) en düşük cüzdan adresi.",
        "Bunların üçü beceriyi veya bağlılığı ödüllendirir. Dördüncüsü şanslı doğmayı ödüllendirir — ki bu da, her golcünün size seve seve söyleyeceği gibi, bir beceridir.",
      ],
      joke: TIE_BREAK_JOKE,
    },
    {
      id: "prizes",
      heading: "13. Ödüller: ilk 20 dağılımı",
      body: [
        "Her aşama kendi havuzunu kendi ilk 20'sine öder: 1.'ye 25%, 2.'ye 15%, 3.'ye 10%, 4–10. sıralara eşit paylaşımla 30%÷7 ve 11–20. sıralara eşit paylaşımla 20%÷10. Tam sayı yuvarlama tozu 1. sıraya gider — birinci olmanın ayrıcalıkları vardır ve bazıları mikroskobiktir.",
        "Aşama 1, 8. haftanın son sonucu 24 saatlik geçicilik penceresini tamamlar tamamlamaz öder; Aşama 2 finalden sonra öder. Hiçbir puan ve hiçbir fon iki havuz arasındaki sınırı asla geçmez.",
        "Nihai ₵h@mpi0n — sezonun en iyi toplam skoru — parasal değeri tam olarak sıfır olan zincir üstü bir kupa NFT'si, profil tacı ve şeref salonunda kalıcı bir sayfa kazanır. Bu sıfır bilinçli, yapısal ve ebedidir: kupa şan taşır, para değil.",
      ],
      joke: "Kupa NFT'sinin değeri tasarım gereği sıfırdır — kripto tarihinde piyasanın whitepaper'la tamamen hemfikir olduğu tek an.",
    },
    {
      id: "public-chain",
      heading: "14. Blokzincir halka açıktır. Siz de öylesiniz.",
      body: [
        "Tüm tahminler halka açık bir blokzincire yazılır ve gönderdiğiniz andan itibaren herkes okuyabilir: rakipleriniz, arkadaş grubunuz, eski sevgiliniz ve bir gün elinde blok gezginiyle bir arkeolog.",
        "Kilit (Bölüm 7) sizin koruma pencerenizdir: maç kilitlendikten sonra sizi kopyalamak imkânsızlaşır. Kilitten önce kopyalanmak ise halka açık oynamanın bedelidir.",
      ],
      joke: "Blokzincirin gizli sekmesi yoktur. Tarayıcınızınki de zaten göstermeliktir.",
    },
    {
      id: "smart-contract-risk",
      heading: "15. Yazılım riski (ciddi bölüm)",
      body: [
        "Bu yarışma akıllı sözleşmeler üzerinde çalışır. Akıllı sözleşmeler yazılımdır; yazılımda hata olur; blokzincir hataları kalıcı ve halka açık hale getirir. Sözleşmeleri test ediyor, denetliyor ve düşman gözüyle incelettiriyoruz — yine de kusursuzluk vaat edemeyiz, çünkü bunu kimse dürüstçe vaat edemez.",
        "Riski üstlenerek katılırsınız; sözleşme arızası, zincir arızası veya kendi anahtar yönetiminiz yüzünden bedelinizin tamamını kaybetmek dahil. Kaybetmeyi göze alamayacağınız parayı asla ortaya koymayın.",
      ],
      joke: "Bu, avukatımızın iki kez okuyup sıfır kez güldüğü tek bölüm. Okurken lütfen onun enerjisine eşlik edin.",
    },
    {
      id: "eligibility",
      heading: "16. Uygunluk: ödev sizin, kapı bizim",
      body: [
        "Katılarak, reşit olduğunuzu ve beceriye dayalı ücretli bir tahmin yarışmasına katılmanın yaşadığınız yerde yasal olduğunu kendiniz beyan edersiniz. Bu ödev sizindir: biz 195 ülke için yapamayız, bu paragraf da yapamaz.",
        "Erişim şu 14 yargı bölgesinden engellidir: CN, BD, DZ, EG, NP, AF, KP, IQ, IR, AE, ID, VN, QA, SG. Bu bölgelerden gelen ziyaretçiler HTTP 451 alır — kitap yakmayı anlatan bir romandan adını alan tek durum kodu; bir güvenlik duvarının hayatında yaptığı en edebî şey olmaya devam ediyor.",
      ],
      joke: "Engeli aşmak sizi uygun yapmaz. Sizi fazladan adımlarla uygunsuz yapar.",
    },
    {
      id: "uefa-affiliation",
      heading: "17. UEFA bizi tanımıyor (zorunlu madde)",
      body: [
        "₵h@mpi0nz Pr3dict0r, UEFA veya UEFA Şampiyonlar Ligi ile bağlantılı değildir, onlar tarafından onaylanmamıştır ve hiçbir şekilde ilişkili değildir. Kulüp adları, armaları ve logoları ilgili sahiplerinin mülkiyetindedir ve yalnızca tahmin ettiğiniz maçları tanımlamak için görünür.",
      ],
      joke: "Bu, yasal olarak komik olamayacağımız tek bölüm — ve açıkçası UEFA, diğer on sekizinin de komik olmamasını tercih ederdi.",
    },
    {
      id: "final-authority",
      heading: "18. Sözler ve kod ayrışırsa kod kazanır",
      body: [
        "Bu Şartlar, konuşlandırılmış akıllı sözleşmeyi altı insan dilinde tarif eder. Herhangi birindeki herhangi bir cümle, konuşlandırılmış sözleşmenin fiilen yaptığıyla çelişirse nihai otorite konuşlandırılmış sözleşmedir.",
      ],
      joke: "Bu Şartlar filmin uyarlamasıdır; bytecode kitabın kendisidir. Kitap hakkında herkesin her zaman ne dediğini zaten biliyorsunuz.",
    },
    {
      id: "credits",
      heading: "19. Emeği geçenler",
      body: [
        "Görsel tasarım: 'Avrupa geceleri' stil rehberinin yazarı BigMac Bobby. Bu künye sözleşme gereği zorunludur ve bu sayfa dahil her sayfada yer alır.",
      ],
      joke: "BigMac Bobby ödemeyi görünürlük olarak kabul etti. Bu madde, o görünürlüğün ta kendisidir. Hesap işbu belgeyle kapanmıştır.",
    },
  ],
};

export default tr;
