import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://qmqbjtbairhtsmsbmrai.supabase.co";
const SUPABASE_KEY = "sb_publishable_0BkzimGiTmwPKQELgb8TWQ_Ye48J2Uo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const KATEGORIE = {
    gra:     { label: "Gra",     ikona: "i-gamepad", tabela: "items",    db: "Gra",
               placeholder: "Tytuł gry...",              przycisk: "Dodaj grę" },
    film:    { label: "Film",    ikona: "i-film",    tabela: "items",    db: "Do obejrzenia",
               placeholder: "Tytuł filmu albo serialu...", przycisk: "Dodaj film" },
    cosplay: { label: "Cosplay", ikona: "i-shirt",   tabela: "cosplays",
               placeholder: "Jaka postać?",               przycisk: "Dodaj cosplay" },
    todo:    { label: "To-Do",   ikona: "i-todo",    tabela: "items",    db: "To-Do",
               placeholder: "Co trzeba zrobić?",          przycisk: "Dodaj zadanie" },
};

const Z_BAZY = { "Gra": "gra", "Do obejrzenia": "film", "Cosplay": "cosplay", "To-Do": "todo" };

const OSOBY = {
    BK: { imie: "Bartek",   dopelniacz: "Bartka",   ikona: "i-gamepad" },
    WW: { imie: "Wiktoria", dopelniacz: "Wiktorii", ikona: "i-flower"  },
};
const drugaOsoba = (osoba) => (osoba === "BK" ? "WW" : "BK");

let wpisy = [];
let aktywnyFiltr = localStorage.getItem("filtr") || "wszystko";
let nowyId = null;
let nrWczytania = 0;

if (aktywnyFiltr !== "wszystko" && !KATEGORIE[aktywnyFiltr]) aktywnyFiltr = "wszystko";

const modalEl      = document.getElementById("modal");
const modalOverlay = document.getElementById("modalOverlay");
const navButtons   = document.getElementById("navButtons");
const logoutBtn    = document.getElementById("logoutBtn");
const addForm      = document.getElementById("addForm");
const addBtn       = document.getElementById("addBtn");
const nazwaInput   = document.getElementById("nazwaInput");
const dlaKogoEl    = document.getElementById("dlaKogo");

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

function el(tag, klasa, tekst) {
    const e = document.createElement(tag);
    if (klasa) e.className = klasa;
    if (tekst !== undefined) e.textContent = tekst;
    return e;
}

function zItems(r) {
    return { id: r.id, tabela: "items", osoba: r.osoba, nazwa: r.nazwa,
             kat: Z_BAZY[r.kategoria], prosbaOd: null, created: r.created_at };
}

function zCosplays(r) {
    return { id: r.id, tabela: "cosplays", osoba: r.osoba, nazwa: r.nazwa,
             kat: "cosplay", prosbaOd: r.typ === "prośba" ? r.od_kogo : null,
             created: r.created_at };
}

async function wczytaj() {
    const nr = ++nrWczytania;

    const [items, cosplays] = await Promise.all([
        supabase.from("items").select("id, osoba, nazwa, kategoria, created_at"),
        supabase.from("cosplays").select("id, osoba, nazwa, typ, od_kogo, created_at"),
    ]);

    if (nr !== nrWczytania) return;

    if (items.error || cosplays.error) {
        console.error("Błąd wczytywania:", items.error || cosplays.error);
        for (const osoba of Object.keys(OSOBY)) {
            document.getElementById(`lista${osoba}`)
                .replaceChildren(el("p", "blad", "Nie udało się wczytać listy :("));
        }
        return;
    }

    wpisy = [...items.data.map(zItems), ...cosplays.data.map(zCosplays)]
        .filter(w => w.kat)
        .sort((a, b) => new Date(a.created) - new Date(b.created));

    render();
}

function zbudujWiersz(w) {
    const kat = KATEGORIE[w.kat];

    const wiersz = el("div", "item");
    wiersz.dataset.kat = w.kat;
    if (w.id === nowyId) wiersz.classList.add("nowy");

    const ico = el("span", "item-ico");
    ico.title = kat.label;
    ico.appendChild(ikona(kat.ikona));

    const body = el("div", "item-body");
    body.appendChild(el("strong", "item-nazwa", w.nazwa));

    const meta = el("div", "item-meta");
    if (aktywnyFiltr === "wszystko") meta.appendChild(el("span", "tag", kat.label));
    if (w.prosbaOd) {
        meta.appendChild(el("span", "tag tag-prosba", `prośba od ${OSOBY[w.prosbaOd].dopelniacz}`));
    }
    body.appendChild(meta);

    const del = el("button", "item-del");
    del.type = "button";
    del.setAttribute("aria-label", `Usuń ${w.nazwa}`);
    del.appendChild(ikona("i-x"));
    del.onclick = () => usun(w);

    wiersz.append(ico, body, del);
    return wiersz;
}

function render() {
    const liczniki = { wszystko: wpisy.length, gra: 0, film: 0, cosplay: 0, todo: 0 };
    for (const w of wpisy) liczniki[w.kat]++;

    document.querySelectorAll("[data-licznik]").forEach(e => {
        e.textContent = liczniki[e.dataset.licznik];
    });

    document.querySelectorAll(".filtr").forEach(b => {
        const on = b.dataset.filtr === aktywnyFiltr;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
    });

    for (const osoba of Object.keys(OSOBY)) {
        const lista = wpisy.filter(w =>
            w.osoba === osoba && (aktywnyFiltr === "wszystko" || w.kat === aktywnyFiltr));

        document.getElementById(`lista${osoba}`).replaceChildren(...lista.map(zbudujWiersz));
        document.getElementById(`licznik${osoba}`).textContent = lista.length;
    }

    nowyId = null;
}

function ustawFiltr(filtr) {
    aktywnyFiltr = filtr;
    localStorage.setItem("filtr", filtr);
    render();
}

document.querySelectorAll(".filtr").forEach(b => {
    b.addEventListener("click", () => ustawFiltr(b.dataset.filtr));
});

function wybranaKategoria() {
    return document.querySelector('input[name="kategoria"]:checked').value;
}

function odswiezFormularz() {
    const kat = KATEGORIE[wybranaKategoria()];
    nazwaInput.placeholder = kat.placeholder;
    document.getElementById("addBtnLabel").textContent = kat.przycisk;
    dlaKogoEl.hidden = kat.tabela !== "cosplays";
}

document.querySelectorAll('input[name="kategoria"]').forEach(r => {
    r.addEventListener("change", () => {
        localStorage.setItem("kategoria", r.value);
        odswiezFormularz();
        nazwaInput.focus();
    });
});

async function dodaj(e) {
    e.preventDefault();

    const nazwa = nazwaInput.value.trim();
    if (!nazwa) { alert("A może coś wpiszesz?"); nazwaInput.focus(); return; }

    const ja  = localStorage.getItem("wybranaOsoba");
    if (!OSOBY[ja]) { alert("Nuh uh, coś poszło nie tak."); return; }

    const kat = wybranaKategoria();
    let zapytanie;

    if (kat === "cosplay") {
        const prosba = document.querySelector('input[name="dlaKogo"]:checked').value === "prosba";
        zapytanie = supabase.from("cosplays").insert({
            osoba: prosba ? drugaOsoba(ja) : ja,
            nazwa,
            typ: prosba ? "prośba" : "własne",
            od_kogo: ja,
        });
    } else {
        zapytanie = supabase.from("items").insert({ osoba: ja, nazwa, kategoria: KATEGORIE[kat].db });
    }

    addBtn.disabled = true;
    const { data, error } = await zapytanie.select("id").single();
    addBtn.disabled = false;

    if (error) {
        console.error("Błąd zapisu:", error);
        alert(kat === "cosplay" ? "O chuj, cosplay nie przeszedł!" : "O chuj, nie działa");
        return;
    }

    nazwaInput.value = "";
    nazwaInput.focus();
    nowyId = data.id;

    if (aktywnyFiltr !== "wszystko" && aktywnyFiltr !== kat) {
        aktywnyFiltr = kat;
        localStorage.setItem("filtr", kat);
    }

    await wczytaj();
}

addForm.addEventListener("submit", dodaj);

async function usun(w) {
    const { error } = await supabase.from(w.tabela).delete().eq("id", w.id);
    if (error) { console.error(error); alert("Nie udało się usunąć"); return; }

    wpisy = wpisy.filter(x => x !== w);
    render();
}

function wlaczRealtime() {
    supabase
        .channel("checklist")
        .on("postgres_changes", { event: "*", schema: "public", table: "items" },    wczytaj)
        .on("postgres_changes", { event: "*", schema: "public", table: "cosplays" }, wczytaj)
        .subscribe();
}

function showApp() {
    const ja = localStorage.getItem("wybranaOsoba");
    const druga = drugaOsoba(ja);

    modalEl.classList.remove("visible");
    modalOverlay.classList.remove("visible");
    navButtons.hidden = false;

    document.getElementById("userChipName").textContent = OSOBY[ja].imie;
    document.getElementById("userChipIco").setAttribute("href", `#${OSOBY[ja].ikona}`);
    document.getElementById("prosbaLabel").textContent = `Prośba do ${OSOBY[druga].dopelniacz}`;

    wczytaj();
    wlaczRealtime();
}

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

function handleLogout() {
    localStorage.removeItem("wybranaOsoba");
    localStorage.removeItem("hasloOK");
    location.reload();
}

document.addEventListener("DOMContentLoaded", () => {
    const zapamietana = localStorage.getItem("kategoria");
    const radio = KATEGORIE[zapamietana] &&
        document.querySelector(`input[name="kategoria"][value="${zapamietana}"]`);
    if (radio) radio.checked = true;
    odswiezFormularz();

    const user    = localStorage.getItem("wybranaOsoba");
    const hasloOK = localStorage.getItem("hasloOK");

    if (OSOBY[user] && hasloOK === "true") {
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
});