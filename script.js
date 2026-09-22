import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ─── Supabase config ───────────────────────────────────────────────────────
   Publishable key jest publiczny i ma tu być — tak samo jak wcześniej klucz
   Firebase. Chroni nas RLS, nie schowanie klucza.
   Schemat i dane: migration/schema.sql + migration/seed.sql                  */
const SUPABASE_URL = "https://qmqbjtbairhtsmsbmrai.supabase.co";
const SUPABASE_KEY = "sb_publishable_0BkzimGiTmwPKQELgb8TWQ_Ye48J2Uo";

/* createClient rzuca wyjątkiem na niewypełnionym URL-u, co zabiłoby cały moduł
   i strona nie pokazałaby nawet komunikatu — dlatego dopiero po sprawdzeniu. */
const SKONFIGUROWANE = SUPABASE_URL.startsWith("https://");
const supabase = SKONFIGUROWANE ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/* ─── DOM refs ─── */
const modalEl      = document.getElementById("modal");
const modalOverlay = document.getElementById("modalOverlay");
const navButtons   = document.getElementById("navButtons");
const btnGry       = document.getElementById("btnGry");
const btnCospy     = document.getElementById("btnCospy");
const logoutBtn    = document.getElementById("logoutBtn");
const zakladkaGry  = document.getElementById("zakladkaGry");
const zakladkaCospy= document.getElementById("zakladkaCospy");

/* Gdzie ląduje lista której osoby. */
const LISTY_ITEMS = { BK: "itemsBK", WW: "itemsWW" };
const LISTY_COSPY = { BK: "itemsBKCosplay", WW: "itemsWWCosplay" };

/* ─── Tab switching ─── */
function zmienzakladke(zakladka) {
    if (zakladka === "gry") {
        zakladkaGry.style.display  = "flex";
        zakladkaCospy.style.display = "none";
        btnGry.classList.add("active");
        btnCospy.classList.remove("active");
    } else {
        zakladkaGry.style.display  = "none";
        zakladkaCospy.style.display = "flex";
        btnCospy.classList.add("active");
        btnGry.classList.remove("active");
    }
}

btnGry.addEventListener("click",   () => zmienzakladke("gry"));
btnCospy.addEventListener("click", () => zmienzakladke("cospy"));

/* ─── Ikona ze sprite'a w index.html ────────────────────────────────────────
   SVG wymaga createElementNS — zwykłe createElement zrobiłoby element HTML
   o tej nazwie, który by się nie wyrenderował.                             */
const SVG_NS = "http://www.w3.org/2000/svg";

function ikona(id) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "ico");
    svg.setAttribute("aria-hidden", "true");

    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", `#${id}`);

    svg.appendChild(use);
    return svg;
}

/* ─── Render: jeden wiersz listy ───────────────────────────────────────────
   Nazwy wpisują ludzie, więc lecą przez textContent, nie innerHTML.        */
function zbudujWiersz(nazwa, opis, onDelete) {
    const el = document.createElement("div");
    el.classList.add("item");

    const txt = document.createElement("p");

    const strong = document.createElement("strong");
    strong.textContent = nazwa;
    txt.appendChild(strong);

    if (opis) {
        const em = document.createElement("em");
        em.textContent = opis;
        txt.appendChild(em);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", `Usuń ${nazwa}`);
    btn.appendChild(ikona("i-x"));
    btn.onclick = onDelete;
    txt.appendChild(btn);

    el.appendChild(txt);
    return el;
}

/* ─── Items: wczytaj i wyrenderuj ─── */
async function odswiezListe(osoba) {
    const container = document.getElementById(LISTY_ITEMS[osoba]);

    const { data, error } = await supabase
        .from("items")
        .select("id, nazwa, kategoria")
        .eq("osoba", osoba)
        .order("created_at", { ascending: true });

    if (error) { console.error("Błąd wczytywania listy:", error); return; }

    container.innerHTML = "";
    for (const { id, nazwa, kategoria } of data) {
        container.appendChild(
            zbudujWiersz(nazwa, kategoria, () => usunItem(osoba, id))
        );
    }
}

/* ─── Items: add ─── */
async function dodajDoBazy(osoba, inputId, radioName) {
    const input   = document.getElementById(inputId);
    const coDodac = input.value.trim();
    if (!coDodac) { alert("A może coś wpiszesz?"); return; }

    const checkedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
    if (!checkedRadio) { alert("A te przyciski po coś tu są"); return; }

    const { error } = await supabase
        .from("items")
        .insert({ osoba, nazwa: coDodac, kategoria: checkedRadio.value });

    if (error) {
        console.error(error);
        alert("O chuj, nie działa");
        return;
    }

    input.value = "";
    odswiezListe(osoba);
}

/* ─── Items: delete ─── */
async function usunItem(osoba, id) {
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) { console.error(error); alert("Nie udało się usunąć"); return; }
    odswiezListe(osoba);
}

/* ─── Cosplay: wczytaj i wyrenderuj ─── */
async function odswiezCosplay(osoba) {
    const container = document.getElementById(LISTY_COSPY[osoba]);

    const { data, error } = await supabase
        .from("cosplays")
        .select("id, nazwa, typ, od_kogo")
        .eq("osoba", osoba)
        .order("created_at", { ascending: true });

    if (error) { console.error("Błąd wczytywania cosplayów:", error); return; }

    container.innerHTML = "";
    for (const { id, nazwa, typ, od_kogo } of data) {
        const opis = typ === "prośba" ? `(Prośba od ${od_kogo})` : "";
        container.appendChild(
            zbudujWiersz(nazwa, opis, () => usunCosplay(osoba, id))
        );
    }
}

/* ─── Cosplay: add ─── */
async function dodajCosplay() {
    const input   = document.getElementById("inputCosplay");
    const coDodac = input.value.trim();
    if (!coDodac) { alert("A nazwa cosplayu gdzie?"); return; }

    const dlaKogoRadio = document.querySelector('input[name="ktoCosplay"]:checked').value;
    const ja = localStorage.getItem("wybranaOsoba");

    /* Prośba ląduje na liście drugiej osoby, własne u siebie. */
    let docelowaOsoba = ja;
    let typWpisu = "własne";
    if (dlaKogoRadio === "prosba") {
        docelowaOsoba = (ja === "BK") ? "WW" : "BK";
        typWpisu = "prośba";
    }

    const { error } = await supabase
        .from("cosplays")
        .insert({ osoba: docelowaOsoba, nazwa: coDodac, typ: typWpisu, od_kogo: ja });

    if (error) {
        console.error("Błąd zapisu cosplayu:", error);
        alert("O chuj, cosplay nie przeszedł!");
        return;
    }

    input.value = "";
    odswiezCosplay(docelowaOsoba);
}

/* ─── Cosplay: delete ─── */
async function usunCosplay(osoba, id) {
    const { error } = await supabase.from("cosplays").delete().eq("id", id);
    if (error) { console.error(error); alert("Nie udało się usunąć"); return; }
    odswiezCosplay(osoba);
}

/* ─── Realtime ──────────────────────────────────────────────────────────────
   Zamiennik firestore'owego onSnapshot: jak druga osoba coś doda albo usunie,
   lista odświeża się sama. Wymaga tabel w publikacji supabase_realtime
   (robi to schema.sql).                                                     */
function wlaczRealtime() {
    supabase
        .channel("checklist")
        .on("postgres_changes", { event: "*", schema: "public", table: "items" },
            () => { odswiezListe("BK"); odswiezListe("WW"); })
        .on("postgres_changes", { event: "*", schema: "public", table: "cosplays" },
            () => { odswiezCosplay("BK"); odswiezCosplay("WW"); })
        .subscribe();
}

/* ─── Show app ─── */
function showApp() {
    modalEl.classList.remove("visible");
    modalOverlay.classList.remove("visible");
    navButtons.style.display = "flex";

    odswiezListe("BK");
    odswiezListe("WW");
    odswiezCosplay("BK");
    odswiezCosplay("WW");
    wlaczRealtime();
    zmienzakladke("gry");
}

/* ─── Login ─── */
function handleLogin() {
    const wpisaneHaslo = document.getElementById("hasloInput").value.trim();
    let wybranaOsoba = null;
    for (const r of document.getElementsByName("osoba")) if (r.checked) wybranaOsoba = r.value;

    if (wpisaneHaslo !== "BMW") { alert("Naucz sie pisać"); return; }
    if (!wybranaOsoba)           { alert("A kto wybiera?"); return; }

    localStorage.setItem("wybranaOsoba", wybranaOsoba);
    localStorage.setItem("hasloOK", "true");
    document.getElementById("hasloInput").value = "";
    showApp();
}

/* ─── Logout ─── */
function handleLogout() {
    localStorage.removeItem("wybranaOsoba");
    localStorage.removeItem("hasloOK");
    location.reload();
}

/* ─── Brak konfiguracji ─────────────────────────────────────────────────────
   Bez kluczy nic nie zadziała, więc mówimy to wprost i nie podłączamy
   przycisków — każdy klik i tak poleciałby na nieistniejącym kliencie.      */
function pokazBrakKonfiguracji() {
    modalEl.classList.add("visible");
    modalOverlay.classList.add("visible");

    const info = document.createElement("p");
    info.className = "modal-subtitle";
    info.textContent = "Brak konfiguracji Supabase — wklej PROJECT URL i ANON KEY " +
                       "na górze script.js (instrukcja: migration/README.md).";
    modalEl.appendChild(info);

    document.getElementById("modalBtn").disabled = true;
}

/* ─── Init ─── */
document.addEventListener("DOMContentLoaded", () => {
    if (!SKONFIGUROWANE) { pokazBrakKonfiguracji(); return; }

    const user    = localStorage.getItem("wybranaOsoba");
    const hasloOK = localStorage.getItem("hasloOK");

    if (user && hasloOK === "true") {
        showApp();
    } else {
        modalEl.classList.add("visible");
        modalOverlay.classList.add("visible");
    }

    document.getElementById("modalBtn").addEventListener("click", handleLogin);
    document.getElementById("hasloInput").addEventListener("keydown", e => {
        if (e.key === "Enter") handleLogin();
    });
    logoutBtn.addEventListener("click", handleLogout);
    document.getElementById("addCosplayBtn").addEventListener("click", dodajCosplay);

    document.getElementById("addWWBtn").addEventListener("click", () => {
        const docelowaOsoba = localStorage.getItem("wybranaOsoba");
        if (!docelowaOsoba) { alert("Nuh uh, coś poszło nie tak."); return; }
        dodajDoBazy(docelowaOsoba, "inputWW", "wyborWW");
    });
});
