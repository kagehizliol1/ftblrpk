// ============================================================
//  Azura League Bot  |  Termux Edition
//  Developed By ZemaDev
//  Database: data.json
// ============================================================

const {
    Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, TextDisplayBuilder, ContainerBuilder,
    SeparatorBuilder, MessageFlags, Events, PermissionFlagsBits,
    ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, AuditLogEvent
} = require("discord.js");
const fs   = require("fs");
const path = require("path");

// ── JSON Veritabanı ───────────────────────────────────────
const DB_FILE = path.join(__dirname, "data.json");
function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}", "utf8");
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch { return {}; }
}
function saveDB(d) { try { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2), "utf8"); } catch (e) { console.error("[DB]", e); } }
const db = {
    async get(k)    { return loadDB()[k] ?? null; },
    async set(k, v) { const d = loadDB(); d[k] = v; saveDB(d); return v; },
    async delete(k) { const d = loadDB(); delete d[k]; saveDB(d); },
    async list(p="") { return Object.keys(loadDB()).filter(k => k.startsWith(p)); }
};

// ── Client ────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildExpressions,
    ]
});

const PREFIX = ".";
const EPH = MessageFlags.Ephemeral;
const CV2 = [MessageFlags.IsComponentsV2];

// ── Emojiler ──────────────────────────────────────────────
const E = {
    asist:    "<:asist:1545853726462582904>",
    cizgi:    "<a:cizgi:1545853420403953746>",
    futbolcu: "<:antrenman:1540724725557502012>",
    gol:      "<:penalti:1540724693324144820>",
    kirmizi:  "<:kirmizikart:1545854262200766495>",
    kurtaris: "<:eldiven:1540724649850314793>",
    nokta:    "<a:nokta:1545855133093597255>",
    onay:     "<a:tik:1545182224834502736>",
    red:      "<:redd:1545182159621333062>",
    saha:     "<:saha:1545856462839091300>",
    sari:     "<:sarikart:1545856928171954289>",
    transfer: "<:transfer:1545857286591741992>",
    urun:     "<:urun:1545857463100899459>",
    vs:       "<:vs:1545857928555143352>",
    win:      "<a:kupa:1540724754468573344>",
    yardim:   "<:yardim:1545858358005866506>",
    tik: "✅", hata: "❌", uyari: "⚠️",
    nitelik: "🎖️", zaman: "⏰", kilit: "🔒", kalkan: "🛡️",
    tac: "👑", hediye: "🎁", ig: "📸", tw: "🐦",
};
const footer = () => `${E.cizgi} Azura League Bot | Developed By ZemaDev`;

// ── CV2 Yardımcıları ──────────────────────────────────────
const cvSend   = (ch, c) => ch.send({ components: [c.toJSON()], flags: CV2 });
const cvUpdate = (i,  c) => i.update({ components: [c.toJSON()], flags: CV2, content: null, embeds: [] });
const cvReply  = (m,  c) => m.reply({ components: [c.toJSON()], flags: CV2 });
const eph      = (i,  t) => i.reply({ content: t, flags: EPH }).catch(() => i.followUp({ content: t, flags: EPH }).catch(() => {}));

// ── Geçici Hafıza ─────────────────────────────────────────
const snipeCache      = new Map();
const snipeAllCache   = new Map();
const afkMap          = new Map();
const cooldowns       = new Map();
const spamKontrol     = new Map();
const cekilisler      = new Map();
const guardSayac      = new Map();
const dropTimers      = new Map();
const sayiOyunlari    = new Map();
const bilmeceOyunlari = new Map();
const soruOyunlari    = new Map();

const GUARD = { banlar: 3, kickler: 5, kanalSilme: 3, rolSilme: 3, zaman: 12000 };

// ============================================================
//  STAT SİSTEMİ — TAM LİSTE
// ============================================================
const STAT_GRUPLARI = {
    "Atak": [
        "Orta Açma","Bitiricilik","Kafa İsabeti","Kısa Pas","Voleler","Zayıf Ayak"
    ],
    "Savunma": [
        "Ayakta Müdahale","Kayarak Müdahale"
    ],
    "Beceri": [
        "Dribbling","Falso","Serbest Vuruş İsabeti","Uzun Pas","Top Kontrolü"
    ],
    "Güç": [
        "Şut Gücü","Zıplama","Dayanıklılık","Güç","Uzaktan Şut"
    ],
    "Hareket": [
        "Hızlanma","Sprint Hızı","Çeviklik","Reaksiyonlar","Denge"
    ],
    "Mantalite": [
        "Agresiflik","Top Kesme","Pozisyon Alma","Görüş","Penaltı"
    ],
    "Kaleci": [
        "Kaleci Atlayışı","KL Top Kontrolü","KL Vuruş","KL Pozisyon Alma","KL Refleksler"
    ],
};

// Tüm stat isimleri (büyük/küçük fark etmez araması için)
const TUM_STATLAR = Object.values(STAT_GRUPLARI).flat();

// Stat adını normalize ederek bul (büyük/küçük, Türkçe karakter fark etmez, kısmi eşleşme)
function norm(s) {
    return (s || "").toLowerCase()
        .replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s")
        .replace(/ı/g,"i").replace(/i̇/g,"i").replace(/ö/g,"o").replace(/ç/g,"c")
        .replace(/â/g,"a").replace(/\s+/g," ").trim();
}
function statBul(input) {
    const n = norm(input);
    if (!n) return null;
    // 1. Tam eşleşme
    const tam = TUM_STATLAR.find(s => norm(s) === n);
    if (tam) return tam;
    // 2. Kısmi eşleşme — girdi stat içinde geçiyor mu
    const kismi = TUM_STATLAR.filter(s => norm(s).includes(n) || n.includes(norm(s)));
    if (kismi.length === 1) return kismi[0];
    // 3. Kelime bazlı eşleşme — her kelime statın kelimelerinden biriyle eşleşiyor mu
    const girisKelimeler = n.split(" ");
    const skorlar = TUM_STATLAR.map(s => {
        const statKelimeler = norm(s).split(" ");
        const eslesenler = girisKelimeler.filter(k => statKelimeler.some(sk => sk.startsWith(k) || k.startsWith(sk)));
        return { stat: s, skor: eslesenler.length / Math.max(girisKelimeler.length, statKelimeler.length) };
    });
    skorlar.sort((a, b) => b.skor - a.skor);
    if (skorlar[0].skor >= 0.5) return skorlar[0].stat;
    return null;
}

// Hangi gruba ait
function statGrubu(statAdi) {
    for (const [grup, liste] of Object.entries(STAT_GRUPLARI)) {
        if (liste.includes(statAdi)) return grup;
    }
    return "Genel";
}

// ============================================================
//  NİTELİK DROPU — TÜM STATLAR LİSTESİNDEN
// ============================================================
function dropNitelikOlustur() {
    // Direkt stat listesinden rastgele bir stat seç, deger = 5 sabit
    const stat = rastgele(TUM_STATLAR);
    const grup = statGrubu(stat);
    const nadirMap = { "Atak":"nadir","Hareket":"nadir","Kaleci":"nadir","Savunma":"yaygın","Beceri":"yaygın","Güç":"yaygın","Mantalite":"yaygın" };
    return {
        stat,
        grup,
        deger: 5,
        nadirlik: nadirMap[grup] || "yaygın",
    };
}

function nadirlikStr(n) {
    return { "yaygın":"⚪ Yaygın","nadir":"🔵 Nadir","efsane":"🌟 Efsane" }[n] || "⚪ Yaygın";
}

// ============================================================
//  YARDIMCI FONKSİYONLAR
// ============================================================
function statBar(v) {
    const d = Math.round((v / 99) * 10);
    return `\`${"█".repeat(d)}${"░".repeat(10 - d)}\``;
}
function grupOrt(statlar, grup) {
    const keys = STAT_GRUPLARI[grup] || [];
    if (!keys.length) return 50;
    return Math.round(keys.map(k => statlar[k] || 50).reduce((a,b)=>a+b,0) / keys.length);
}
function hesaplaOVR(statlar) {
    const v = Object.values(statlar || {});
    return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length) : 50;
}
function tarihStr() { return new Date().toLocaleDateString("tr-TR"); }
function saatStr()  { return new Date().toLocaleString("tr-TR"); }
function rastgele(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sureyiMs(s) {
    const m = s?.match(/^(\d+)([smhd])$/);
    if (!m) return null;
    return parseInt(m[1]) * ({s:1000,m:60000,h:3600000,d:86400000}[m[2]]||0);
}
function normalizeStr(s) {
    return (s||"").toLowerCase()
        .replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s")
        .replace(/ı/g,"i").replace(/ö/g,"o").replace(/ç/g,"c")
        .replace(/[^a-z0-9]/g,"").trim();
}
function benzerlikSkoru(a, b) {
    const na = a.toLowerCase().replace(/[^\wğüşıöç ]/gi,"").trim();
    const nb = b.toLowerCase().replace(/[^\wğüşıöç ]/gi,"").trim();
    if (na===nb) return 100;
    if (na.includes(nb)||nb.includes(na)) return 85;
    const sA=new Set(na.split("")), sB=new Set(nb.split(""));
    const c=[...sA].filter(x=>sB.has(x)).length;
    return Math.round((c/Math.max(sA.size,sB.size))*60);
}
function enYakinRol(guild, takimAdi) {
    if (!takimAdi) return null;
    let best=null, bestScore=0;
    for (const [,r] of guild.roles.cache) {
        if (r.managed||r.name==="@everyone") continue;
        const s=benzerlikSkoru(r.name,takimAdi);
        if (s>bestScore&&s>=40) { bestScore=s; best=r; }
    }
    return best;
}
async function uyeBul(guild, sorgu) {
    if (!sorgu) return null;
    const t=sorgu.replace(/[<@!>]/g,"").trim();
    if (/^\d+$/.test(t)) return guild.members.fetch(t).catch(()=>null);
    await guild.members.fetch({query:sorgu.split("#")[0],limit:5}).catch(()=>{});
    return guild.members.cache.find(m=>
        m.user.tag.toLowerCase()===sorgu.toLowerCase()||
        m.user.username.toLowerCase()===sorgu.toLowerCase()||
        m.displayName.toLowerCase()===sorgu.toLowerCase()
    )||null;
}
async function auditYapan(guild, tip, hedefId=null) {
    try {
        const logs=await guild.fetchAuditLogs({type:tip,limit:1});
        const e=logs.entries.first();
        if (!e) return null;
        if (hedefId&&e.target?.id!==hedefId) return null;
        if (Date.now()-e.createdTimestamp>5000) return null;
        return e.executor;
    } catch { return null; }
}

// ============================================================
//  CONFIG SİSTEMİ
// ============================================================
async function getConfig(guildId) {
    return (await db.get(`config_${guildId}`)) || {
        kanalAntrenman:null,kanalPenalti:null,kanalLog:null,
        kanalTicket:null,kanalKap:null,kanalSezon:null,
        kanalGuard:null,kanalNitelikDrop:null,
        kanalItiraf:null,kanalIg:null,kanalTw:null,kanalLeaderboard:null,
        adminRoller:[],modRoller:[],
        yasakliKelimeler:[],
        spamKoruma:true,spamLimit:5,spamSure:4000,
        ticketSebebleri:["Genel Destek","Teknik Sorun","Transfer Talebi","Şikâyet","Diğer"],
        otomatikRol:true,sezonAdi:"2024-25",
        guardAktif:true,
        nitelikDropAktif:false,nitelikDropSure:3600000,
    };
}
async function saveConfig(guildId, cfg) { await db.set(`config_${guildId}`,cfg); }
async function isAdmin(m) {
    if (!m) return false;
    if (m.permissions.has(PermissionFlagsBits.Administrator)) return true;
    const cfg=await getConfig(m.guild.id);
    return cfg.adminRoller.some(r=>m.roles.cache.has(r));
}
async function isMod(m) {
    if (!m) return false;
    if (await isAdmin(m)) return true;
    const cfg=await getConfig(m.guild.id);
    return cfg.modRoller.some(r=>m.roles.cache.has(r))||m.permissions.has(PermissionFlagsBits.ModerateMembers);
}

// ============================================================
//  LOG SİSTEMİ
// ============================================================
async function log(guild, kategori, icerik) {
    try {
        const cfg=await getConfig(guild.id);
        if (!cfg.kanalLog) return;
        const k=guild.channels.cache.get(cfg.kanalLog);
        if (!k) return;
        const em={TRANSFER:"🔄",KİRALIK:"📋",FESİH:"❌",SERBEST:"🆓",SATILIK:"💲",TİCKET:"🎫",ANTRENMAN:"🏋️",ADMIN:"⚙️",SEZON:"📅",SPAM:"🚨",YASAKLI:"🔞",KUP:"🏆",SAKATLIK:"🩹",ÇEKİLİŞ:"🎰",KAP:"📝",GİRİŞ:"📥",ÇIKIŞ:"📤",BAN:"🔨",UNBAN:"✅",KANAL:"📢",ROL:"🎭",SES:"🔊",GUARD:"🛡️",DROP:"🎖️",İTİRAF:"💬",IG:"📸",TW:"🐦"};
        const emoji=em[kategori]||"📋";
        await k.send(`${emoji} \`[${kategori}]\` ${icerik}\n${E.cizgi} *${saatStr()}*`);
    } catch {}
}

// ============================================================
//  GUARD
// ============================================================
async function guardKontrol(guild, userId, tip) {
    const cfg=await getConfig(guild.id);
    if (!cfg.guardAktif||userId===client.user.id) return;
    const now=Date.now();
    const gs=guardSayac.get(userId)||{banlar:0,kickler:0,kanalSilme:0,rolSilme:0,son:now};
    if (now-gs.son>GUARD.zaman){gs.banlar=0;gs.kickler=0;gs.kanalSilme=0;gs.rolSilme=0;}
    gs[tip]=(gs[tip]||0)+1; gs.son=now;
    guardSayac.set(userId,gs);
    const asim=gs.banlar>=GUARD.banlar||gs.kickler>=GUARD.kickler||gs.kanalSilme>=GUARD.kanalSilme||gs.rolSilme>=GUARD.rolSilme;
    if (!asim) return;
    guardSayac.delete(userId);
    try { const h=await guild.members.fetch(userId).catch(()=>null); if(h) for(const[,r]of h.roles.cache) if(!r.managed&&r.id!==guild.id) await h.roles.remove(r).catch(()=>{}); } catch {}
    const msg=`${E.kalkan} **GUARD — SALDIRI TESPİT EDİLDİ!**\n${E.cizgi} Kullanıcı: <@${userId}> — Tüm rolleri kaldırıldı!`;
    await log(guild,"GUARD",msg);
    const gk=cfg.kanalGuard?guild.channels.cache.get(cfg.kanalGuard):guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages));
    if (gk) await gk.send(msg).catch(()=>{});
}

// ============================================================
//  OYUNCU VERİTABANI
// ============================================================
async function getOyuncu(id) {
    const d=await db.get(`oyuncu_${id}`);
    if (d) return d;
    const yeni={
        kayitTarihi:tarihStr(),ulke:"TR",mevki:"NO",discord:"",
        overall:50,statlar:{},haftalik:{},
        sezon:{gol:0,asist:0,mac:0},
        kariyer:{gol:0,asist:0,mac:0},
        penalti:{atis:0,gol:0,kurtaris:0},
        sakatlik:null,kupalar:[],
        antrenman:{toplam:0,buHafta:0},
        mevcutTakim:null,mevcutRolId:null,
        takimGecmisi:[],piyasaDurumu:"normal",
        nitelikler:[],ig:null,tw:null,
    };
    for(const[,liste] of Object.entries(STAT_GRUPLARI)) for(const s of liste) yeni.statlar[s]=50;
    await db.set(`oyuncu_${id}`,yeni);
    return yeni;
}
async function saveOyuncu(id, data) {
    data.overall=hesaplaOVR(data.statlar);
    await db.set(`oyuncu_${id}`,data);
}

// ============================================================
//  NİTELİK DROP SİSTEMİ
// ============================================================
async function dropGonder(guild) {
    try {
        const cfg=await getConfig(guild.id);
        if (!cfg.nitelikDropAktif||!cfg.kanalNitelikDrop) return;
        const k=guild.channels.cache.get(cfg.kanalNitelikDrop);
        if (!k) return;
        const n=dropNitelikOlustur();
        const dropId=`drop_${guild.id}_${Date.now()}`;
        await db.set(dropId,{stat:n.stat,grup:n.grup,deger:n.deger,nadirlik:n.nadirlik,guildId:guild.id,zaman:Date.now(),toplayan:null,topiayanAd:null,aktif:true});
        const c=new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `${E.nitelik} **NİTELİK DROPU ÇIKTI!**\n\n` +
                `${E.cizgi} Stat: **${n.stat}** (${n.grup} Grubu)\n` +
                `${E.cizgi} Değer: **+${n.deger}** puan\n` +
                `${E.cizgi} Nadirlik: **${nadirlikStr(n.nadirlik)}**\n\n` +
                `${E.uyari} Sadece **1 kişi** toplayabilir! İlk tıklayan kazanır.\n${E.zaman} ${saatStr()}`
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`droptopla_${dropId}`).setLabel("🎖️ Niteliği Topla!").setStyle(ButtonStyle.Success)
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
        await cvSend(k,c);
        await log(guild,"DROP",`Drop gönderildi: **${n.stat}** +${n.deger} (${nadirlikStr(n.nadirlik)})`);
    } catch(e){ console.error("[Drop]",e); }
}
function dropBaslat(guild) {
    if (dropTimers.has(guild.id)) return;
    getConfig(guild.id).then(cfg=>{
        if (!cfg.nitelikDropAktif||!cfg.kanalNitelikDrop) return;
        const sure=cfg.nitelikDropSure||3600000;
        dropTimers.set(guild.id,setInterval(()=>dropGonder(guild),sure));
    });
}
function dropDurdur(guildId) {
    if (dropTimers.has(guildId)){clearInterval(dropTimers.get(guildId));dropTimers.delete(guildId);}
}

// ============================================================
//  OYUN VERİLERİ
// ============================================================
const BILMECELER=[
    {s:"Ayakları var ama yürüyemez, sırtı var ama acımaz. Nedir?",c:"sandalye"},
    {s:"Ne kadar yıkarsan o kadar küçülür. Nedir?",c:"sabun"},
    {s:"Her zaman önünde ama asla göremezsin. Nedir?",c:"gelecek"},
    {s:"Söylediğinde kırılır. Nedir?",c:"sessizlik"},
    {s:"Futbolda bir takımda kaç oyuncu olur?",c:"11"},
    {s:"Penaltı atışı kaç metreden yapılır?",c:"11"},
    {s:"Futbol maçı kaç dakika sürer?",c:"90"},
    {s:"Sarı kartın ardından gelen kart nedir?",c:"kirmizi"},
    {s:"Gol kutlamasında oyuncuların çektiği görüntü nedir?",c:"frikik"},
];
const GENEL_SORULAR=[
    {s:"Dünyanın en büyük okyanusu hangisidir?",c:"pasifik"},
    {s:"Türkiye'nin başkenti neresidir?",c:"ankara"},
    {s:"Su'nun kimyasal formülü nedir?",c:"h2o"},
    {s:"En hızlı kara hayvanı hangisidir?",c:"cita"},
    {s:"FIFA Dünya Kupası kaç yılda bir düzenlenir?",c:"4"},
    {s:"Güneş sistemimizdeki gezegen sayısı kaçtır?",c:"8"},
    {s:"İnsan vücudunda kaç kemik vardır?",c:"206"},
    {s:"Olimpiyat halkaları kaç tanedir?",c:"5"},
];
const MAC_SORULAR=[
    {s:"2022 FIFA Dünya Kupası'nı hangi takım kazandı?",c:"arjantin"},
    {s:"Türkiye'nin milli takımındaki forma rengi nedir?",c:"kirmizi"},
    {s:"Premier Lig'in en fazla şampiyonu olan takım?",c:"manchester united"},
    {s:"Champions League'de en fazla kez şampiyon olan kulüp?",c:"real madrid"},
    {s:"Fenerbahçe'nin renkleri nelerdir?",c:"sari lacivert"},
    {s:"Galatasaray kaç kez UEFA şampiyonu olmuştur?",c:"1"},
    {s:"Bir futbol sahası yaklaşık kaç metre uzunluğundadır?",c:"105"},
    {s:"Kırmızı kart kaç dakika erken oyundan çıkarmayı getirir?",c:"sonuna kadar"},
    {s:"Beşiktaş'ın formaları genellikle hangi renktedir?",c:"siyah beyaz"},
    {s:"Offside (ofsayt) nedir?",c:"son savunmacidan once"},
];
const DOGRULUK_SORUSU=["Bugün birine yalan söyledin mi?","En büyük korkunun ne olduğunu söyle.","Gizlice sevdiğin biri var mı?","En büyük hayalin nedir?","Şu an en çok kimi özlüyorsun?","Bugün en son ne zaman ağladın?","Hayatında en çok pişman olduğun şey nedir?","Hayatında en mutlu olduğun an?"];
const CESARET_SORUSU=["En yakın arkadaşını ara ve garip bir şey söyle.","Sunucuda en güzel profil kiminindir? Söyle.","En tuhaf alışkanlığın nedir?","Şu an gülünç bir şey yap ve fotoğrafını paylaş.","Sunucudaki bir kişi hakkında itirafta bulun.","En son ne yaptığında utandın?","Hiç arkadaşına ihanet ettin mi?"];

// ============================================================
//  YARDIM SİSTEMİ
// ============================================================
const YARDIM_KAT = {
    oyuncu:    {label:"⚽ Oyuncu",      desc:"Kariyer, stat, profil komutları"},
    antrenman: {label:"🏋️ Antrenman",   desc:"Antrenman kayıt ve maç komutları"},
    kap:       {label:"🔄 Transfer",    desc:"Kap ve transfer sistemi"},
    nitelik:   {label:"🎖️ Nitelik",     desc:"Nitelik drop ve yönetim"},
    sosyal:    {label:"📱 Sosyal Medya",desc:"Instagram ve Twitter sistemi"},
    eglence:   {label:"🎉 Eğlence",     desc:"Oyunlar, çekiliş, eğlence"},
    ticket:    {label:"🎫 Ticket",      desc:"Destek ticket sistemi"},
    admin:     {label:"⚙️ Admin/Mod",   desc:"Yönetici komutları"},
};
const YARDIM_IC = {
    oyuncu:
`⚽ **OYUNCU KOMUTLARI**

${E.cizgi} \`.kariyer [@kullanici]\` — Tüm kariyer kartı (stat grupları, sezon, kupa, sakatlık)
${E.cizgi} \`.s [@kullanici]\` — Hızlı stat özeti + butonlu navigasyon
${E.cizgi} \`.statlar [@kullanici]\` — Tüm stat grupları detaylı liste
${E.cizgi} \`.antrenman [@kullanici]\` — Bu haftanın antrenmanları
${E.cizgi} \`.penaltistat [@kullanici]\` — Penaltı istatistikleri
${E.cizgi} \`.takim [@kullanici]\` — Takım geçmişi
${E.cizgi} \`.karsilastir @A @B\` — İki oyuncuyu karşılaştır
${E.cizgi} \`.top10\` — Sunucunun en iyi 10 oyuncusu
${E.cizgi} \`.piyasa\` — Satılık/kiralık/serbest oyuncular
${E.cizgi} \`.niteliklerim [@kullanici]\` — Kazanılan nitelikler
${E.cizgi} \`.profil guncelle [ulke/mevki/discord/ig/tw] [deger]\` — Profil güncelle
${E.cizgi} \`.lb [ovr/gol/asist/antrenman]\` — Leaderboard`,

    antrenman:
`🏋️ **ANTRENMAN & MAÇ KOMUTLARI**

${E.cizgi} \`+1 [stat adı]\` — Antrenman kanalında haftalık stat kaydet
   Örnek: \`+1 Bitiricilik\`, \`+1 Dribbling\`, \`+1 Hızlanma\`
${E.cizgi} \`.antrenman [@kullanici]\` — Bu haftanın antrenman özeti
${E.cizgi} \`.penalti\` veya \`.pen\` veya \`.vur\` — Penaltı at (15dk bekleme)
${E.cizgi} \`.gol ekle @kullanici\` — Gol ekle *(Admin/Mod)*
${E.cizgi} \`.asist ekle @kullanici\` — Asist ekle *(Admin/Mod)*
${E.cizgi} \`.mac ekle @kullanici\` — Maç ekle *(Admin/Mod)*
${E.cizgi} \`.fix\` — Haftalık antrenmanları statlarına uygula *(Admin/Mod)*
${E.cizgi} \`.sezonkapat\` — Sezonu kapat, kariyere işle *(Admin)*

**Stat Listesi:**
\`.statlistesi\` komutu ile tüm antrenman edilebilir statları görebilirsin.`,

    kap:
`🔄 **KAP / TRANSFER SİSTEMİ**

${E.cizgi} \`.kap\` — Transfer formu aç (5 işlem tipi seçilebilir)
   Form kap kanalına gönderilir → Admin/Mod onaylar → Rol otomatik atanır
${E.cizgi} \`.piyasa\` — Satılık/kiralık/serbest oyuncuları listele
${E.cizgi} \`.takim [@kullanici]\` — Takım geçmişini göster

**Admin/Mod Komutları:**
${E.cizgi} \`.kapgiris @kullanici [takım] [ücret] [transfer/kiralik]\` — Direkt takıma ekle
${E.cizgi} \`.kapcikis @kullanici\` — Serbest bırak
${E.cizgi} \`.fesih @kullanici\` — Sözleşme feshi (fesih kaydı tutulur)
${E.cizgi} \`.takimayarla @kullanici [takım]\` — Sadece takım ismini değiştir
${E.cizgi} \`.piyasadurumu @kullanici [normal/satilik/kiralik/serbest]\` — Piyasa durumu`,

    nitelik:
`🎖️ **NİTELİK DROPU SİSTEMİ**

Belirlenen kanala her N dakikada bir nitelik dropu gelir.
Butona tıklayan **ilk kişi** kazanır (1 kişi). Kazanan kişi adı gösterilir.
Tıklayan kişi o dropun statından **+5 puan** kazanır.

${E.cizgi} \`.niteliklerim [@kullanici]\` — Kazanılan nitelik geçmişi
${E.cizgi} \`.setup nitelikdrop [ac/kapat] [dakika]\` — Drop sistemini aç/kapat

**Admin/Mod Komutları:**
${E.cizgi} \`.nitelikver @kullanici [stat] [miktar]\` — Elle nitelik ver
${E.cizgi} \`.niteliksil @kullanici [sıra no]\` — Nitelik sil

**Nadirlik:** ⚪ Yaygın → 🔵 Nadir → 🌟 Efsane
Drop statları gerçek stat listesinden gelir, rastgele değil!`,

    sosyal:
`📱 **SOSYAL MEDYA SİSTEMİ**

**📸 Instagram:**
${E.cizgi} \`.ig hesap [kullanıcıadı]\` — Instagram hesabı aç
${E.cizgi} \`.ig durum [biyografi]\` — Biyografi güncelle
${E.cizgi} \`.ig post [metin]\` — Post paylaş (beğeni/yorum butonları çıkar)
${E.cizgi} \`.ig profil [@kullanici]\` — Profil ve son postları gör
${E.cizgi} \`.ig takipet @kullanici\` — Takip et

**🐦 Twitter/X:**
${E.cizgi} \`.tw hesap [kullanıcıadı]\` — Twitter hesabı aç
${E.cizgi} \`.tw durum [biyografi]\` — Bio güncelle
${E.cizgi} \`.tw tweet [metin]\` — Tweet at (max 280 karakter)
${E.cizgi} \`.tw profil [@kullanici]\` — Profil ve son tweetler
${E.cizgi} \`.tw takipet @kullanici\` — Takip et`,

    eglence:
`🎉 **EĞLENCE KOMUTLARI**

${E.cizgi} \`.zar\` — 🎲 Zar at
${E.cizgi} \`.yaztura\` — 🪙 Yazı-tura
${E.cizgi} \`.top8 [soru]\` — 🎱 Sihirli top cevap ver
${E.cizgi} \`.kelimeoyunu\` — 🔤 Karışık futbol kelimesi tahmin et
${E.cizgi} \`.bilmece\` — 🧩 Bilmece sor (60sn cevap süresi)
${E.cizgi} \`.soru\` — ❓ Genel kültür sorusu (30sn)
${E.cizgi} \`.macsoru\` — ⚽ Futbol/maç sorusu (30sn)
${E.cizgi} \`.sayioyunu [1-1000]\` — 🔢 Sayı tahmin oyunu
${E.cizgi} \`.dogrulukcesaret\` — 🎭 Doğruluk mu cesaret mi
${E.cizgi} \`.itirafpanel\` — 💬 Anonim itiraf paneli kur *(Mod)*
${E.cizgi} \`.cekilis olustur [ödül] [süre]\` — Çekiliş başlat *(Mod)*
${E.cizgi} \`.cekilis [katil/bilgi/bitir/iptal]\`
${E.cizgi} \`.snipe\` / \`.snipeall\` — Silinen mesajları gör
${E.cizgi} \`.afk [sebep]\` / \`.afkkaldir\`
${E.cizgi} \`.istatistik\` — Sunucu istatistikleri`,

    ticket:
`🎫 **TİCKET SİSTEMİ**

${E.cizgi} \`.ticketpanel\` — Ticket paneli kur *(Admin)*
   → Kullanıcılar panelden sebep seçerek ticket açar
   → Tüm admin/mod rolleri otomatik olarak bildirim alır
${E.cizgi} \`.ticketkapat\` — Aktif ticketi kapat
${E.cizgi} \`.ticketsil\` — Kanal sil *(Admin)*
${E.cizgi} \`.ticketdevret @mod\` — Başka moderatöre devret
${E.cizgi} \`.ticketnot [mesaj]\` — Ticket notuna not ekle
${E.cizgi} \`.ticketlog\` — Kapalı ticket listesi *(Mod)*
${E.cizgi} \`.ticketkalite [1-5]\` — Kalite puanı ver

**Ticket İçi Butonlar:** 🔒 Kapat | 📝 Not | ↗️ Devret | ⭐ Puan | 🗑️ Sil`,

    admin:
`⚙️ **ADMİN / MOD KOMUTLARI**

**Oyuncu Yönetimi:**
${E.cizgi} \`.stat ayarla @k [stat] [1-99]\` — Stat değiştir
${E.cizgi} \`.kupa ekle @k [ad]\` — Kupa ver
${E.cizgi} \`.sakatlik @k [sebep] [gün]\` — Sakatlık ekle
${E.cizgi} \`.sakatliksil @k\` — Sakatlık kaldır
${E.cizgi} \`.stalsil @k\` — Haftalık antrenman sıfırla
${E.cizgi} \`.oyuncusifirla @k\` — Tüm oyuncu verisini sıfırla *(Admin)*
${E.cizgi} \`.fix\` — Haftalık antrenmanları statlarına işle
${E.cizgi} \`.sezonkapat\` — Sezon kapat *(Admin)*
${E.cizgi} \`.nitelikver @k [stat] [miktar]\` — Elle nitelik ver
${E.cizgi} \`.niteliksil @k [no]\` — Nitelik sil

**Sistem:**
${E.cizgi} \`.setup\` — Kurulum paneli
${E.cizgi} \`.guard\` — Guard durumu
${E.cizgi} \`.yetkilistat\` — Yetkili aktivite istatistikleri
${E.cizgi} \`.bas [mesaj]\` — Kanalda duyuru yap *(Admin)*`,
};

function cvYardimMenu() {
    const menu=new StringSelectMenuBuilder().setCustomId("yardim_kategori").setPlaceholder("📂 Kategori seç...")
        .addOptions(Object.entries(YARDIM_KAT).map(([v,d])=>
            new StringSelectMenuOptionBuilder().setLabel(d.label).setDescription(d.desc).setValue(v)
        ));
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `${E.yardim} **Azura League BOT — KOMUT REHBERİ**\n\n${E.cizgi} Prefix: \`${PREFIX}\`\n${E.cizgi} Aşağıdan kategori seçerek komutları görüntüle.\n${E.nokta} Komutlar büyük/küçük harf fark etmeden çalışır.`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}
function cvYardimKat(kat) {
    const menu=new StringSelectMenuBuilder().setCustomId("yardim_kategori").setPlaceholder("📂 Başka kategori...")
        .addOptions(Object.entries(YARDIM_KAT).map(([v,d])=>
            new StringSelectMenuOptionBuilder().setLabel(d.label).setDescription(d.desc).setValue(v).setDefault(v===kat)
        ));
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.yardim} **${YARDIM_KAT[kat]?.label||kat}**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(YARDIM_IC[kat]||"Bulunamadı."))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

// ============================================================
//  CV2 CONTAINER'LAR
// ============================================================
function cvBilgi(icerik, row=null) {
    const c=new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(icerik))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
    if (row) c.addActionRowComponents(row);
    return c;
}

// Kariyer kartı — tag yerine isim
function cvKariyer(member, oyuncu, showBtns=true) {
    const isim=member.displayName||member.user.username;
    const grupSatir=Object.keys(STAT_GRUPLARI).map(g=>`${g.padEnd(11)} ${statBar(grupOrt(oyuncu.statlar,g))} **${grupOrt(oyuncu.statlar,g)}**`).join("\n");
    const kup=oyuncu.kupalar?.length?oyuncu.kupalar.map(k=>`🏆 ${k}`).join("\n"):`${E.nokta} *Henüz kupa yok*`;
    const sak=oyuncu.sakatlik?`${E.kirmizi} **${oyuncu.sakatlik.neden}** — ${oyuncu.sakatlik.bitTarih}e kadar`:`${E.tik} *Sağlıklı*`;
    const pEmoji={satilik:"💲 Satılık",kiralik:"🔄 Kiralık",serbest:"🆓 Serbest"}[oyuncu.piyasaDurumu]||"";
    const c=new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.futbolcu} **${isim}**${pEmoji?` — ${pEmoji}`:""}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `📋 **Profil**\n` +
            `${E.cizgi} Ülke: **${oyuncu.ulke||"TR"}** ${E.nokta} Mevki: **${oyuncu.mevki||"NO"}**\n` +
            `${E.cizgi} Kayıt: **${oyuncu.kayitTarihi||"-"}**\n` +
            `${E.cizgi} Takım: ${oyuncu.mevcutTakim?`${E.transfer} **${oyuncu.mevcutTakim}**${oyuncu.mevcutRolId?` (<@&${oyuncu.mevcutRolId}>)`:""}`:`${E.nokta} *Takımsız*`}\n` +
            `${E.cizgi} Instagram: ${oyuncu.ig?`@${oyuncu.ig}`:"*Yok*"} ${E.nokta} Twitter: ${oyuncu.tw?`@${oyuncu.tw}`:"*Yok*"}\n` +
            `${E.cizgi} Nitelik: **${oyuncu.nitelikler?.length||0}** adet`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**${E.urun} Overall: ${oyuncu.overall}**\n\n${grupSatir}`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**${E.saha} Sezon**\n${E.gol} Gol: **${oyuncu.sezon?.gol??0}** ${E.nokta} ${E.asist} Asist: **${oyuncu.sezon?.asist??0}** ${E.nokta} Maç: **${oyuncu.sezon?.mac??0}**\n` +
            `**📈 Kariyer**\n${E.gol} Gol: **${oyuncu.kariyer?.gol??0}** ${E.nokta} ${E.asist} Asist: **${oyuncu.kariyer?.asist??0}** ${E.nokta} Maç: **${oyuncu.kariyer?.mac??0}**`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**🏆 Kupalar (${oyuncu.kupalar?.length??0})**\n${kup}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**🩹 Sakatlık**\n${sak}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
    if (showBtns) {
        c.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`st_Atak_${member.id}`).setLabel("⚔️ Atak").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`st_Savunma_${member.id}`).setLabel("🛡️ Savunma").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`st_Beceri_${member.id}`).setLabel("🌀 Beceri").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`st_Güç_${member.id}`).setLabel("💪 Güç").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`st_Hareket_${member.id}`).setLabel("⚡ Hareket").setStyle(ButtonStyle.Secondary)
        ));
        c.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`st_Mantalite_${member.id}`).setLabel("🧠 Mantalite").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`st_Kaleci_${member.id}`).setLabel("🧤 Kaleci").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`nt_${member.id}`).setLabel("🎖️ Nitelikler").setStyle(ButtonStyle.Primary)
        ));
    }
    return c;
}

function cvStatGrup(member, oyuncu, grup) {
    const liste=STAT_GRUPLARI[grup];
    if (!liste) return cvBilgi(`${E.hata} Grup bulunamadı.`);
    const isim=member.displayName||member.user.username;
    let sat=`**${grup} — Ort: ${grupOrt(oyuncu.statlar,grup)}**\n\n`;
    for (const s of liste) {
        const v=oyuncu.statlar[s]??50;
        sat+=`${E.nokta} ${s.padEnd(22)} ${statBar(v)} **${v}**\n`;
    }
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.futbolcu} **${isim} — ${grup.toUpperCase()}**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(sat.trim()))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kg_${member.id}`).setLabel("← Kariyere Dön").setStyle(ButtonStyle.Primary)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvStatlar(member, oyuncu) {
    const isim=member.displayName||member.user.username;
    let ic="";
    for (const [g,liste] of Object.entries(STAT_GRUPLARI)) {
        ic+=`**${E.cizgi} ${g} — Ort: ${grupOrt(oyuncu.statlar,g)}**\n`;
        for (const s of liste) { const v=oyuncu.statlar[s]??50; ic+=`${E.nokta} ${s.padEnd(22)} ${statBar(v)} **${v}**\n`; }
        ic+="\n";
    }
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.futbolcu} **${isim} — TÜM STATLAR (OVR: ${oyuncu.overall})**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(ic.trim()))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kg_${member.id}`).setLabel("← Kariyere Dön").setStyle(ButtonStyle.Primary)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvNiteliklerim(member, oyuncu) {
    const isim=member.displayName||member.user.username;
    const list=oyuncu.nitelikler||[];
    const sat=list.length
        ?list.slice(-20).reverse().map((n,i)=>`**${i+1}.** ${E.nitelik} **${n.stat}** +${n.deger}\n${E.cizgi} Grup: ${n.grup||"?"} ${E.nokta} ${nadirlikStr(n.nadirlik)}\n${E.cizgi} *${n.tarih||"-"}*`).join("\n\n")
        :`${E.nokta} *Henüz nitelik kazanılmadı. Drop bekle!*`;
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.nitelik} **${isim} — NİTELİKLER (${list.length} adet)**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(sat))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvAntrenman(member, oyuncu) {
    const isim=member.displayName||member.user.username;
    const haf=oyuncu.haftalik||{};
    const sat=Object.keys(haf).length?Object.entries(haf).map(([k,v])=>`${E.nokta} **${k}**: +${v}`).join("\n"):`${E.nokta} *Bu hafta antrenman yapılmadı.*`;
    const top=Object.values(haf).reduce((a,b)=>a+b,0);
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🏋️ **${isim} — HAFTALIK ANTRENMAN**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(sat))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.tik} Bu hafta: **${top}** antrenman ${E.cizgi} Kariyer toplamı: **${oyuncu.antrenman?.toplam??0}**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvTakim(member, oyuncu) {
    const isim=member.displayName||member.user.username;
    const tE={transfer:"🔄",kiralik:"📋",fesih:"❌",serbest:"🆓",normal:"⚽"};
    const gecmis=oyuncu.takimGecmisi||[];
    const gecStr=gecmis.length
        ?gecmis.slice().reverse().map((t,i)=>`**${i+1}.** ${tE[t.tip]||"⚽"} **${t.takim}**\n${E.cizgi} Giriş: ${t.giris}${t.cikis?` ${E.nokta} Çıkış: ${t.cikis}`:" *(aktif)*"} ${E.nokta} ${t.tip}${t.ucret&&t.ucret!=="0"?` ${E.nokta} ${t.ucret}`:""}`).join("\n\n")
        :`${E.nokta} *Takım geçmişi yok.*`;
    const piyasa={normal:"⚽ Normal",satilik:"💲 Satılık",kiralik:"🔄 Kiralık",serbest:"🆓 Serbest"}[oyuncu.piyasaDurumu||"normal"];
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.transfer} **${isim} — TAKIM GEÇMİŞİ**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `Mevcut: ${oyuncu.mevcutTakim?`${E.transfer} **${oyuncu.mevcutTakim}**`:`${E.nokta} *Takımsız*`}\nPiyasa: **${piyasa}**`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Geçmiş (${gecmis.length} kayıt)**\n${gecStr}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvPiyasa(oyuncular) {
    const fmt=arr=>arr.length?arr.map(o=>`${E.futbolcu} **${o._isim||o.id}** ${E.cizgi} **${o.overall}** OVR${o.mevki&&o.mevki!=="NO"?` *(${o.mevki})*`:""}${o.mevcutTakim?` ${E.nokta} ${o.mevcutTakim}`:""}`).join("\n"):`${E.nokta} *Kimse yok*`;
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.transfer} **PİYASA — OYUNCULAR**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`💲 **Satılık (${oyuncular.filter(o=>o.piyasaDurumu==="satilik").length})**\n${fmt(oyuncular.filter(o=>o.piyasaDurumu==="satilik"))}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🔄 **Kiralık (${oyuncular.filter(o=>o.piyasaDurumu==="kiralik").length})**\n${fmt(oyuncular.filter(o=>o.piyasaDurumu==="kiralik"))}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🆓 **Serbest (${oyuncular.filter(o=>o.piyasaDurumu==="serbest").length})**\n${fmt(oyuncular.filter(o=>o.piyasaDurumu==="serbest"))}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvPenaltiStat(member, oyuncu) {
    const isim=member.displayName||member.user.username;
    const p=oyuncu.penalti||{atis:0,gol:0,kurtaris:0};
    const oran=p.atis>0?Math.round((p.gol/p.atis)*100):0;
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚽ **${isim} — PENALTİ İSTATİSTİĞİ**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `${E.gol} Atış: **${p.atis}** ${E.cizgi} Gol: **${p.gol}** *(${oran}%)* ${E.cizgi} Kurtarılan: **${p.kurtaris}**\n\n${statBar(oran)} **Başarı: ${oran}%**`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvKarsilastir(m1, o1, m2, o2) {
    const i1=m1.displayName||m1.user.username, i2=m2.displayName||m2.user.username;
    let sat="",k1=0,k2=0;
    for (const g of Object.keys(STAT_GRUPLARI)) {
        const v1=grupOrt(o1.statlar,g),v2=grupOrt(o2.statlar,g);
        const kaz=v1>v2?(k1++,`**${i1}** ${E.tik}`):v2>v1?(k2++,`**${i2}** ${E.tik}`):"*Eşit*";
        sat+=`${E.nokta} **${g}**: \`${v1}\` ${E.vs} \`${v2}\` — ${kaz}\n`;
    }
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.vs} **KARŞILAŞTIRMA — ${i1} vs ${i2}**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(sat))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `OVR: **${o1.overall}** ${E.vs} **${o2.overall}** ${E.cizgi} Skor: **${k1}/${k2}**\n` +
            (o1.overall!==o2.overall?`${E.win} Genel Üstün: **${o1.overall>o2.overall?i1:i2}**`:`${E.vs} *Genel Eşit*`)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvKapOnay(kapId, tip, oyAdi, takimAdi, ucret, sure, talepci, rolBulundu=null) {
    const tE={transfer:"🔄",kiralik:"📋",serbest:"🆓",satilik:"💲",fesih:"❌"};
    const em=tE[tip]||"📝";
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em} **KAP FORMU — ONAY BEKLİYOR**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**Tip:** ${em} ${tip.charAt(0).toUpperCase()+tip.slice(1)}\n` +
            `${E.cizgi} **Oyuncu:** ${oyAdi}\n` +
            `${E.cizgi} **Takım:** ${takimAdi||"*Belirtilmedi*"}\n` +
            `${E.cizgi} **Ücret:** ${ucret&&ucret!=="0"?ucret:"*Belirtilmedi*"}\n` +
            `${E.cizgi} **Süre:** ${sure||"*Belirtilmedi*"}\n` +
            `${E.cizgi} **Talep Eden:** <@${talepci}>\n` +
            `${E.cizgi} **Tarih:** ${saatStr()}\n` +
            `${E.cizgi} **Rol:** ${rolBulundu?`${E.tik} **${rolBulundu.name}** (<@&${rolBulundu.id}>)`:`${E.uyari} Bulunamadı`}`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ko_evet_${kapId}`).setLabel("✅ Onayla").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ko_hayir_${kapId}`).setLabel("❌ Reddet").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`ko_duzenle_${kapId}`).setLabel("✏️ Düzenle").setStyle(ButtonStyle.Secondary)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvCekilis(data) {
    const bitis=data.bitisZamani?new Date(data.bitisZamani).toLocaleString("tr-TR"):"Süresiz";
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎰 **ÇEKİLİŞ — DEVAM EDİYOR**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `🎁 **Ödül:** ${data.odul}\n👥 **Katılımcı:** ${data.katilimcilar.length} kişi\n⏰ **Bitiş:** ${bitis}`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("cekilis_katil").setLabel(`🎰 Katıl! (${data.katilimcilar.length} kişi)`).setStyle(ButtonStyle.Success)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvTicketPanel(sebebler) {
    const menu=new StringSelectMenuBuilder().setCustomId("ticket_olustur").setPlaceholder("🎫 Ticket sebebini seç...")
        .addOptions(sebebler.map((s,i)=>
            new StringSelectMenuOptionBuilder().setLabel(s).setValue(`ts_${i}`).setDescription(`${s} hakkında destek talebi aç`)
        ));
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `🎫 **DESTEK TİCKET SİSTEMİ**\n\n${E.cizgi} Aşağıdan ticket sebebini seçin.\n${E.nokta} Özel bir destek kanalı açılacak.\n${E.nokta} Yetkililer bildirim alacak ve yardım edecek.\n${E.nokta} Kişi başı 1 açık ticket olabilir.`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvTicketAcik(userId, sebep, ticketNo) {
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎫 **TİCKET #${ticketNo} — ${sebep}**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `${E.cizgi} Açan: <@${userId}>\n${E.cizgi} Açılış: ${saatStr()}\n${E.cizgi} Konu: **${sebep}**\n${E.nokta} *Lütfen sorununuzu detaylı açıklayın.*`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tk_kapat_${ticketNo}`).setLabel("🔒 Kapat").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`tk_not_${ticketNo}`).setLabel("📝 Not").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`tk_devret_${ticketNo}`).setLabel("↗️ Devret").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`tk_puan_${ticketNo}`).setLabel("⭐ Puan").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`tk_sil_${ticketNo}`).setLabel("🗑️ Sil").setStyle(ButtonStyle.Danger)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvItirafPanel() {
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `💬 **ANONİM İTİRAF PANELİ**\n\n${E.cizgi} İtirafın belirlenen kanala anonim gider.\n${E.nokta} Kim gönderdiğin gizli kalır.\n${E.nokta} İtiraf logda kategori olarak görünür (isim değil).`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("itiraf_gonder").setLabel("💬 İtiraf Gönder").setStyle(ButtonStyle.Primary)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

function cvDCPanel() {
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `🎭 **DOĞRULUK MU CESARET Mİ?**\n\n${E.cizgi} Bir seçim yap, soru sadece sana görünür.`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("dc_dogruluk").setLabel("💎 Doğruluk").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("dc_cesaret").setLabel("🎭 Cesaret").setStyle(ButtonStyle.Danger)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

async function cvLeaderboard(guild, tip="ovr") {
    const keys=await db.list("oyuncu_");
    const liste=[];
    for (const key of keys.slice(0,100)) {
        const d=await db.get(key); if(!d) continue;
        const uid=key.replace("oyuncu_","");
        let deger=50;
        if (tip==="ovr") deger=d.overall||50;
        else if (tip==="gol") deger=d.sezon?.gol||0;
        else if (tip==="asist") deger=d.sezon?.asist||0;
        else if (tip==="antrenman") deger=d.antrenman?.toplam||0;
        else { const s=statBul(tip); if(s) deger=d.statlar?.[s]||50; }
        let isim=uid;
        try { const m=await guild.members.fetch(uid).catch(()=>null); if(m) isim=m.displayName||m.user.username; } catch {}
        liste.push({id:uid,isim,deger});
    }
    liste.sort((a,b)=>b.deger-a.deger);
    const md=["🥇","🥈","🥉"];
    const tipAd={ovr:"Overall",gol:"Gol",asist:"Asist",antrenman:"Antrenman"}[tip]||tip;
    const sat=liste.slice(0,10).map((p,i)=>`${md[i]||`**${i+1}.**`} **${p.isim}** — **${p.deger}** ${tip==="ovr"?"OVR":tip==="gol"?"⚽":tip==="asist"?"🎯":tip==="antrenman"?"🏋️":""}`).join("\n")||`${E.nokta} *Veri yok.*`;
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.tac} **LEADERBOARD — ${tipAd.toUpperCase()}**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(sat))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("lb_ovr").setLabel("OVR").setStyle(tip==="ovr"?ButtonStyle.Primary:ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("lb_gol").setLabel("⚽ Gol").setStyle(tip==="gol"?ButtonStyle.Primary:ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("lb_asist").setLabel("🎯 Asist").setStyle(tip==="asist"?ButtonStyle.Primary:ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("lb_antrenman").setLabel("🏋️ Antrenman").setStyle(tip==="antrenman"?ButtonStyle.Primary:ButtonStyle.Secondary)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

// ── Setup Paneli ──────────────────────────────────────────
function cvSetupPaneli(cfg) {
    const ch=id=>id?`<#${id}>`:"❌ *Ayarlanmadı*";
    const rl=arr=>arr.length?arr.map(r=>`<@&${r}>`).join(" "):"❌ *Ayarlanmadı*";
    const yn=v=>v?`${E.tik} Açık`:"❌ Kapalı";
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚙️ **Azura League BOT — KURULUM PANELİ**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `📢 **Kanallar**\n` +
            `${E.cizgi} Antrenman: ${ch(cfg.kanalAntrenman)}\n` +
            `${E.cizgi} Penaltı: ${ch(cfg.kanalPenalti)}\n` +
            `${E.cizgi} Log: ${ch(cfg.kanalLog)}\n` +
            `${E.cizgi} Ticket: ${ch(cfg.kanalTicket)}\n` +
            `${E.cizgi} Kap Onay: ${ch(cfg.kanalKap)}\n` +
            `${E.cizgi} Sezon: ${ch(cfg.kanalSezon)}\n` +
            `${E.cizgi} Guard: ${ch(cfg.kanalGuard)}\n` +
            `${E.cizgi} Nitelik Drop: ${ch(cfg.kanalNitelikDrop)}\n` +
            `${E.cizgi} İtiraf: ${ch(cfg.kanalItiraf)}\n` +
            `${E.cizgi} Instagram: ${ch(cfg.kanalIg)}\n` +
            `${E.cizgi} Twitter: ${ch(cfg.kanalTw)}\n` +
            `${E.cizgi} Leaderboard: ${ch(cfg.kanalLeaderboard)}`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `🎭 **Roller**\n${E.cizgi} Admin: ${rl(cfg.adminRoller)}\n${E.cizgi} Mod: ${rl(cfg.modRoller)}\n\n` +
            `${E.kalkan} **Koruma**\n${E.cizgi} Spam: ${yn(cfg.spamKoruma)} (${cfg.spamLimit}msg/${cfg.spamSure/1000}sn)\n${E.cizgi} Guard: ${yn(cfg.guardAktif)}\n${E.cizgi} Yasaklı Kelime: **${cfg.yasakliKelimeler.length}** kayıt\n\n` +
            `${E.nitelik} **Nitelik Drop**\n${E.cizgi} Durum: ${yn(cfg.nitelikDropAktif)}\n${E.cizgi} Süre: **${(cfg.nitelikDropSure||3600000)/60000}** dk`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `📋 **Komutlar**\n` +
            `\`.setup kanal [antrenman/penalti/log/ticket/kap/sezon/guard/nitelikdrop/itiraf/ig/tw/leaderboard] #kanal\`\n` +
            `\`.setup rol [admin/mod] @rol\`\n` +
            `\`.setup guard [ac/kapat]\`\n` +
            `\`.setup nitelikdrop [ac/kapat] [dakika]\`\n` +
            `\`.setup spam [ac/kapat/limit] [mesaj] [saniye]\`\n` +
            `\`.setup sezon [ad]\` — Sezon adını belirle\n` +
            `\`.setup sifirla\` — Tüm ayarları sıfırla`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

// ── Stat Listesi ──────────────────────────────────────────
function cvStatListesi() {
    let ic="";
    for (const [g,liste] of Object.entries(STAT_GRUPLARI)) {
        ic+=`**${E.cizgi} ${g}**\n${liste.map(s=>`${E.nokta} ${s}`).join("\n")}\n\n`;
    }
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `📋 **ANTRENMAN STAT LİSTESİ**\n\n${E.nokta} \`+1 [stat adı]\` yazarak antrenman kanalında kaydet.\n${E.nokta} Büyük/küçük harf fark etmez!\n`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(ic.trim()))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
}

// ============================================================
//  MESAJ OLAYLARI
// ============================================================
client.on(Events.MessageDelete, msg=>{
    if (!msg.author||msg.author.bot) return;
    const e={author:msg.author.tag,content:msg.content||"*[Ekli içerik]*",time:Date.now()};
    snipeCache.set(msg.channel.id,e);
    const l=snipeAllCache.get(msg.channel.id)||[];
    l.unshift(e); if(l.length>10)l.pop();
    snipeAllCache.set(msg.channel.id,l);
});
client.on(Events.GuildMemberAdd, async m=>await log(m.guild,"GİRİŞ",`📥 **${m.user.tag}** katıldı. (${m.guild.memberCount} üye)`));
client.on(Events.GuildMemberRemove, async m=>await log(m.guild,"ÇIKIŞ",`📤 **${m.user.tag}** ayrıldı.`));
client.on(Events.GuildBanAdd, async ban=>{
    const y=await auditYapan(ban.guild,AuditLogEvent.MemberBanAdd,ban.user.id);
    if(y) await guardKontrol(ban.guild,y.id,"banlar");
    await log(ban.guild,"BAN",`🔨 **${ban.user.tag}** banlandı.`);
});
client.on(Events.GuildBanRemove, async ban=>await log(ban.guild,"UNBAN",`${E.tik} **${ban.user.tag}** unban.`));
client.on(Events.ChannelDelete, async k=>{
    const y=await auditYapan(k.guild,AuditLogEvent.ChannelDelete);
    if(y)await guardKontrol(k.guild,y.id,"kanalSilme");
    await log(k.guild,"KANAL",`🗑️ **${k.name}** silindi.`);
});
client.on(Events.GuildRoleDelete, async r=>{
    const y=await auditYapan(r.guild,AuditLogEvent.RoleDelete);
    if(y)await guardKontrol(r.guild,y.id,"rolSilme");
    await log(r.guild,"ROL",`🗑️ **${r.name}** silindi.`);
});
client.on(Events.VoiceStateUpdate, async(eski,yeni)=>{
    if(!eski.guild)return;
    const k=yeni.member?.user?.tag||"?";
    if(!eski.channelId&&yeni.channelId)await log(eski.guild,"SES",`🔊 **${k}** girdi: **${yeni.channel?.name}**`);
    else if(eski.channelId&&!yeni.channelId)await log(eski.guild,"SES",`🔇 **${k}** çıktı: **${eski.channel?.name}**`);
});
client.on(Events.WebhooksUpdate, async k=>await log(k.guild,"GUARD",`🔗 Webhook değişikliği: <#${k.id}>`));

// ============================================================
//  MESAJ KOMUTLARI
// ============================================================
client.on(Events.MessageCreate, async(message)=>{
    if(message.author.bot||!message.guild)return;
    let cfg;
    try{ cfg=await getConfig(message.guild.id); }catch(e){ console.error("[Config]",e); return; }

    // ── Yasaklı kelime ─────────────────────────────────────
    if(cfg.yasakliKelimeler.length&&!(await isMod(message.member))){
        const ic=message.content.toLowerCase();
        const b=cfg.yasakliKelimeler.find(k=>ic.includes(k.toLowerCase()));
        if(b){
            await message.delete().catch(()=>{});
            const m=await message.channel.send(`${E.uyari} **${message.author.username}**, yasaklı kelime!`);
            setTimeout(()=>m.delete().catch(()=>{}),5000);
            return;
        }
    }

    // ── Spam koruması ──────────────────────────────────────
    if(cfg.spamKoruma&&!(await isMod(message.member))){
        const now=Date.now();
        const sv=spamKontrol.get(message.author.id)||{count:0,lastTime:0};
        sv.count=now-sv.lastTime<cfg.spamSure?sv.count+1:1; sv.lastTime=now;
        spamKontrol.set(message.author.id,sv);
        if(sv.count>=cfg.spamLimit){
            spamKontrol.set(message.author.id,{count:0,lastTime:0});
            const m=await message.channel.send(`${E.uyari} **${message.author.username}**, yavaş mesaj gönder!`);
            setTimeout(()=>m.delete().catch(()=>{}),5000);
        }
    }

    // ── AFK ────────────────────────────────────────────────
    if(message.mentions.users.size>0){
        for(const[uid,a]of afkMap){
            if(message.mentions.users.has(uid)&&uid!==message.author.id)
                await message.reply(`${E.sari} **${a.tag}** AFK — *${a.reason}* (${Math.floor((Date.now()-a.time)/60000)}dk önce)`);
        }
    }
    if(afkMap.has(message.author.id)&&!message.content.startsWith(PREFIX+"afk")){
        afkMap.delete(message.author.id);
        const m=await message.reply(`${E.tik} AFK modu kaldırıldı! 👋`);
        setTimeout(()=>m.delete().catch(()=>{}),5000);
    }

    // ── Sayı oyunu ─────────────────────────────────────────
    if(sayiOyunlari.has(message.channel.id)){
        const o=sayiOyunlari.get(message.channel.id);
        const t=parseInt(message.content.trim());
        if(!isNaN(t)){
            if(t===o.sayi){ sayiOyunlari.delete(message.channel.id); return message.reply(`🎉 **Doğru! Sayı ${o.sayi} idi!** ${message.author.username} kazandı! (${o.denemeler} deneme)`); }
            o.denemeler++;
            if(o.denemeler>=o.maks){ sayiOyunlari.delete(message.channel.id); return message.reply(`❌ Hakkın bitti! Sayı **${o.sayi}** idi.`); }
            return message.reply(`${t<o.sayi?"⬆️ Daha büyük!":"⬇️ Daha küçük!"} (${o.maks-o.denemeler} hak kaldı)`);
        }
    }

    // ── Bilmece cevabı ─────────────────────────────────────
    if(bilmeceOyunlari.has(message.channel.id)){
        const o=bilmeceOyunlari.get(message.channel.id);
        if(normalizeStr(message.content.trim())===normalizeStr(o.cevap)){
            bilmeceOyunlari.delete(message.channel.id);
            return message.reply(`🎉 **Doğru! Tebrikler ${message.author.username}!** Cevap: **${o.cevap}**`);
        }
    }

    // ── Genel soru cevabı ──────────────────────────────────
    if(soruOyunlari.has(message.channel.id)){
        const o=soruOyunlari.get(message.channel.id);
        if(normalizeStr(message.content.trim())===normalizeStr(o.cevap)){
            soruOyunlari.delete(message.channel.id);
            return message.reply(`🎉 **Doğru! Tebrikler ${message.author.username}!** Cevap: **${o.cevap}**`);
        }
    }

    // ── +1 Antrenman ───────────────────────────────────────
    if(message.content.startsWith("+1 ")){
        if(!cfg.kanalAntrenman||message.channel.id!==cfg.kanalAntrenman) return;
        const raw=message.content.slice(3).trim();
        const eslesme=statBul(raw);
        if(!eslesme) return message.react("❌").catch(()=>{});
        const o=await getOyuncu(message.author.id);
        o.haftalik[eslesme]=(o.haftalik[eslesme]||0)+1;
        o.antrenman.buHafta=(o.antrenman.buHafta||0)+1;
        o.antrenman.toplam=(o.antrenman.toplam||0)+1;
        await saveOyuncu(message.author.id,o);
        await message.react("✅").catch(()=>{});
        await log(message.guild,"ANTRENMAN",`**${message.author.tag}** → **${eslesme}** (+1) [Bu hafta: ${o.antrenman.buHafta}]`);
        return;
    }

    if(!message.content.startsWith(PREFIX)) return;
    const args=message.content.slice(PREFIX.length).trim().split(/ +/);
    const command=args.shift().toLowerCase();

    // ── Setup ─────────────────────────────────────────────
    if(command==="setup"){
        if(!await isAdmin(message.member))return message.reply(`${E.hata} Admin yetkisi gerekiyor.`);
        const alt=args[0]?.toLowerCase();
        if(!alt)return cvReply(message,cvSetupPaneli(cfg));

        if(alt==="kanal"){
            const tip=args[1]?.toLowerCase();
            const kanal=message.mentions.channels.first();
            const gecerli=["antrenman","penalti","log","ticket","kap","sezon","guard","nitelikdrop","itiraf","ig","tw","leaderboard"];
            if(!kanal||!gecerli.includes(tip))return message.reply(`Kullanım: \`.setup kanal [${gecerli.join("/")}] #kanal\``);
            const map={antrenman:"kanalAntrenman",penalti:"kanalPenalti",log:"kanalLog",ticket:"kanalTicket",kap:"kanalKap",sezon:"kanalSezon",guard:"kanalGuard",nitelikdrop:"kanalNitelikDrop",itiraf:"kanalItiraf",ig:"kanalIg",tw:"kanalTw",leaderboard:"kanalLeaderboard"};
            cfg[map[tip]]=kanal.id; await saveConfig(message.guild.id,cfg);
            return message.reply(`${E.tik} **${tip}** kanalı → <#${kanal.id}>`);
        }
        if(alt==="rol"){
            const tip=args[1]?.toLowerCase(); const rol=message.mentions.roles.first();
            if(!rol||!["admin","mod"].includes(tip))return message.reply("Kullanım: `.setup rol [admin/mod] @rol`");
            const liste=tip==="admin"?cfg.adminRoller:cfg.modRoller;
            const idx=liste.indexOf(rol.id);
            if(idx>-1){liste.splice(idx,1);await saveConfig(message.guild.id,cfg);return message.reply(`${E.tik} <@&${rol.id}> **${tip}** listesinden kaldırıldı.`);}
            liste.push(rol.id);await saveConfig(message.guild.id,cfg);
            return message.reply(`${E.tik} <@&${rol.id}> **${tip}** listesine eklendi.`);
        }
        if(alt==="spam"){
            const s=args[1]?.toLowerCase();
            if(s==="ac"){cfg.spamKoruma=true;await saveConfig(message.guild.id,cfg);return message.reply(`${E.tik} Spam koruması açıldı.`);}
            if(s==="kapat"){cfg.spamKoruma=false;await saveConfig(message.guild.id,cfg);return message.reply(`${E.tik} Spam koruması kapatıldı.`);}
            if(s==="limit"){
                const ms=parseInt(args[2]),sn=parseInt(args[3]);
                if(isNaN(ms)||isNaN(sn))return message.reply("Kullanım: `.setup spam limit [mesaj] [saniye]`");
                cfg.spamLimit=ms;cfg.spamSure=sn*1000;await saveConfig(message.guild.id,cfg);
                return message.reply(`${E.tik} Limit: **${ms}** mesaj /**${sn}** saniye`);
            }
        }
        if(alt==="guard"){
            cfg.guardAktif=args[1]?.toLowerCase()!=="kapat"; await saveConfig(message.guild.id,cfg);
            return message.reply(`${E.tik} Guard **${cfg.guardAktif?"açıldı ✅":"kapatıldı ❌"}**.`);
        }
        if(alt==="nitelikdrop"){
            const s=args[1]?.toLowerCase(); const dk=parseInt(args[2]);
            if(s==="ac"){
                cfg.nitelikDropAktif=true; if(!isNaN(dk)&&dk>0)cfg.nitelikDropSure=dk*60000;
                await saveConfig(message.guild.id,cfg); dropDurdur(message.guild.id); dropBaslat(message.guild);
                return message.reply(`${E.tik} Nitelik drop açıldı — Her **${(cfg.nitelikDropSure)/60000}** dakika.`);
            }
            if(s==="kapat"){cfg.nitelikDropAktif=false;await saveConfig(message.guild.id,cfg);dropDurdur(message.guild.id);return message.reply(`${E.tik} Nitelik drop durduruldu.`);}
            if(!isNaN(dk)&&dk>0){
                cfg.nitelikDropSure=dk*60000;await saveConfig(message.guild.id,cfg);
                if(cfg.nitelikDropAktif){dropDurdur(message.guild.id);dropBaslat(message.guild);}
                return message.reply(`${E.tik} Drop süresi: **${dk}** dakika.`);
            }
            return message.reply("Kullanım: `.setup nitelikdrop [ac/kapat] [dakika]`");
        }
        if(alt==="yasakli"){
            const i=args[1]?.toLowerCase();
            if(i==="liste")return message.reply(cfg.yasakliKelimeler.length?cfg.yasakliKelimeler.map((k,n)=>`**${n+1}.** \`${k}\``).join("\n"):"*Boş*");
            const kel=args.slice(2).join(" ").toLowerCase();
            if(!kel)return message.reply("Kullanım: `.setup yasakli [ekle/sil/liste] [kelime]`");
            if(i==="ekle"){if(cfg.yasakliKelimeler.includes(kel))return message.reply(`${E.hata} Zaten listede.`);cfg.yasakliKelimeler.push(kel);}
            else if(i==="sil"){const x=cfg.yasakliKelimeler.indexOf(kel);if(x===-1)return message.reply(`${E.hata} Listede yok.`);cfg.yasakliKelimeler.splice(x,1);}
            await saveConfig(message.guild.id,cfg);
            return message.reply(`${E.tik} Yasaklı liste güncellendi. (${cfg.yasakliKelimeler.length} kayıt)`);
        }
        if(alt==="ticket"&&args[1]?.toLowerCase()==="sebep"){
            const i=args[2]?.toLowerCase();
            if(i==="liste")return message.reply((cfg.ticketSebebleri||[]).map((s,n)=>`**${n+1}.** ${s}`).join("\n")||"*Boş*");
            const sebep=args.slice(3).join(" ");
            if(!sebep)return message.reply("Kullanım: `.setup ticket sebep [ekle/sil] [sebep]`");
            if(i==="ekle")cfg.ticketSebebleri.push(sebep);
            else if(i==="sil"){const x=cfg.ticketSebebleri.indexOf(sebep);if(x===-1)return message.reply(`${E.hata} Listede yok.`);cfg.ticketSebebleri.splice(x,1);}
            await saveConfig(message.guild.id,cfg);return message.reply(`${E.tik} Ticket sebepleri güncellendi.`);
        }
        if(alt==="sezon"){
            const ad=args.slice(1).join(" ");if(!ad)return message.reply("Kullanım: `.setup sezon [ad]`");
            cfg.sezonAdi=ad;await saveConfig(message.guild.id,cfg);return message.reply(`${E.tik} Sezon: **${ad}**`);
        }
        if(alt==="sifirla"){await db.delete(`config_${message.guild.id}`);dropDurdur(message.guild.id);return message.reply(`${E.tik} Ayarlar sıfırlandı.`);}
        return cvReply(message,cvSetupPaneli(cfg));
    }

    // ── Guard ─────────────────────────────────────────────
    if(command==="guard"){
        if(!await isAdmin(message.member))return message.reply(`${E.hata} Admin yetkisi.`);
        return cvReply(message,cvBilgi(
            `${E.kalkan} **GUARD DURUMU**\n\n${E.cizgi} Durum: **${cfg.guardAktif?`${E.tik} Aktif`:"❌ Kapalı"}**\n` +
            `${E.cizgi} Kanal: ${cfg.kanalGuard?`<#${cfg.kanalGuard}>`:"*Ayarlanmadı*"}\n\n` +
            `**Limitler (${GUARD.zaman/1000}sn pencere):**\n${E.nokta} Ban: **${GUARD.banlar}** ${E.nokta} Kick: **${GUARD.kickler}** ${E.nokta} Kanal Silme: **${GUARD.kanalSilme}** ${E.nokta} Rol Silme: **${GUARD.rolSilme}**`
        ));
    }

    // ── Bas (Duyuru) ──────────────────────────────────────
    if(command==="bas"){
        if(!await isAdmin(message.member))return message.reply(`${E.hata} Admin yetkisi.`);
        const metin=args.join(" ");if(!metin)return message.reply("Kullanım: `.bas [mesaj]`");
        await message.delete().catch(()=>{});
        await message.channel.send(`📢 **DUYURU**\n\n${metin}\n\n${E.cizgi} *${message.author.username} tarafından*`);
    }

    // ── Yardım ────────────────────────────────────────────
    if(command==="yardim"||command==="help")return cvReply(message,cvYardimMenu());

    // ── Stat Listesi ──────────────────────────────────────
    if(command==="statlistesi"||command==="statlar2")return cvReply(message,cvStatListesi());

    // ── Kariyer & Stat ─────────────────────────────────────
    if(command==="kariyer"){ const t=message.mentions.members.first()||message.member; return cvReply(message,cvKariyer(t,await getOyuncu(t.id))); }
    if(command==="s"){
        const t=message.mentions.members.first()||message.member;
        const o=await getOyuncu(t.id);
        const isim=t.displayName||t.user.username;
        const haf=o.haftalik||{};
        const hLines=Object.keys(haf).length?Object.entries(haf).map(([k,v])=>`${E.nokta} ${k}: **+${v}**`).join("\n"):`${E.nokta} *Bu hafta antrenman yok.*`;
        return cvReply(message,new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.futbolcu} **${isim} — HIZLI ÖZET**`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(hLines))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `${E.urun} OVR: **${o.overall}** ${E.cizgi} ${E.gol} Gol: **${o.sezon?.gol??0}** ${E.cizgi} ${E.asist} Asist: **${o.sezon?.asist??0}** ${E.cizgi} Maç: **${o.sezon?.mac??0}**\n` +
                `${E.transfer} Takım: **${o.mevcutTakim||"Takımsız"}** ${E.nokta} ${E.nitelik} Nitelik: **${o.nitelikler?.length||0}**`
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ah_${t.id}`).setLabel("📅 Antrenman").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`gs_${t.id}`).setLabel("📊 Tüm Statlar").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`kg_${t.id}`).setLabel("⚽ Kariyer").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tm_${t.id}`).setLabel("🔄 Takım").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`nt_${t.id}`).setLabel("🎖️ Nitelikler").setStyle(ButtonStyle.Secondary)
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()))
        );
    }
    if(command==="statlar"){ const t=message.mentions.members.first()||message.member; return cvReply(message,cvStatlar(t,await getOyuncu(t.id))); }
    if(command==="antrenman"){ const t=message.mentions.members.first()||message.member; return cvReply(message,cvAntrenman(t,await getOyuncu(t.id))); }
    if(command==="penaltistat"){ const t=message.mentions.members.first()||message.member; return cvReply(message,cvPenaltiStat(t,await getOyuncu(t.id))); }
    if(command==="takim"){ const t=message.mentions.members.first()||message.member; return cvReply(message,cvTakim(t,await getOyuncu(t.id))); }
    if(command==="karsilastir"){
        const men=[...message.mentions.members.values()];
        if(men.length<2)return message.reply("Kullanım: `.karsilastir @A @B`");
        return cvReply(message,cvKarsilastir(men[0],await getOyuncu(men[0].id),men[1],await getOyuncu(men[1].id)));
    }
    if(command==="top10"){
        const keys=await db.list("oyuncu_"); const liste=[];
        for(const key of keys.slice(0,100)){
            const d=await db.get(key);if(!d)continue;
            const uid=key.replace("oyuncu_","");
            let isim=uid;
            try{const m=await message.guild.members.fetch(uid).catch(()=>null);if(m)isim=m.displayName||m.user.username;}catch{}
            liste.push({isim,overall:d.overall||50,mevki:d.mevki,takim:d.mevcutTakim});
        }
        liste.sort((a,b)=>b.overall-a.overall);
        const md=["🥇","🥈","🥉"];
        const sat=liste.slice(0,10).map((p,i)=>`${md[i]||`**${i+1}.**`} **${p.isim}** ${E.cizgi} OVR **${p.overall}**${p.mevki&&p.mevki!=="NO"?` *(${p.mevki})*`:""}${p.takim?` ${E.nokta} ${p.takim}`:""}`);
        return cvReply(message,new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.tac} **TOP 10 — EN İYİ OYUNCULAR**`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(sat.join("\n")||`${E.nokta} *Veri yok.*`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer())));
    }
    if(command==="lb"||command==="leaderboard"){
        const tip=args[0]?.toLowerCase()||"ovr";
        return cvReply(message,await cvLeaderboard(message.guild,tip));
    }
    if(command==="profil"){
        if(args[0]?.toLowerCase()!=="guncelle")return message.reply("Kullanım: `.profil guncelle [ulke/mevki/discord/ig/tw] [deger]`");
        const alan=args[1]?.toLowerCase();const deger=args.slice(2).join(" ");
        if(!alan||!deger||!["ulke","mevki","discord","ig","tw"].includes(alan))return message.reply(`${E.hata} Geçerli alanlar: ulke/mevki/discord/ig/tw`);
        const o=await getOyuncu(message.author.id);o[alan]=deger;await saveOyuncu(message.author.id,o);
        return message.reply(`${E.tik} **${alan}** → **${deger}**`);
    }
    if(command==="niteliklerim"){ const t=message.mentions.members.first()||message.member; return cvReply(message,cvNiteliklerim(t,await getOyuncu(t.id))); }

    // ── Nitelik Ver / Sil (Mod+) ──────────────────────────
    if(command==="nitelikver"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi gerekiyor.`);
        const target=message.mentions.members.first();
        const statAdi=args[1]; const miktar=parseInt(args[2])||5;
        if(!target||!statAdi)return message.reply("Kullanım: `.nitelikver @kullanici [stat] [miktar]`\nStat listesi için: `.statlistesi`");
        const eslesme=statBul(statAdi);
        if(!eslesme)return message.reply(`${E.hata} **"${statAdi}"** bulunamadı!\nStat listesi için \`.statlistesi\` yaz.`);
        if(miktar<1||miktar>99)return message.reply(`${E.hata} Miktar 1-99 arasında olmalı.`);
        const o=await getOyuncu(target.id);
        o.nitelikler=o.nitelikler||[];
        const grup=statGrubu(eslesme);
        const n={stat:eslesme,grup,deger:miktar,nadirlik:"nadir",tarih:tarihStr()};
        o.nitelikler.push(n);
        const eski=o.statlar[eslesme]??50;
        o.statlar[eslesme]=Math.min(99,eski+miktar);
        await saveOyuncu(target.id,o);
        const isim=target.displayName||target.user.username;
        await log(message.guild,"DROP",`**${message.author.tag}** → **${isim}** nitelik verdi: **${eslesme}** +${miktar}`);
        return message.reply(`${E.tik} ${E.nitelik} **${isim}** — **${eslesme}**: **${eski}** → **${o.statlar[eslesme]}** (+${miktar})`);
    }
    if(command==="niteliksil"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi gerekiyor.`);
        const target=message.mentions.members.first();const idx=parseInt(args[1])-1;
        if(!target)return message.reply("Kullanım: `.niteliksil @kullanici [sıra no]`\nSıra no için \`.niteliklerim @kullanici\` yaz.");
        const o=await getOyuncu(target.id);o.nitelikler=o.nitelikler||[];
        if(!o.nitelikler.length)return message.reply(`${E.hata} Bu oyuncunun niteliği yok.`);
        if(isNaN(idx)||idx<0||idx>=o.nitelikler.length)return message.reply(`${E.hata} Geçersiz numara. 1-${o.nitelikler.length} arasında gir.`);
        const silinen=o.nitelikler.splice(idx,1)[0];
        await saveOyuncu(target.id,o);
        const isim=target.displayName||target.user.username;
        return message.reply(`${E.tik} **${isim}** nitelik silindi: **${silinen.stat}** +${silinen.deger}`);
    }

    // ── Penaltı (pen/vur/penalti) ─────────────────────────
    if(["penalti","pen","vur"].includes(command)){
        if(cfg.kanalPenalti&&message.channel.id!==cfg.kanalPenalti)
            return message.reply(`${E.hata} Yalnızca <#${cfg.kanalPenalti}> kanalında kullanılabilir!\nO kanalda \`.pen\` yaz.`);
        const son=cooldowns.get(`pen_${message.author.id}`)||0;
        if(Date.now()-son<15*60*1000)return message.reply(`${E.sari} **${Math.ceil((15*60*1000-(Date.now()-son))/60000)}** dakika bekle. ⏱️`);
        cooldowns.set(`pen_${message.author.id}`,Date.now());
        const o=await getOyuncu(message.author.id);
        o.penalti=o.penalti||{atis:0,gol:0,kurtaris:0};
        o.sezon=o.sezon||{gol:0,asist:0,mac:0};
        o.kariyer=o.kariyer||{gol:0,asist:0,mac:0};
        o.penalti.atis++;
        const isGol=Math.random()<((o.statlar["Penaltı"]??50)/99*0.6+0.3);
        if(isGol){o.penalti.gol++;o.sezon.gol++;o.kariyer.gol++;}
        else o.penalti.kurtaris++;
        await saveOyuncu(message.author.id,o);
        const oran=Math.round((o.penalti.gol/o.penalti.atis)*100);
        return cvReply(message,new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(isGol?`${E.gol} **PENALTİ — GOL! ⚽**`:`${E.kurtaris} **PENALTİ — KURTARILDI! 🧤**`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                isGol?rastgele(["GOOOL! Köşeye yerleştirdi! 🎉","Harika vuruş! 🏟️","Kaleci yanlış tarafa gitti! 😮"])
                     :rastgele(["Kurtarıldı! Kaleci doğru köşeyi seçti! 🧤","Direkten döndü! 😱","Çıtanın üstünden! 😬"])
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `${E.nokta} Penaltı Stat: **${o.statlar["Penaltı"]??50}** ${E.cizgi} Başarı: **${oran}%** (${o.penalti.gol}/${o.penalti.atis})\n${E.nokta} *15 dakika sonra tekrar atabilirsin.*`
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer())));
    }

    // ── Eğlence ───────────────────────────────────────────
    if(command==="zar")return cvReply(message,cvBilgi(`🎲 **ZAR**\n\n**${message.author.displayName||message.author.username}** attı: **${Math.floor(Math.random()*6)+1}**`));
    if(command==="yaztura")return cvReply(message,cvBilgi(`🪙 **YAZI TURA**\n\n${Math.random()<0.5?"🪙 **YAZI**":"🔵 **TURA**"}`));
    if(command==="top8"){
        const cevaplar=["Kesinlikle! ✅","Evet! ✅","Çok olası ✅","Belki... 🤔","Emin değilim 🤔","Hayır ❌","Kesinlikle hayır! ❌","Cevap bulanık, tekrar sor 🌀"];
        return cvReply(message,cvBilgi(`🎱 **SİHİRLİ TOP**\n\n*${args.join(" ")||"Soru?"}*\n\n**${rastgele(cevaplar)}**`));
    }
    if(command==="kelimeoyunu"){
        const kels=["dribbling","ofsayt","penalti","korner","tac","frikik","kaleci","forvet","defans","transfer","asist","gol","uzatma","hucum","taktik","otobus","kaptanlik"];
        const sec=rastgele(kels);
        const karisik=sec.split("").sort(()=>Math.random()-0.5).join("");
        return cvReply(message,new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🔤 **KELİME OYUNU**`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Karışık: **\`${karisik}\`**\n${E.nokta} ${sec.length} harfli futbol kelimesi!\n${E.nokta} *Cevabı biliyor musun?*`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`kelime_${Buffer.from(sec).toString("base64")}`).setLabel("💡 Cevabı Göster").setStyle(ButtonStyle.Secondary)
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer())));
    }
    if(command==="bilmece"){
        if(bilmeceOyunlari.has(message.channel.id))return message.reply(`${E.uyari} Bu kanalda zaten bilmece var! Önce onu cevapla.`);
        const sec=rastgele(BILMECELER);
        bilmeceOyunlari.set(message.channel.id,sec);
        setTimeout(()=>{if(bilmeceOyunlari.has(message.channel.id)){bilmeceOyunlari.delete(message.channel.id);message.channel.send(`⏰ Süre doldu! Cevap: **${sec.cevap}**`).catch(()=>{});}},60000);
        return cvReply(message,cvBilgi(`🧩 **BİLMECE** *(60sn)*\n\n❓ **${sec.soru}**\n\n${E.nokta} *Cevabını mesaj olarak yaz!*`));
    }
    if(command==="soru"){
        if(soruOyunlari.has(message.channel.id))return message.reply(`${E.uyari} Bu kanalda zaten aktif soru var!`);
        const sec=rastgele(GENEL_SORULAR);
        soruOyunlari.set(message.channel.id,sec);
        setTimeout(()=>{if(soruOyunlari.has(message.channel.id)){soruOyunlari.delete(message.channel.id);message.channel.send(`⏰ Süre doldu! Cevap: **${sec.cevap}**`).catch(()=>{});}},30000);
        return cvReply(message,cvBilgi(`❓ **GENEL KÜLTÜR** *(30sn)*\n\n**${sec.soru}**\n\n${E.nokta} *Cevabını mesaj olarak yaz!*`));
    }
    if(command==="macsoru"){
        if(soruOyunlari.has(message.channel.id))return message.reply(`${E.uyari} Bu kanalda zaten aktif soru var!`);
        const sec=rastgele(MAC_SORULAR);
        soruOyunlari.set(message.channel.id,sec);
        setTimeout(()=>{if(soruOyunlari.has(message.channel.id)){soruOyunlari.delete(message.channel.id);message.channel.send(`⏰ Süre doldu! Cevap: **${sec.cevap}**`).catch(()=>{});}},30000);
        return cvReply(message,cvBilgi(`⚽ **MAÇ & FUTBOL SORUSU** *(30sn)*\n\n**${sec.soru}**\n\n${E.nokta} *Cevabını mesaj olarak yaz!*`));
    }
    if(command==="sayioyunu"){
        if(sayiOyunlari.has(message.channel.id))return message.reply(`${E.uyari} Bu kanalda zaten aktif oyun var!`);
        const maks=Math.min(parseInt(args[0])||100,1000);
        const sayi=Math.floor(Math.random()*maks)+1;
        const maksDenem=Math.ceil(Math.log2(maks))+3;
        sayiOyunlari.set(message.channel.id,{sayi,maks:maksDenem,denemeler:0});
        setTimeout(()=>{const o=sayiOyunlari.get(message.channel.id);if(o){sayiOyunlari.delete(message.channel.id);message.channel.send(`⏰ Süre doldu! Sayı **${o.sayi}** idi.`).catch(()=>{});}},120000);
        return cvReply(message,cvBilgi(`🔢 **SAYI TAHMİN** *(2dk)*\n\n1 ile ${maks} arasında sayı tuttum!\n${E.nokta} **${maksDenem}** hakkın var, mesaj olarak tahmin yap.`));
    }
    if(command==="dogrulukcesaret")return cvReply(message,cvDCPanel());
    if(command==="itirafpanel"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.\nYardım için: \`.yardim\``);
        return cvSend(message.channel,cvItirafPanel());
    }
    if(command==="istatistik"){
        const keys=await db.list("oyuncu_");let tG=0,tA=0,tO=0,tAnt=0,gIsim="",aIsim="",oIsim="",antIsim="";
        for(const key of keys.slice(0,100)){
            const d=await db.get(key);if(!d)continue;
            const uid=key.replace("oyuncu_","");
            let isim=uid;
            try{const m=await message.guild.members.fetch(uid).catch(()=>null);if(m)isim=m.displayName||m.user.username;}catch{}
            if((d.sezon?.gol||0)>tG){tG=d.sezon.gol;gIsim=isim;}
            if((d.sezon?.asist||0)>tA){tA=d.sezon.asist;aIsim=isim;}
            if((d.overall||0)>tO){tO=d.overall;oIsim=isim;}
            if((d.antrenman?.toplam||0)>tAnt){tAnt=d.antrenman.toplam;antIsim=isim;}
        }
        return cvReply(message,new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`📊 **SUNUCU FUTBOL İSTATİSTİKLERİ**`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `${E.gol} En Golcü: **${gIsim||"—"}** — **${tG}** gol\n` +
                `${E.asist} En Asistçi: **${aIsim||"—"}** — **${tA}** asist\n` +
                `${E.urun} En Yüksek OVR: **${oIsim||"—"}** — **${tO}** OVR\n` +
                `🏋️ En Çalışkan: **${antIsim||"—"}** — **${tAnt}** antrenman\n` +
                `${E.futbolcu} Toplam Kayıtlı: **${keys.length}** oyuncu`
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer())));
    }
    if(command==="snipe"){ const e=snipeCache.get(message.channel.id); if(!e)return message.reply(`${E.hata} Silinmiş mesaj yok.`); return cvReply(message,cvBilgi(`🔍 **SNIPE**\n\n**${e.author}** *(${Math.floor((Date.now()-e.time)/1000)}sn önce)*\n\n${e.content}`)); }
    if(command==="snipeall"){ const l=snipeAllCache.get(message.channel.id); if(!l?.length)return message.reply(`${E.hata} Yok.`); return cvReply(message,cvBilgi(`🔍 **SNIPE ALL**\n\n${l.slice(0,5).map((e,i)=>`**${i+1}.** **${e.author}** *(${Math.floor((Date.now()-e.time)/1000)}sn)*\n${e.content}`).join("\n\n")}`)); }
    if(command==="afk"){ const s=args.join(" ")||"Sebep belirtilmedi"; afkMap.set(message.author.id,{reason:s,time:Date.now(),tag:message.author.tag}); return cvReply(message,cvBilgi(`💤 **AFK**\n\n**${message.author.username}** AFK moduna geçti.\n${E.nokta} Sebep: **${s}**`)); }
    if(command==="afkkaldir"){ if(!afkMap.has(message.author.id))return message.reply(`${E.hata} AFK modunda değilsin.`); afkMap.delete(message.author.id); return message.reply(`${E.tik} AFK kaldırıldı! 👋`); }

    // ── Çekiliş ───────────────────────────────────────────
    if(command==="cekilis"){
        const alt=args[0]?.toLowerCase();
        if(alt==="olustur"){
            if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.\n→ \`.yardim\` ile yardım alabilirsin.`);
            if(cekilisler.has(message.guild.id))return message.reply(`${E.hata} Zaten aktif çekiliş var! Önce bitir veya iptal et.`);
            const sureTxt=args[args.length-1];const ms=sureyiMs(sureTxt);
            const odul=args.slice(1,args.length-1).join(" ");
            if(!odul||!ms)return message.reply("Kullanım: `.cekilis olustur [ödül] [süre: 10m/1h/1d]`\nÖrnek: `.cekilis olustur Bedava Transfer 2h`");
            const data={odul,bitisZamani:Date.now()+ms,katilimcilar:[],sonuclandimi:false};
            cekilisler.set(message.guild.id,data);
            await cvReply(message,cvCekilis(data));
            await log(message.guild,"ÇEKİLİŞ",`**${message.author.tag}** başlattı: **${odul}**`);
            setTimeout(()=>{const a=cekilisler.get(message.guild.id);if(a&&!a.sonuclandimi)sonuclandirCekilis(message.guild,message.channel);},ms);
            return;
        }
        if(alt==="katil"){const a=cekilisler.get(message.guild.id);if(!a)return message.reply(`${E.hata} Aktif çekiliş yok.`);if(a.katilimcilar.includes(message.author.id))return message.reply(`${E.sari} Zaten katıldın!`);a.katilimcilar.push(message.author.id);return message.reply(`${E.tik} Katıldın! Toplam: **${a.katilimcilar.length}**`);}
        if(alt==="bilgi"){const a=cekilisler.get(message.guild.id);if(!a)return message.reply(`${E.hata} Aktif yok.`);return cvReply(message,cvCekilis(a));}
        if(alt==="bitir"){if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);if(!cekilisler.has(message.guild.id))return message.reply(`${E.hata} Aktif yok.`);return sonuclandirCekilis(message.guild,message.channel,message);}
        if(alt==="iptal"){if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);cekilisler.delete(message.guild.id);return message.reply(`${E.tik} İptal edildi.`);}
        return message.reply("Kullanım: `.cekilis [olustur/katil/bilgi/bitir/iptal]`\nDetaylar için: `.yardim` → Eğlence");
    }

    // ── Ticket ────────────────────────────────────────────
    if(command==="ticketpanel"){if(!await isAdmin(message.member))return message.reply(`${E.hata} Admin yetkisi.`);return cvSend(message.channel,cvTicketPanel(cfg.ticketSebebleri?.length?cfg.ticketSebebleri:["Genel Destek"]));}
    if(command==="ticketkapat"){const tv=await db.get(`ticket_kanal_${message.channel.id}`);if(!tv)return message.reply(`${E.hata} Bu kanal ticket değil.`);if(!await isMod(message.member)&&message.author.id!==tv.userId)return message.reply(`${E.hata} Yetkisiz.`);await kapatTicket(message.channel,message.guild,message.author,tv);}
    if(command==="ticketsil"){if(!await isAdmin(message.member))return message.reply(`${E.hata} Admin yetkisi.`);if(!await db.get(`ticket_kanal_${message.channel.id}`))return message.reply(`${E.hata} Bu kanal ticket değil.`);await db.delete(`ticket_kanal_${message.channel.id}`);await message.channel.delete().catch(()=>{});}
    if(command==="ticketnot"){const tv=await db.get(`ticket_kanal_${message.channel.id}`);if(!tv)return message.reply(`${E.hata} Bu kanal ticket değil.`);const not=args.join(" ");if(!not)return message.reply("Kullanım: `.ticketnot [mesaj]`");tv.notlar=tv.notlar||[];tv.notlar.push({yazar:message.author.tag,not,tarih:tarihStr()});await db.set(`ticket_kanal_${message.channel.id}`,tv);return message.reply(`📝 Not eklendi.`);}
    if(command==="ticketdevret"){const tv=await db.get(`ticket_kanal_${message.channel.id}`);if(!tv)return message.reply(`${E.hata} Bu kanal ticket değil.`);if(!await isMod(message.member))return message.reply(`${E.hata} Mod yetkisi.`);const h=message.mentions.members.first();if(!h)return message.reply("Kullanım: `.ticketdevret @mod`");tv.atananMod=h.id;await db.set(`ticket_kanal_${message.channel.id}`,tv);await message.channel.permissionOverwrites.edit(h.id,{ViewChannel:true,SendMessages:true}).catch(()=>{});return message.reply(`↗️ **${h.displayName||h.user.username}**'e devredildi.`);}
    if(command==="ticketkalite"){const tv=await db.get(`ticket_kanal_${message.channel.id}`);if(!tv)return message.reply(`${E.hata} Bu kanal ticket değil.`);const p=parseInt(args[0]);if(isNaN(p)||p<1||p>5)return message.reply(`${E.hata} Puan 1-5 arası olmalı.`);tv.kalitePuani=p;await db.set(`ticket_kanal_${message.channel.id}`,tv);return message.reply(`${E.tik} ${"⭐".repeat(p)} (${p}/5)`);}
    if(command==="ticketlog"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod yetkisi.`);
        const keys=await db.list("ticket_log_");const loglar=[];
        for(const k of keys){const d=await db.get(k);if(d&&d.guildId===message.guild.id)loglar.push(d);}
        if(!loglar.length)return message.reply(`${E.nokta} Kapalı ticket yok.`);
        const sat=loglar.slice(-8).map(l=>`🎫 **#${l.ticketNo}** — ${l.sebep}\n${E.cizgi} ${l.userId?"Açan ID: "+l.userId:"?"} ${E.nokta} Kapatan: **${l.kapatan||"?"}** ${E.nokta} ${l.kalitePuani?"⭐".repeat(l.kalitePuani):"*Puansız*"}`).join("\n\n");
        return cvReply(message,cvBilgi(`📋 **TİCKET LOGLARI (Son 8)**\n\n${sat}`));
    }

    // ── Kap / Transfer ────────────────────────────────────
    if(command==="kap"){
        return cvReply(message,new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `${E.transfer} **KAP — TRANSFER SİSTEMİ**\n\n` +
                `${E.cizgi} İşlem tipini seç:\n` +
                `${E.nokta} **Transfer** — Başka takıma geç\n` +
                `${E.nokta} **Kiralık** — Geçici takım\n` +
                `${E.nokta} **Serbest** — Takımsız kal\n` +
                `${E.nokta} **Satılık** — Piyasaya çık\n` +
                `${E.nokta} **Fesih** — Sözleşmeyi bitir\n\n` +
                `${E.tik} Form kap kanalına gönderilir → Yetkili onaylar → Rol otomatik atanır.`
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("kap_transfer").setLabel("🔄 Transfer").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("kap_kiralik").setLabel("📋 Kiralık").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("kap_serbest").setLabel("🆓 Serbest").setStyle(ButtonStyle.Secondary)
            ))
            .addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("kap_satilik").setLabel("💲 Satılık").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("kap_fesih").setLabel("❌ Fesih").setStyle(ButtonStyle.Danger)
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer())));
    }
    if(command==="piyasa"){
        const keys=await db.list("oyuncu_");const oyuncular=[];
        for(const key of keys.slice(0,100)){
            const d=await db.get(key);if(!d||!d.piyasaDurumu||d.piyasaDurumu==="normal")continue;
            const uid=key.replace("oyuncu_","");
            let isim=uid;
            try{const m=await message.guild.members.fetch(uid).catch(()=>null);if(m)isim=m.displayName||m.user.username;}catch{}
            oyuncular.push({id:uid,_isim:isim,...d});
        }
        return cvReply(message,cvPiyasa(oyuncular));
    }
    if(command==="kapgiris"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.\nYardım: \`.yardim\` → Transfer`);
        const target=message.mentions.members.first();const takim=args[1];const ucret=args[2]||"0";const tip=args[3]?.toLowerCase()==="kiralik"?"kiralik":"transfer";
        if(!target||!takim)return message.reply("Kullanım: `.kapgiris @oyuncu [takım] [ücret] [transfer/kiralik]`");
        await kapOyuncuEkle(message.guild,target,takim,ucret,tip,cfg);
        const isim=target.displayName||target.user.username;
        await log(message.guild,"TRANSFER",`**${message.author.tag}** → **${isim}** **${takim}** (${tip})`);
        return message.reply(`${E.tik} **${isim}** → **${takim}** (${tip})`);
    }
    if(command==="kapcikis"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();if(!target)return message.reply("Kullanım: `.kapcikis @oyuncu`");
        const o=await getOyuncu(target.id);const eskiTakim=o.mevcutTakim;
        if(!eskiTakim)return message.reply(`${E.hata} Bu oyuncu zaten takımda değil.`);
        if(o.mevcutRolId){const r=message.guild.roles.cache.get(o.mevcutRolId);if(r)await target.roles.remove(r).catch(()=>{});}
        const son=o.takimGecmisi[o.takimGecmisi.length-1];if(son&&!son.cikis)son.cikis=tarihStr();
        o.mevcutTakim=null;o.mevcutRolId=null;o.piyasaDurumu="serbest";
        await saveOyuncu(target.id,o);
        const isim=target.displayName||target.user.username;
        await log(message.guild,"SERBEST",`**${isim}** **${eskiTakim}**'dan ayrıldı.`);
        return message.reply(`${E.tik} **${isim}** serbest bırakıldı.`);
    }
    if(command==="fesih"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();if(!target)return message.reply("Kullanım: `.fesih @oyuncu`");
        const o=await getOyuncu(target.id);const eskiTakim=o.mevcutTakim;
        if(o.mevcutRolId){const r=message.guild.roles.cache.get(o.mevcutRolId);if(r)await target.roles.remove(r).catch(()=>{});}
        const son=o.takimGecmisi[o.takimGecmisi.length-1];if(son&&!son.cikis){son.cikis=tarihStr();son.tip="fesih";}
        o.mevcutTakim=null;o.mevcutRolId=null;o.piyasaDurumu="serbest";
        await saveOyuncu(target.id,o);
        const isim=target.displayName||target.user.username;
        await log(message.guild,"FESİH",`**${isim}** fesih.${eskiTakim?` (${eskiTakim})`:""}`);
        return message.reply(`${E.kirmizi} **${isim}** sözleşmesi feshedildi.`);
    }
    if(command==="takimayarla"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();const takim=args.slice(1).join(" ");
        if(!target||!takim)return message.reply("Kullanım: `.takimayarla @oyuncu [takım]`");
        const o=await getOyuncu(target.id);o.mevcutTakim=takim;await saveOyuncu(target.id,o);
        return message.reply(`${E.tik} **${target.displayName||target.user.username}** → **${takim}**`);
    }
    if(command==="piyasadurumu"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();const durum=args[1]?.toLowerCase();
        if(!target||!["normal","satilik","kiralik","serbest"].includes(durum))return message.reply("Kullanım: `.piyasadurumu @oyuncu [normal/satilik/kiralik/serbest]`");
        const o=await getOyuncu(target.id);o.piyasaDurumu=durum;await saveOyuncu(target.id,o);
        return message.reply(`${E.tik} **${target.displayName||target.user.username}** → **${durum}**`);
    }

    // ── Admin/Mod Oyuncu ──────────────────────────────────
    if(command==="fix"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const keys=await db.list("oyuncu_");let sayac=0;
        for(const key of keys){
            const d=await db.get(key);if(!d?.haftalik||!Object.keys(d.haftalik).length)continue;
            for(const[s,v]of Object.entries(d.haftalik))d.statlar[s]=Math.min(99,(d.statlar[s]||50)+v);
            d.haftalik={};d.antrenman=d.antrenman||{toplam:0,buHafta:0};d.antrenman.buHafta=0;
            await saveOyuncu(key.replace("oyuncu_",""),d);sayac++;
        }
        await log(message.guild,"ADMIN",`**${message.author.tag}** fix — **${sayac}** oyuncu güncellendi.`);
        return cvReply(message,cvBilgi(`${E.tik} **FİX TAMAMLANDI**\n\n${E.cizgi} **${sayac}** oyuncunun haftalık antrenmanları statlarına uygulandı ve sıfırlandı.`));
    }
    if(command==="sezonkapat"){
        if(!await isAdmin(message.member))return message.reply(`${E.hata} Admin yetkisi.`);
        const keys=await db.list("oyuncu_");let sayac=0;
        for(const key of keys){
            const d=await db.get(key);if(!d)continue;
            d.kariyer=d.kariyer||{gol:0,asist:0,mac:0};
            d.kariyer.gol+=d.sezon?.gol||0;d.kariyer.asist+=d.sezon?.asist||0;d.kariyer.mac+=d.sezon?.mac||0;
            d.sezon={gol:0,asist:0,mac:0};d.haftalik={};d.antrenman=d.antrenman||{toplam:0,buHafta:0};d.antrenman.buHafta=0;
            await saveOyuncu(key.replace("oyuncu_",""),d);sayac++;
        }
        if(cfg.kanalSezon){const sk=message.guild.channels.cache.get(cfg.kanalSezon);if(sk)await cvSend(sk,cvBilgi(`📅 **SEZON SONA ERDİ** 🏆\n\n${E.cizgi} **${cfg.sezonAdi||"Sezon"}** kapandı!\n${E.nokta} Sezon istatistikleri kariyere işlendi.\n${E.nokta} Yeni sezon başlıyor!`));}
        await log(message.guild,"SEZON",`**${message.author.tag}** sezonu kapattı. **${sayac}** oyuncu.`);
        return message.reply(`${E.tik} Sezon kapatıldı. **${sayac}** oyuncu güncellendi.`);
    }
    if(command==="stalsil"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();if(!target)return message.reply("Kullanım: `.stalsil @kullanici`");
        const o=await getOyuncu(target.id);o.haftalik={};await saveOyuncu(target.id,o);
        return message.reply(`${E.tik} **${target.displayName||target.user.username}** haftalık sıfırlandı.`);
    }
    if(command==="stat"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        if(args[0]?.toLowerCase()!=="ayarla")return message.reply(`Kullanım: \`.stat ayarla @kullanici [stat] [1-99]\`\nStat listesi: \`.statlistesi\``);
        const target=message.mentions.members.first();if(!target)return message.reply("Kullanım: `.stat ayarla @k [stat] [1-99]`");
        const deger=parseInt(args[args.length-1]);const statAdi=args.slice(2,args.length-1).join(" ");
        if(!statAdi||isNaN(deger))return message.reply("Kullanım: `.stat ayarla @k [stat] [1-99]`");
        const eslesme=statBul(statAdi);
        if(!eslesme)return message.reply(`${E.hata} **"${statAdi}"** bulunamadı!\n→ \`.statlistesi\` ile listeye bak.`);
        if(deger<1||deger>99)return message.reply(`${E.hata} 1-99 arasında olmalı.`);
        const o=await getOyuncu(target.id);const eski=o.statlar[eslesme];o.statlar[eslesme]=deger;await saveOyuncu(target.id,o);
        await log(message.guild,"ADMIN",`**${target.user.tag}** ${eslesme}: ${eski}→${deger}`);
        return message.reply(`${E.tik} **${target.displayName||target.user.username}** — **${eslesme}**: **${eski}** → **${deger}**`);
    }
    if(["gol","asist","mac"].includes(command)){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();
        if(args[0]?.toLowerCase()!=="ekle"||!target)return message.reply(`Kullanım: \`.${command} ekle @kullanici\``);
        const o=await getOyuncu(target.id);
        o.sezon=o.sezon||{gol:0,asist:0,mac:0};o.kariyer=o.kariyer||{gol:0,asist:0,mac:0};
        o.sezon[command]++;o.kariyer[command]++;
        await saveOyuncu(target.id,o);
        const emoji=command==="gol"?E.gol:command==="asist"?E.asist:"⚽";
        const isim=target.displayName||target.user.username;
        await log(message.guild,"ADMIN",`**${isim}** ${command}+1 (${o.sezon[command]})`);
        return message.reply(`${emoji} **${isim}** — **${command}** +1 (toplam: **${o.sezon[command]}**)`);
    }
    if(command==="kupa"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();const kupAdi=args.slice(2).join(" ");
        if(args[0]?.toLowerCase()!=="ekle"||!target||!kupAdi)return message.reply("Kullanım: `.kupa ekle @kullanici [kupa adı]`");
        const o=await getOyuncu(target.id);o.kupalar=o.kupalar||[];o.kupalar.push(`${kupAdi} (${tarihStr()})`);await saveOyuncu(target.id,o);
        await log(message.guild,"KUP",`**${target.displayName||target.user.username}** kupa: **${kupAdi}**`);
        return message.reply(`🏆 **${target.displayName||target.user.username}** — **${kupAdi}** eklendi!`);
    }
    if(command==="sakatlik"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();const gun=parseInt(args[args.length-1]);
        const sebep=args.slice(1,args.length-1).join(" ");
        if(!target||!sebep||isNaN(gun))return message.reply("Kullanım: `.sakatlik @k [sebep] [gün]`");
        const bitTarih=new Date(Date.now()+gun*86400000).toLocaleDateString("tr-TR");
        const o=await getOyuncu(target.id);o.sakatlik={neden:sebep,basTarih:tarihStr(),bitTarih};await saveOyuncu(target.id,o);
        return message.reply(`🩹 **${target.displayName||target.user.username}** — ${gun}gün — **${sebep}** — Bitiş: **${bitTarih}**`);
    }
    if(command==="sakatliksil"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const target=message.mentions.members.first();if(!target)return message.reply("Kullanım: `.sakatliksil @k`");
        const o=await getOyuncu(target.id);o.sakatlik=null;await saveOyuncu(target.id,o);
        return message.reply(`${E.tik} **${target.displayName||target.user.username}** sakatlık kaldırıldı.`);
    }
    if(command==="oyuncusifirla"){
        if(!await isAdmin(message.member))return message.reply(`${E.hata} Admin yetkisi.`);
        const target=message.mentions.members.first();if(!target)return message.reply("Kullanım: `.oyuncusifirla @k`");
        await db.delete(`oyuncu_${target.id}`);
        return message.reply(`${E.tik} **${target.displayName||target.user.username}** tüm verileri sıfırlandı.`);
    }

    // ── Yetkili Stat ──────────────────────────────────────
    if(command==="yetkilistat"){
        if(!await isMod(message.member))return message.reply(`${E.hata} Mod/Admin yetkisi.`);
        const keys=await db.list("yetkililog_");const loglar=[];
        for(const k of keys){const d=await db.get(k);if(d&&d.guildId===message.guild.id)loglar.push(d);}
        const sayaclar={};
        for(const l of loglar){sayaclar[l.userId]=(sayaclar[l.userId]||0)+1;}
        const sorted=Object.entries(sayaclar).sort((a,b)=>b[1]-a[1]).slice(0,10);
        const liste=[];
        for(const[uid,say]of sorted){
            let isim=uid;try{const m=await message.guild.members.fetch(uid).catch(()=>null);if(m)isim=m.displayName||m.user.username;}catch{}
            liste.push(`${E.nokta} **${isim}** — **${say}** işlem`);
        }
        return cvReply(message,cvBilgi(`⚙️ **YETKİLİ AKTİVİTE İSTATİSTİĞİ**\n\n${liste.join("\n")||`${E.nokta} *Veri yok.*`}`));
    }

    // ── Sosyal Medya: Instagram ────────────────────────────
    if(command==="ig"){
        const alt=args[0]?.toLowerCase();
        if(alt==="hesap"){
            const uname=args[1];if(!uname)return message.reply("Kullanım: `.ig hesap [kullanıcıadı]`");
            if(await db.get(`ig_${uname.toLowerCase()}`))return message.reply(`${E.hata} Bu kullanıcı adı alınmış!`);
            const hesap={username:uname,userId:message.author.id,bio:"",takipciler:[],takipEdilenler:[],kayitTarihi:tarihStr()};
            await db.set(`ig_${uname.toLowerCase()}`,hesap);
            await db.set(`iguser_${message.author.id}`,uname.toLowerCase());
            const o=await getOyuncu(message.author.id);o.ig=uname;await saveOyuncu(message.author.id,o);
            if(cfg.kanalIg){const k=message.guild.channels.cache.get(cfg.kanalIg);if(k)await k.send(`${E.ig} **@${uname}** Instagram'a katıldı! 🎉`);}
            return message.reply(`${E.tik} Instagram hesabın: **@${uname}**`);
        }
        const igKey=await db.get(`iguser_${message.author.id}`);
        if(!igKey&&alt!=="profil")return message.reply(`${E.hata} Önce hesap aç!\n→ \`.ig hesap [kullanıcıadı]\``);
        const igH=igKey?await db.get(`ig_${igKey}`):null;

        if(alt==="durum"){const bio=args.slice(1).join(" ");if(!bio)return message.reply("Kullanım: `.ig durum [biyografi]`");igH.bio=bio;await db.set(`ig_${igKey}`,igH);return message.reply(`${E.tik} Bio: *${bio}*`);}
        if(alt==="post"){
            const ic=args.slice(1).join(" ");if(!ic)return message.reply("Kullanım: `.ig post [metin]`");
            const pid=`igpost_${message.author.id}_${Date.now()}`;
            const post={id:pid,userId:message.author.id,username:igKey,icerik:ic,begeniler:[],yorumlar:[],tarih:tarihStr()};
            await db.set(pid,post);
            const postlar=await db.get(`igposts_${message.author.id}`)||[];postlar.push(pid);await db.set(`igposts_${message.author.id}`,postlar);
            if(cfg.kanalIg){
                const k=message.guild.channels.cache.get(cfg.kanalIg);
                if(k)await cvSend(k,new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.ig} **@${igKey}** yeni post paylaştı!\n\n${ic}\n\n${E.cizgi} *${tarihStr()}*`))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`igbegen_${pid}`).setLabel("❤️ Beğen (0)").setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`igyorum_${pid}`).setLabel("💬 Yorum").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`igtakip_${message.author.id}`).setLabel("➕ Takip Et").setStyle(ButtonStyle.Primary)
                    ))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()))
                );
            }
            return message.reply(`${E.tik} Post paylaşıldı!`);
        }
        if(alt==="profil"){
            const t=message.mentions.members.first()||message.member;
            const tk=await db.get(`iguser_${t.id}`);if(!tk)return message.reply(`${E.hata} Bu kullanıcının IG hesabı yok.`);
            const th=await db.get(`ig_${tk}`);const tp=await db.get(`igposts_${t.id}`)||[];
            const pv=[];for(const p of tp.slice(-5)){const d=await db.get(p);if(d)pv.push(d);}
            const isim=t.displayName||t.user.username;
            const pSat=pv.length?pv.reverse().map((p,i)=>`**${i+1}.** ${p.icerik}\n${E.cizgi} ❤️ ${p.begeniler.length} ${E.nokta} *${p.tarih}*`).join("\n\n"):`${E.nokta} *Post yok.*`;
            return cvReply(message,new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.ig} **@${tk}** — ${isim}\n${E.cizgi} Bio: *${th.bio||"Yok"}*\n${E.cizgi} Takipçi: **${th.takipciler?.length||0}** ${E.nokta} Takip: **${th.takipEdilenler?.length||0}** ${E.nokta} Post: **${tp.length}**`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Son Postlar**\n${pSat}`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer())));
        }
        if(alt==="takipet"){
            const t=message.mentions.members.first();if(!t)return message.reply("Kullanım: `.ig takipet @kullanici`");
            const tk=await db.get(`iguser_${t.id}`);if(!tk)return message.reply(`${E.hata} Bu kullanıcının IG hesabı yok.`);
            if(igH.takipEdilenler?.includes(tk))return message.reply(`${E.uyari} Zaten takip ediyorsun!`);
            igH.takipEdilenler=igH.takipEdilenler||[];igH.takipEdilenler.push(tk);await db.set(`ig_${igKey}`,igH);
            const th=await db.get(`ig_${tk}`);th.takipciler=th.takipciler||[];th.takipciler.push(igKey);await db.set(`ig_${tk}`,th);
            return message.reply(`${E.tik} **@${tk}** takip ediliyor!`);
        }
    }

    // ── Sosyal Medya: Twitter ─────────────────────────────
    if(command==="tw"){
        const alt=args[0]?.toLowerCase();
        if(alt==="hesap"){
            const uname=args[1];if(!uname)return message.reply("Kullanım: `.tw hesap [kullanıcıadı]`");
            if(await db.get(`tw_${uname.toLowerCase()}`))return message.reply(`${E.hata} Bu kullanıcı adı alınmış!`);
            const hesap={username:uname,userId:message.author.id,bio:"",takipciler:[],takipEdilenler:[],kayitTarihi:tarihStr()};
            await db.set(`tw_${uname.toLowerCase()}`,hesap);await db.set(`twuser_${message.author.id}`,uname.toLowerCase());
            const o=await getOyuncu(message.author.id);o.tw=uname;await saveOyuncu(message.author.id,o);
            if(cfg.kanalTw){const k=message.guild.channels.cache.get(cfg.kanalTw);if(k)await k.send(`${E.tw} **@${uname}** Twitter'a katıldı! 🎉`);}
            return message.reply(`${E.tik} Twitter hesabın: **@${uname}**`);
        }
        const twKey=await db.get(`twuser_${message.author.id}`);
        if(!twKey&&alt!=="profil")return message.reply(`${E.hata} Önce hesap aç!\n→ \`.tw hesap [kullanıcıadı]\``);
        const twH=twKey?await db.get(`tw_${twKey}`):null;

        if(alt==="durum"||alt==="bio"){const bio=args.slice(1).join(" ");if(!bio)return message.reply("Kullanım: `.tw durum [bio]`");twH.bio=bio;await db.set(`tw_${twKey}`,twH);return message.reply(`${E.tik} Bio: *${bio}*`);}
        if(alt==="tweet"){
            const ic=args.slice(1).join(" ");if(!ic)return message.reply("Kullanım: `.tw tweet [metin]`");
            if(ic.length>280)return message.reply(`${E.hata} Tweet 280 karakter limitini aşıyor! (${ic.length}/280)`);
            const tid=`tweet_${message.author.id}_${Date.now()}`;
            const tweet={id:tid,userId:message.author.id,username:twKey,icerik:ic,begeniler:[],rtler:[],tarih:tarihStr()};
            await db.set(tid,tweet);const tweets=await db.get(`tweets_${message.author.id}`)||[];tweets.push(tid);await db.set(`tweets_${message.author.id}`,tweets);
            if(cfg.kanalTw){
                const k=message.guild.channels.cache.get(cfg.kanalTw);
                if(k)await cvSend(k,new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.tw} **@${twKey}** tweet attı:\n\n${ic}\n\n${E.cizgi} *${tarihStr()}*`))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`twbegen_${tid}`).setLabel("❤️ Beğen (0)").setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`twrt_${tid}`).setLabel("🔁 RT (0)").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`twtakip_${message.author.id}`).setLabel("➕ Takip Et").setStyle(ButtonStyle.Primary)
                    ))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()))
                );
            }
            return message.reply(`${E.tik} Tweet atıldı!`);
        }
        if(alt==="profil"){
            const t=message.mentions.members.first()||message.member;
            const tk=await db.get(`twuser_${t.id}`);if(!tk)return message.reply(`${E.hata} Bu kullanıcının Twitter hesabı yok.`);
            const th=await db.get(`tw_${tk}`);const ts=await db.get(`tweets_${t.id}`)||[];
            const tv=[];for(const tid of ts.slice(-5)){const d=await db.get(tid);if(d)tv.push(d);}
            const isim=t.displayName||t.user.username;
            const tSat=tv.length?tv.reverse().map((tw,i)=>`**${i+1}.** ${tw.icerik}\n${E.cizgi} ❤️ ${tw.begeniler.length} 🔁 ${tw.rtler?.length||0} ${E.nokta} *${tw.tarih}*`).join("\n\n"):`${E.nokta} *Tweet yok.*`;
            return cvReply(message,new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.tw} **@${tk}** — ${isim}\n${E.cizgi} Bio: *${th.bio||"Yok"}*\n${E.cizgi} Takipçi: **${th.takipciler?.length||0}** ${E.nokta} Takip: **${th.takipEdilenler?.length||0}** ${E.nokta} Tweet: **${ts.length}**`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Son Tweetler**\n${tSat}`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer())));
        }
        if(alt==="takipet"){
            const t=message.mentions.members.first();if(!t)return message.reply("Kullanım: `.tw takipet @kullanici`");
            const tk=await db.get(`twuser_${t.id}`);if(!tk)return message.reply(`${E.hata} Bu kullanıcının Twitter hesabı yok.`);
            if(twH.takipEdilenler?.includes(tk))return message.reply(`${E.uyari} Zaten takip ediyorsun!`);
            twH.takipEdilenler=twH.takipEdilenler||[];twH.takipEdilenler.push(tk);await db.set(`tw_${twKey}`,twH);
            const th=await db.get(`tw_${tk}`);th.takipciler=th.takipciler||[];th.takipciler.push(twKey);await db.set(`tw_${tk}`,th);
            return message.reply(`${E.tik} **@${tk}** takip ediliyor!`);
        }
    }
});

// ============================================================
//  KAP OYUNCU EKLEME
// ============================================================
async function kapOyuncuEkle(guild, member, takimAdi, ucret, tip, cfg) {
    const o=await getOyuncu(member.id);
    const eskiTakim=o.mevcutTakim;
    if(o.mevcutRolId){const r=guild.roles.cache.get(o.mevcutRolId);if(r)await member.roles.remove(r).catch(()=>{});}
    if(eskiTakim){const son=o.takimGecmisi[o.takimGecmisi.length-1];if(son&&!son.cikis)son.cikis=tarihStr();}
    o.takimGecmisi.push({takim:takimAdi,giris:tarihStr(),cikis:null,tip,ucret});
    o.mevcutTakim=takimAdi;o.piyasaDurumu="normal";
    let atananRol=null;
    if(cfg?.otomatikRol!==false){
        const r=enYakinRol(guild,takimAdi);
        if(r){await member.roles.add(r).catch(()=>{});o.mevcutRolId=r.id;atananRol=r;}
    }
    await saveOyuncu(member.id,o);
    return atananRol;
}

// ============================================================
//  ÇEKİLİŞ SONUÇLANDIRMA
// ============================================================
async function sonuclandirCekilis(guild, channel, replyMsg=null) {
    const a=cekilisler.get(guild.id);
    if(!a||a.sonuclandimi)return;
    a.sonuclandimi=true;cekilisler.delete(guild.id);
    if(!a.katilimcilar.length){const m=`${E.hata} Kimse katılmadı.`;return replyMsg?replyMsg.reply(m):channel.send(m);}
    const kazanan=rastgele(a.katilimcilar);
    let kazananIsim=kazanan;
    try{const m=await guild.members.fetch(kazanan).catch(()=>null);if(m)kazananIsim=m.displayName||m.user.username;}catch{}
    await log(guild,"ÇEKİLİŞ",`Kazanan: **${kazananIsim}** — **${a.odul}**`);
    return cvSend(channel,new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎉 **ÇEKİLİŞ SONUÇLANDI!**`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `🎁 **Ödül:** ${a.odul}\n${E.tac} **Kazanan:** <@${kazanan}> (${kazananIsim})\n👥 **Katılımcı:** ${a.katilimcilar.length} kişi\n🎊 Tebrikler!`
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer())));
}

// ============================================================
//  TİCKET KAPATMA
// ============================================================
async function kapatTicket(channel, guild, kapatan, tv) {
    tv.kapanis=tarihStr();tv.kapatan=kapatan.tag;
    await db.set(`ticket_log_${guild.id}_${tv.ticketNo}`,{...tv,guildId:guild.id});
    await db.delete(`ticket_kanal_${channel.id}`);
    const cfg=await getConfig(guild.id);
    if(cfg.kanalLog){
        const lk=guild.channels.cache.get(cfg.kanalLog);
        if(lk){
            const y=tv.kalitePuani?"⭐".repeat(tv.kalitePuani)+"☆".repeat(5-tv.kalitePuani):"*Puansız*";
            const notlar=tv.notlar?.length?tv.notlar.map(n=>`📝 **${n.yazar}**: ${n.not}`).join("\n"):"*Not yok*";
            await lk.send(`📋 **Ticket Kapandı #${tv.ticketNo}**\nKonu: **${tv.sebep}** ${E.nokta} Açan: <@${tv.userId}>\nKapatan: **${kapatan.tag}** ${E.nokta} ${y}\n**Notlar:** ${notlar}`);
        }
    }
    await channel.send(`${E.kilit} Ticket kapatıldı. 5sn içinde silinecek.`);
    setTimeout(()=>channel.delete().catch(()=>{}),5000);
}

// ============================================================
//  ETKİLEŞİM İŞLEYİCİSİ
// ============================================================
client.on(Events.InteractionCreate, async(interaction)=>{
    try {
        // ── Select Menüler ────────────────────────────────
        if(interaction.isStringSelectMenu()){
            if(interaction.customId==="yardim_kategori")return cvUpdate(interaction,cvYardimKat(interaction.values[0]));

            if(interaction.customId==="ticket_olustur"){
                const idx=parseInt(interaction.values[0].replace("ts_",""));
                const cfg=await getConfig(interaction.guild.id);
                const sebep=cfg.ticketSebebleri[idx]||"Genel Destek";
                const userId=interaction.user.id;
                const mevcut=await db.list("ticket_kanal_");
                for(const k of mevcut){const d=await db.get(k);if(d&&d.userId===userId&&d.guildId===interaction.guild.id)return eph(interaction,`${E.hata} Zaten açık ticketın var! <#${k.replace("ticket_kanal_","")}>`);}
                const sayac=(await db.get(`ticketsayac_${interaction.guild.id}`))||0;
                const ticketNo=sayac+1;await db.set(`ticketsayac_${interaction.guild.id}`,ticketNo);
                const kanalAdi=`ticket-${ticketNo}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g,"").substring(0,50);
                const ow=[
                    {id:interaction.guild.id,deny:[PermissionFlagsBits.ViewChannel]},
                    {id:userId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
                    {id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels]},
                ];
                for(const r of[...(cfg.adminRoller||[]),...(cfg.modRoller||[])])ow.push({id:r,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]});
                const katKanal=cfg.kanalTicket?interaction.guild.channels.cache.get(cfg.kanalTicket):null;
                const yeni=await interaction.guild.channels.create({name:kanalAdi,type:ChannelType.GuildText,parent:katKanal?.type===ChannelType.GuildCategory?katKanal.id:null,permissionOverwrites:ow});
                const tv={ticketNo,userId,sebep,acilis:saatStr(),guildId:interaction.guild.id,notlar:[],kalitePuani:null,atananMod:null};
                await db.set(`ticket_kanal_${yeni.id}`,tv);
                await cvSend(yeni,cvTicketAcik(userId,sebep,ticketNo));
                // Tüm yetkilileri tagla
                const tags=[...(cfg.adminRoller||[]),...(cfg.modRoller||[])].map(r=>`<@&${r}>`).join(" ");
                if(tags)await yeni.send(`${tags}\n🎫 Yeni ticket: **${sebep}** — <@${userId}>`);
                await log(interaction.guild,"TİCKET",`**#${ticketNo}** — **${sebep}** — <@${userId}> — ${yeni}`);
                return eph(interaction,`🎫 Ticket açıldı! ${yeni}`);
            }

            if(interaction.customId.startsWith("ticket_kalitesec_")){
                const kId=interaction.customId.replace("ticket_kalitesec_","");
                const tv=await db.get(`ticket_kanal_${kId}`);if(!tv)return eph(interaction,"Ticket bulunamadı.");
                tv.kalitePuani=parseInt(interaction.values[0]);await db.set(`ticket_kanal_${kId}`,tv);
                return eph(interaction,`${E.tik} ${"⭐".repeat(tv.kalitePuani)} (${tv.kalitePuani}/5)`);
            }
        }

        if(!interaction.isButton()&&!interaction.isModalSubmit())return;

        // ── Butonlar ──────────────────────────────────────
        if(interaction.isButton()){
            const id=interaction.customId;

            // Nitelik Drop — Sadece 1 kişi
            if(id.startsWith("droptopla_")){
                const dropId=id.replace("droptopla_","");
                const d=await db.get(dropId);
                if(!d||!d.aktif)return eph(interaction,`${E.hata} Bu drop artık aktif değil.`);
                if(d.toplayan)return eph(interaction,`${E.uyari} Bu dropu **${d.topiayanAd||"biri"}** çoktan topladı!`);
                const o=await getOyuncu(interaction.user.id);
                const eski=o.statlar[d.stat]??50;
                o.statlar[d.stat]=Math.min(99,eski+d.deger);
                o.nitelikler=o.nitelikler||[];
                o.nitelikler.push({stat:d.stat,grup:d.grup,deger:d.deger,nadirlik:d.nadirlik,tarih:tarihStr()});
                await saveOyuncu(interaction.user.id,o);
                d.aktif=false;d.toplayan=interaction.user.id;d.topiayanAd=interaction.user.username;
                await db.set(dropId,d);
                // Butonu güncelle — artık kim topladığını göster
                try{
                    await interaction.update({components:[{type:1,components:[{type:2,style:2,label:`🎖️ ${interaction.user.username} topladı!`,custom_id:"nitelik_toplandı",disabled:true}]}]});
                }catch{await eph(interaction,`${E.tik} Nitelik toplandı!`);}
                await log(interaction.guild,"DROP",`**${interaction.user.username}** topladı: **${d.stat}** +${d.deger} (${d.stat}: ${eski}→${o.statlar[d.stat]})`);
                return;
            }

            // Kariyer navigasyon butonları
            if(id.startsWith("kg_")){const tid=id.replace("kg_","");const m=await interaction.guild.members.fetch(tid).catch(()=>null);if(!m)return eph(interaction,"Kullanıcı bulunamadı.");return cvUpdate(interaction,cvKariyer(m,await getOyuncu(tid)));}
            if(id.startsWith("st_")){
                // st_GRUP_userId
                const parts=id.split("_");const userId=parts[parts.length-1];const grup=parts.slice(1,-1).join("_");
                const m=await interaction.guild.members.fetch(userId).catch(()=>null);if(!m)return eph(interaction,"Kullanıcı bulunamadı.");
                return cvUpdate(interaction,cvStatGrup(m,await getOyuncu(userId),grup));
            }
            if(id.startsWith("ah_")){const tid=id.replace("ah_","");const m=await interaction.guild.members.fetch(tid).catch(()=>null);if(!m)return eph(interaction,"Kullanıcı bulunamadı.");return cvUpdate(interaction,cvAntrenman(m,await getOyuncu(tid)));}
            if(id.startsWith("gs_")){const tid=id.replace("gs_","");const m=await interaction.guild.members.fetch(tid).catch(()=>null);if(!m)return eph(interaction,"Kullanıcı bulunamadı.");return cvUpdate(interaction,cvStatlar(m,await getOyuncu(tid)));}
            if(id.startsWith("tm_")){const tid=id.replace("tm_","");const m=await interaction.guild.members.fetch(tid).catch(()=>null);if(!m)return eph(interaction,"Kullanıcı bulunamadı.");return cvUpdate(interaction,cvTakim(m,await getOyuncu(tid)));}
            if(id.startsWith("nt_")){const tid=id.replace("nt_","");const m=await interaction.guild.members.fetch(tid).catch(()=>null);if(!m)return eph(interaction,"Kullanıcı bulunamadı.");return cvUpdate(interaction,cvNiteliklerim(m,await getOyuncu(tid)));}

            // Leaderboard butonları
            if(id.startsWith("lb_")){return cvUpdate(interaction,await cvLeaderboard(interaction.guild,id.replace("lb_","")));}

            // Çekiliş
            if(id==="cekilis_katil"){
                const a=cekilisler.get(interaction.guild.id);if(!a)return eph(interaction,`${E.hata} Aktif çekiliş yok.`);
                if(a.katilimcilar.includes(interaction.user.id))return eph(interaction,`${E.uyari} Zaten katıldın!`);
                a.katilimcilar.push(interaction.user.id);
                // Güncel çekiliş container
                const bitis=a.bitisZamani?new Date(a.bitisZamani).toLocaleString("tr-TR"):"Süresiz";
                const cekilisC=new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎰 **ÇEKİLİŞ — DEVAM EDİYOR**\n\n🎁 **Ödül:** ${a.odul}\n👥 **Katılımcı:** ${a.katilimcilar.length} kişi\n⏰ **Bitiş:** ${bitis}`))



                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("cekilis_katil").setLabel(`🎰 Katıl! (${a.katilimcilar.length} kişi)`).setStyle(ButtonStyle.Success)
                    ))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
                try{await cvUpdate(interaction,cekilisC);}
                catch(e){await eph(interaction,`${E.tik} Katıldın! **${a.katilimcilar.length}** kişi.`);}
                return;
            }

            // Doğruluk/Cesaret
            if(id==="dc_dogruluk")return eph(interaction,`💎 **DOĞRULUK SORUSU**\n\n${rastgele(DOGRULUK_SORUSU)}`);
            if(id==="dc_cesaret")return eph(interaction,`🎭 **CESARET SORUSU**\n\n${rastgele(CESARET_SORUSU)}`);

            // İtiraf
            if(id==="itiraf_gonder"){
                const modal=new ModalBuilder().setCustomId("itiraf_modal").setTitle("💬 Anonim İtiraf");
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("itiraf_ic").setLabel("İtirafın (anonim gider)").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder("İtirafını buraya yaz...")));
                return interaction.showModal(modal);
            }

            // Instagram beğen
            if(id.startsWith("igbegen_")){
                const pid=id.replace("igbegen_","");const post=await db.get(pid);if(!post)return eph(interaction,`${E.hata} Post bulunamadı.`);
                const idx=post.begeniler.indexOf(interaction.user.id);
                if(idx>-1)post.begeniler.splice(idx,1);else post.begeniler.push(interaction.user.id);
                await db.set(pid,post);
                const igPostC=new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.ig} **@${post.username}** post paylaştı:

${post.icerik}

${E.cizgi} *${post.tarih}*`))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`igbegen_${pid}`).setLabel(`❤️ Beğen (${post.begeniler.length})`).setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`igyorum_${pid}`).setLabel("💬 Yorum").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`igtakip_${post.userId}`).setLabel("➕ Takip Et").setStyle(ButtonStyle.Primary)
                    ))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
                try{await cvUpdate(interaction,igPostC);}
                catch(e){await eph(interaction,idx>-1?"Beğeni kaldırıldı.":"Beğenildi! ❤️");}
                return;
            }
            // IG yorum
            if(id.startsWith("igyorum_")){
                const modal=new ModalBuilder().setCustomId(`igyorum_modal_${id.replace("igyorum_","")}`).setTitle("💬 Yorum Yap");
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("yorum").setLabel("Yorumun").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)));
                return interaction.showModal(modal);
            }
            // IG takip et butonu
            if(id.startsWith("igtakip_")){
                const targetId=id.replace("igtakip_","");
                if(targetId===interaction.user.id)return eph(interaction,`${E.hata} Kendini takip edemezsin!`);
                const igKey=await db.get(`iguser_${interaction.user.id}`);if(!igKey)return eph(interaction,`${E.hata} IG hesabın yok! \`.ig hesap [kullanıcıadı]\` yaz.`);
                const tk=await db.get(`iguser_${targetId}`);if(!tk)return eph(interaction,`${E.hata} Bu kullanıcının IG hesabı yok.`);
                const igH=await db.get(`ig_${igKey}`);igH.takipEdilenler=igH.takipEdilenler||[];
                if(igH.takipEdilenler.includes(tk))return eph(interaction,`${E.uyari} Zaten takip ediyorsun!`);
                igH.takipEdilenler.push(tk);await db.set(`ig_${igKey}`,igH);
                const th=await db.get(`ig_${tk}`);th.takipciler=th.takipciler||[];th.takipciler.push(igKey);await db.set(`ig_${tk}`,th);
                return eph(interaction,`${E.tik} **@${tk}** takip ediliyor!`);
            }
            // Twitter beğen
            if(id.startsWith("twbegen_")){
                const tid=id.replace("twbegen_","");const tweet=await db.get(tid);if(!tweet)return eph(interaction,`${E.hata} Tweet bulunamadı.`);
                const idx=tweet.begeniler.indexOf(interaction.user.id);
                if(idx>-1)tweet.begeniler.splice(idx,1);else tweet.begeniler.push(interaction.user.id);
                await db.set(tid,tweet);
                const twPostC=new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.tw} **@${tweet.username}** tweet attı:

${tweet.icerik}

${E.cizgi} *${tweet.tarih}*`))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`twbegen_${tid}`).setLabel(`❤️ Beğen (${tweet.begeniler.length})`).setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`twrt_${tid}`).setLabel(`🔁 RT (${tweet.rtler?.length||0})`).setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`twtakip_${tweet.userId}`).setLabel("➕ Takip Et").setStyle(ButtonStyle.Primary)
                    ))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
                try{await cvUpdate(interaction,twPostC);}
                catch(e){await eph(interaction,idx>-1?"Beğeni kaldırıldı.":"Beğenildi! ❤️");}
                return;
            }
            // Twitter RT
            if(id.startsWith("twrt_")){
                const tid=id.replace("twrt_","");const tweet=await db.get(tid);if(!tweet)return eph(interaction,`${E.hata} Tweet bulunamadı.`);
                tweet.rtler=tweet.rtler||[];const idx=tweet.rtler.indexOf(interaction.user.id);
                if(idx>-1)tweet.rtler.splice(idx,1);else tweet.rtler.push(interaction.user.id);
                await db.set(tid,tweet);
                const twRtC=new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.tw} **@${tweet.username}** tweet attı:

${tweet.icerik}

${E.cizgi} *${tweet.tarih}*`))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`twbegen_${tid}`).setLabel(`❤️ Beğen (${tweet.begeniler.length})`).setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`twrt_${tid}`).setLabel(`🔁 RT (${tweet.rtler.length})`).setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`twtakip_${tweet.userId}`).setLabel("➕ Takip Et").setStyle(ButtonStyle.Primary)
                    ))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()));
                try{await cvUpdate(interaction,twRtC);}
                catch(e){await eph(interaction,idx>-1?"RT geri alındı.":"Retweet edildi! 🔁");}
                return;
            }
            // Twitter takip butonu
            if(id.startsWith("twtakip_")){
                const targetId=id.replace("twtakip_","");
                if(targetId===interaction.user.id)return eph(interaction,`${E.hata} Kendini takip edemezsin!`);
                const twKey=await db.get(`twuser_${interaction.user.id}`);if(!twKey)return eph(interaction,`${E.hata} Twitter hesabın yok! \`.tw hesap [kullanıcıadı]\` yaz.`);
                const tk=await db.get(`twuser_${targetId}`);if(!tk)return eph(interaction,`${E.hata} Bu kullanıcının Twitter hesabı yok.`);
                const twH=await db.get(`tw_${twKey}`);twH.takipEdilenler=twH.takipEdilenler||[];
                if(twH.takipEdilenler.includes(tk))return eph(interaction,`${E.uyari} Zaten takip ediyorsun!`);
                twH.takipEdilenler.push(tk);await db.set(`tw_${twKey}`,twH);
                const th=await db.get(`tw_${tk}`);th.takipciler=th.takipciler||[];th.takipciler.push(twKey);await db.set(`tw_${tk}`,th);
                return eph(interaction,`${E.tik} **@${tk}** takip ediliyor!`);
            }

            // Kap butonları
            if(id.startsWith("kap_")){
                const tip=id.replace("kap_","");
                const tipStr={transfer:"🔄 Transfer",kiralik:"📋 Kiralık",serbest:"🆓 Serbest Bırak",satilik:"💲 Satılık",fesih:"❌ Fesih"}[tip]||tip;
                const modal=new ModalBuilder().setCustomId(`kapmodal_${tip}`).setTitle(tipStr);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("oyuncu").setLabel("Oyuncu Adı veya Discord ID").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Kullanıcı adı veya ID")));
                if(["transfer","kiralik"].includes(tip)){
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("takim").setLabel("Takım Adı").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ucret").setLabel("Ücret (boş bırakabilirsin)").setStyle(TextInputStyle.Short).setRequired(false).setValue("0"))
                    );
                    if(tip==="kiralik")modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sure").setLabel("Kiralık Süresi").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("Örn: 1 ay, sezon sonu")));
                }else{
                    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("aciklama").setLabel("Ek Açıklama (isteğe bağlı)").setStyle(TextInputStyle.Paragraph).setRequired(false)));
                }
                return interaction.showModal(modal);
            }

            // Kap onay/red
            if(id.startsWith("ko_evet_")||id.startsWith("ko_hayir_")){
                if(!await isMod(interaction.member))return eph(interaction,`${E.hata} Mod/Admin yetkisi.`);
                const onay=id.startsWith("ko_evet_");const kapId=id.replace(/ko_(evet|hayir)_/,"");
                const veri=await db.get(`kaponay_${kapId}`);if(!veri)return eph(interaction,`${E.hata} Form geçersiz.`);
                await db.delete(`kaponay_${kapId}`);
                if(!onay){
                    await cvUpdate(interaction,cvBilgi(`${E.hata} **KAP FORMU REDDEDİLDİ**\n\n${E.cizgi} Oyuncu: **${veri.oyuncu}**\n${E.cizgi} Reddeden: ${interaction.user.username}\n${E.cizgi} Tarih: ${saatStr()}`));
                    await log(interaction.guild,"KAP",`REDDEDILDI — **${veri.oyuncu}** — ${interaction.user.username}`);
                    try{const tc=await client.users.fetch(veri.talepciId);await tc.send(`${E.hata} Kap formun reddedildi. Oyuncu: **${veri.oyuncu}**`).catch(()=>{});}catch{}
                    return;
                }
                const mbr=await uyeBul(interaction.guild,veri.oyuncu);
                if(!mbr)return eph(interaction,`${E.hata} Oyuncu bulunamadı: **${veri.oyuncu}**\nManuel ekle: \`.kapgiris @oyuncu ${veri.takim||""}\``);
                const cfg2=await getConfig(interaction.guild.id);
                const atananRol=await kapOyuncuEkle(interaction.guild,mbr,veri.takim,veri.ucret,veri.tip,cfg2);
                const isim=mbr.displayName||mbr.user.username;
                await cvUpdate(interaction,cvBilgi(`${E.tik} **KAP FORMU ONAYLANDI**\n\n${E.cizgi} Oyuncu: **${isim}**\n${E.cizgi} Takım: **${veri.takim||"—"}**\n${E.cizgi} Tip: **${veri.tip}**\n${E.cizgi} Onaylayan: ${interaction.user.username}\n${E.cizgi} Rol: **${atananRol?atananRol.name:"Bulunamadı"}**`));
                await log(interaction.guild,"TRANSFER",`**${isim}** → **${veri.takim}** (${veri.tip}) — Onaylayan: ${interaction.user.username}`);
                try{const tc=await client.users.fetch(veri.talepciId);await tc.send(`${E.tik} Kap formun onaylandı! → **${veri.takim}**`).catch(()=>{});}catch{}
                return;
            }
            if(id.startsWith("ko_duzenle_")){
                if(!await isMod(interaction.member))return eph(interaction,`${E.hata} Mod/Admin yetkisi.`);
                const kapId=id.replace("ko_duzenle_","");const veri=await db.get(`kaponay_${kapId}`);if(!veri)return eph(interaction,`${E.hata} Form geçersiz.`);
                const modal=new ModalBuilder().setCustomId(`kapduzenle_${kapId}`).setTitle("✏️ Kap Formunu Düzenle");
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("oyuncu").setLabel("Oyuncu").setStyle(TextInputStyle.Short).setValue(veri.oyuncu).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("takim").setLabel("Takım").setStyle(TextInputStyle.Short).setValue(veri.takim||"").setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ucret").setLabel("Ücret").setStyle(TextInputStyle.Short).setValue(veri.ucret||"0").setRequired(false))
                );
                return interaction.showModal(modal);
            }

            // Ticket butonları
            if(id.startsWith("tk_kapat_")){const tv=await db.get(`ticket_kanal_${interaction.channel.id}`);if(!tv)return eph(interaction,"Ticket bulunamadı.");if(!await isMod(interaction.member)&&interaction.user.id!==tv.userId)return eph(interaction,"Yetkisiz.");await eph(interaction,`${E.kilit} Kapatılıyor...`);return kapatTicket(interaction.channel,interaction.guild,interaction.user,tv);}
            if(id.startsWith("tk_sil_")){if(!await isAdmin(interaction.member))return eph(interaction,"Admin yetkisi.");await db.delete(`ticket_kanal_${interaction.channel.id}`);await eph(interaction,"🗑️ Siliniyor...");setTimeout(()=>interaction.channel.delete().catch(()=>{}),1500);return;}
            if(id.startsWith("tk_not_")){
                const modal=new ModalBuilder().setCustomId(`tknot_${interaction.channel.id}`).setTitle("📝 Ticket Notu");
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("not").setLabel("Not içeriği").setStyle(TextInputStyle.Paragraph).setRequired(true)));
                return interaction.showModal(modal);
            }
            if(id.startsWith("tk_devret_")){
                const modal=new ModalBuilder().setCustomId(`tkdevret_${interaction.channel.id}`).setTitle("↗️ Ticket Devret");
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("modid").setLabel("Moderatör Discord ID").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("123456789012345678")));
                return interaction.showModal(modal);
            }
            if(id.startsWith("tk_puan_")){
                const menu=new StringSelectMenuBuilder().setCustomId(`ticket_kalitesec_${interaction.channel.id}`).setPlaceholder("⭐ Puan seç...")
                    .addOptions([1,2,3,4,5].map(p=>new StringSelectMenuOptionBuilder().setLabel(`${"⭐".repeat(p)} ${p}/5`).setValue(String(p)).setDescription(["Çok kötü","Kötü","Orta","İyi","Mükemmel"][p-1])));
                return interaction.reply({components:[{type:1,components:[menu.toJSON()]}],flags:EPH});
            }
            if(id.startsWith("kelime_")){const k=Buffer.from(id.replace("kelime_",""),"base64").toString("utf8");return eph(interaction,`💡 Cevap: **${k}**`);}

            return eph(interaction,"Bu buton artık geçerli değil.");
        }

        // ── Modal Submit ──────────────────────────────────
        if(interaction.isModalSubmit()){
            const id=interaction.customId;

            // İtiraf
            if(id==="itiraf_modal"){
                const ic=interaction.fields.getTextInputValue("itiraf_ic");
                const cfg=await getConfig(interaction.guild.id);
                if(!cfg.kanalItiraf)return eph(interaction,`${E.hata} İtiraf kanalı ayarlanmamış!\n→ \`.setup kanal itiraf #kanal\``);
                const k=interaction.guild.channels.cache.get(cfg.kanalItiraf);if(!k)return eph(interaction,`${E.hata} Kanal bulunamadı.`);
                await cvSend(k,new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`💬 **ANONİM İTİRAF**\n\n${ic}\n\n${E.cizgi} *${tarihStr()}*`))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer()))
                );
                // Terminalde kim yazdı görünsün, Discord'da anonim kalsın
                console.log(`[İTİRAF] ${interaction.user.tag} (${interaction.user.id}): ${ic}`);
                await log(interaction.guild,"İTİRAF",`Anonim itiraf gönderildi.`);
                return eph(interaction,`${E.tik} İtirafın anonim olarak gönderildi!`);
            }

            // IG Yorum
            if(id.startsWith("igyorum_modal_")){
                const pid=id.replace("igyorum_modal_","");
                const post=await db.get(pid);if(!post)return eph(interaction,`${E.hata} Post bulunamadı.`);
                const yorum=interaction.fields.getTextInputValue("yorum");
                post.yorumlar=post.yorumlar||[];post.yorumlar.push({user:interaction.user.username,yorum,tarih:tarihStr()});
                await db.set(pid,post);
                return eph(interaction,`${E.tik} Yorum eklendi: *${yorum}*`);
            }

            // Kap modal
            if(id.startsWith("kapmodal_")){
                const tip=id.replace("kapmodal_","");
                const oyuncu=interaction.fields.getTextInputValue("oyuncu");
                const takim=interaction.fields.fields.get("takim")?.value||"";
                const ucret=interaction.fields.fields.get("ucret")?.value||"0";
                const sure=interaction.fields.fields.get("sure")?.value||"";
                const aciklama=interaction.fields.fields.get("aciklama")?.value||"";
                const kapId=`${interaction.guild.id}_${Date.now()}`;
                const rolBulundu=takim?enYakinRol(interaction.guild,takim):null;
                await db.set(`kaponay_${kapId}`,{tip,oyuncu,takim,ucret,sure,aciklama,talepciId:interaction.user.id,guildId:interaction.guild.id,tarih:saatStr()});
                const cfg2=await getConfig(interaction.guild.id);
                const kapKanal=cfg2.kanalKap&&interaction.guild.channels.cache.get(cfg2.kanalKap);
                if(kapKanal){await cvSend(kapKanal,cvKapOnay(kapId,tip,oyuncu,takim,ucret||sure,aciklama,interaction.user.id,rolBulundu));await eph(interaction,`${E.tik} Form gönderildi! ${kapKanal} — Onay bekleniyor.`);}
                else await eph(interaction,`${E.uyari} Kap kanalı ayarlanmamış!\n→ \`.setup kanal kap #kanal\``);
                await log(interaction.guild,"KAP",`**${interaction.user.username}** form: ${tip} — **${oyuncu}** → **${takim||"—"}**`);
                return;
            }
            if(id.startsWith("kapduzenle_")){
                const kapId=id.replace("kapduzenle_","");const veri=await db.get(`kaponay_${kapId}`);if(!veri)return eph(interaction,"Form geçersiz.");
                veri.oyuncu=interaction.fields.getTextInputValue("oyuncu");
                veri.takim=interaction.fields.fields.get("takim")?.value||veri.takim;
                veri.ucret=interaction.fields.fields.get("ucret")?.value||veri.ucret;
                await db.set(`kaponay_${kapId}`,veri);
                const r=veri.takim?enYakinRol(interaction.guild,veri.takim):null;
                return cvUpdate(interaction,cvKapOnay(kapId,veri.tip,veri.oyuncu,veri.takim,veri.ucret,veri.sure,veri.talepciId,r));
            }

            // Ticket notlar
            if(id.startsWith("tknot_")){
                const kId=id.replace("tknot_","");const not=interaction.fields.getTextInputValue("not");
                const tv=await db.get(`ticket_kanal_${kId}`);if(tv){tv.notlar=tv.notlar||[];tv.notlar.push({yazar:interaction.user.tag,not,tarih:tarihStr()});await db.set(`ticket_kanal_${kId}`,tv);}
                await interaction.channel.send(`📝 **${interaction.user.username}**: ${not}`).catch(()=>{});
                return eph(interaction,`${E.tik} Not eklendi.`);
            }
            // Ticket devret
            if(id.startsWith("tkdevret_")){
                const kId=id.replace("tkdevret_","");const modId=interaction.fields.getTextInputValue("modid").trim();
                const tv=await db.get(`ticket_kanal_${kId}`);if(!tv)return eph(interaction,"Ticket bulunamadı.");
                const h=await interaction.guild.members.fetch(modId).catch(()=>null);if(!h)return eph(interaction,`${E.hata} Üye bulunamadı.`);
                tv.atananMod=h.id;await db.set(`ticket_kanal_${kId}`,tv);
                await interaction.channel.permissionOverwrites.edit(h.id,{ViewChannel:true,SendMessages:true}).catch(()=>{});
                await interaction.channel.send(`↗️ Ticket **${h.displayName||h.user.username}**'e devredildi.`);
                return eph(interaction,`${E.tik} Devredildi.`);
            }
        }
    }catch(err){
        console.error("[Etkileşim Hatası]",err);
        try{await interaction.reply({content:`${E.uyari} Bir hata oluştu, tekrar dene.`,flags:EPH});}catch{}
    }
});

// ── Hata Yakalama ─────────────────────────────────────────
client.on("error",err=>console.error("[Discord]",err));
process.on("unhandledRejection",err=>console.error("[Promise]",err));
process.on("uncaughtException", err=>console.error("[Kritik]",err));

// ── Hazır ─────────────────────────────────────────────────
client.once(Events.ClientReady,async c=>{
    console.log(`✅ ${c.user.tag} — ${c.guilds.cache.size} sunucu`);
    console.log(`📁 Veritabanı: ${DB_FILE}`);
    for(const[,g]of c.guilds.cache)dropBaslat(g);
    client.on(Events.GuildCreate,g=>dropBaslat(g));
    // Bot durumu
    c.user.setActivity("ZemaDev Was Here",{type:0});
    setInterval(()=>c.user.setActivity("ZemaDev Was Here",{type:0}),30000);
});

const TOKEN=process.env.TOKEN;
if(!TOKEN){console.error("❌ TOKEN bulunamadı!\nTermux: export TOKEN='token_buraya'");process.exit(1);}
client.login(TOKEN);
