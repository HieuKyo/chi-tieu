"use strict";
// Sổ Chi Tiêu — toàn bộ giao diện và dữ liệu. Dữ liệu chỉ nằm trong IndexedDB của máy, không gửi đi đâu.

const P = window.Parse;
const $ = id => document.getElementById(id);
const VERSION = "1.1";

// ---------- Tiện ích DOM ----------
function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === "") continue;
    if (Array.isArray(k)) add(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false || k === "value") continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  add(el, kids);
  if (props && props.value != null) el.value = props.value;
  return el;
}
// Thay toàn bộ con của el, bỏ qua null/false (replaceChildren sẽ in chữ "null").
function fill(el, ...kids) { el.replaceChildren(); add(el, kids); }
function svgEl(tag, attrs, ...kids) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  add(el, kids);
  return el;
}

// ---------- Số tiền, ngày ----------
const NF = new Intl.NumberFormat("vi-VN");
const money = n => NF.format(Math.round(n || 0)) + "đ";
function short(n) {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  const f = (x, u) => s + (Math.round(x * 10) / 10).toString().replace(".", ",") + u;
  if (a >= 1e9) return f(a / 1e9, " tỷ");
  if (a >= 1e6) return f(a / 1e6, "tr");
  if (a >= 1e3) return s + Math.round(a / 1e3) + "k";
  return s + Math.round(a);
}
const sign = t => t === "chi" ? "−" : t === "thu" ? "+" : "";
const today = () => P.iso(new Date());
const mkOf = iso => iso.slice(0, 7);
function dim(mk) { const [y, m] = mk.split("-").map(Number); return new Date(y, m, 0).getDate(); }
function shiftMonth(mk, n) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function addMonthsDay(iso, n, day) {
  const mk = shiftMonth(iso.slice(0, 7), n);
  return mk + "-" + String(Math.min(day, dim(mk))).padStart(2, "0");
}
function dateOf(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
function daysBetween(a, b) { return Math.round((dateOf(b) - dateOf(a)) / 864e5); }
const WD = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const WD_S = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
function dmy(iso) { const d = dateOf(iso); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); }
function dayLabel(iso) {
  const t = today();
  if (iso === t) return "Hôm nay";
  if (iso === P.addDays(t, -1)) return "Hôm qua";
  const d = dateOf(iso);
  return WD[d.getDay()] + ", " + d.getDate() + "/" + (d.getMonth() + 1) +
    (d.getFullYear() !== new Date().getFullYear() ? "/" + d.getFullYear() : "");
}
function monthLabel(mk) { const [y, m] = mk.split("-"); return "Tháng " + Number(m) + "/" + y; }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const tint = col => `color-mix(in srgb, ${col} 20%, transparent)`;

// ---------- Lưu trữ ----------
const Store = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("so-chi-tieu", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("kv"); r.result.createObjectStore("photos"); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  req(store, mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, mode);
      const r = fn(tx.objectStore(store));
      tx.oncomplete = () => res(r && r.result);
      tx.onerror = () => rej(tx.error);
    });
  },
  get(s, k) { return this.req(s, "readonly", st => st.get(k)); },
  put(s, k, v) { return this.req(s, "readwrite", st => st.put(v, k)); },
  del(s, k) { return this.req(s, "readwrite", st => st.delete(k)); },
  keys(s) { return this.req(s, "readonly", st => st.getAllKeys()); },
  clear(s) { return this.req(s, "readwrite", st => st.clear()); }
};

// [id, tên, icon, loại, màu, hũ, từ khoá]
const DEFAULT_CATS = [
  ["an", "Ăn uống", "🍜", "chi", "#e8743b", "nec", ["ăn", "cơm", "phở", "bún", "bánh mì", "ăn sáng", "ăn trưa", "ăn tối", "lẩu", "nướng", "nhà hàng", "trà sữa", "đồ ăn", "grabfood", "shopeefood", "bánh", "chè", "kem", "nhậu", "bia", "xôi", "mì"]],
  ["cf", "Cà phê", "☕", "chi", "#9a6a43", "play", ["cafe", "cà phê", "cf", "coffee", "highlands", "highland", "starbucks", "phúc long", "katinat", "trà"]],
  ["cho", "Đi chợ", "🛒", "chi", "#3f9b5a", "nec", ["đi chợ", "chợ", "siêu thị", "rau", "thịt", "cá", "trứng", "gạo", "bách hoá xanh", "bhx", "winmart", "coopmart", "lotte mart", "aeon", "trái cây"]],
  ["xe", "Đi lại", "🛵", "chi", "#2f7fc1", "nec", ["xăng", "đổ xăng", "grab", "xanh sm", "taxi", "gửi xe", "vé xe", "sửa xe", "rửa xe", "thay nhớt", "xe buýt", "máy bay", "vé tàu", "be bike", "gojek"]],
  ["nha", "Nhà ở", "🏠", "chi", "#7a5cc2", "nec", ["tiền nhà", "thuê nhà", "tiền phòng", "phòng trọ", "sửa nhà", "nội thất"]],
  ["dien", "Điện, nước, mạng", "💡", "chi", "#d4a017", "nec", ["điện", "nước", "tiền điện", "tiền nước", "internet", "wifi", "mạng", "gas", "điện thoại", "nạp thẻ", "4g", "5g", "cước"]],
  ["mua", "Mua sắm", "👕", "chi", "#d0457b", "play", ["quần áo", "áo", "quần", "giày", "dép", "túi", "shopee", "lazada", "tiki", "tiktok shop", "mỹ phẩm", "son", "đồ gia dụng"]],
  ["suckhoe", "Sức khoẻ", "💊", "chi", "#1aa39a", "nec", ["thuốc", "khám", "bệnh viện", "phòng khám", "nha khoa", "răng", "bảo hiểm", "gym", "vitamin"]],
  ["giaitri", "Giải trí", "🎬", "chi", "#e0563f", "play", ["phim", "cgv", "game", "karaoke", "du lịch", "netflix", "spotify", "youtube", "icloud", "concert", "đi chơi"]],
  ["hieuhi", "Hiếu hỉ", "🎁", "chi", "#c2410c", "give", ["đám cưới", "mừng cưới", "đám ma", "viếng", "đám hiếu", "đầy tháng", "thôi nôi", "tân gia", "sinh nhật", "quà", "phong bì"]],
  ["hoc", "Học tập", "📚", "chi", "#4a6fd1", "edu", ["học", "học phí", "sách", "khoá học", "udemy", "tiếng anh", "ielts"]],
  ["con", "Con cái", "🧸", "chi", "#ee8f2b", "nec", ["cho con", "sữa", "bỉm", "tã", "đồ chơi", "nhà trẻ", "mầm non"]],
  ["giadinh", "Gia đình", "👪", "chi", "#8a6d3b", "give", ["bố mẹ", "gửi mẹ", "gửi bố", "cho mẹ", "cho bố", "ông bà", "biếu", "gia đình"]],
  ["tragop", "Trả góp, nợ", "💳", "chi", "#6b7280", "nec", ["trả góp", "trả nợ", "thẻ tín dụng", "lãi vay"]],
  ["khac", "Khác", "📦", "chi", "#7c8a86", "nec", []],
  ["luong", "Lương", "💼", "thu", "#1d8a4b", null, ["lương", "trả lương", "salary"]],
  ["thuong", "Thưởng", "🏆", "thu", "#2f9e6a", null, ["thưởng", "bonus"]],
  ["kinhdoanh", "Kinh doanh", "🏪", "thu", "#0e7468", null, ["bán hàng", "kinh doanh", "doanh thu", "freelance", "làm thêm"]],
  ["lai", "Lãi, đầu tư", "📈", "thu", "#3b82a0", null, ["lãi", "tiền lãi", "cổ tức", "đầu tư", "chứng khoán"]],
  ["duoccho", "Được cho, tặng", "🎀", "thu", "#b45fa8", null, ["được cho", "được tặng", "lì xì", "mừng tuổi"]],
  ["hoantien", "Hoàn tiền", "↩️", "thu", "#5a8f7b", null, ["hoàn tiền", "refund", "cashback"]],
  ["thukhac", "Thu khác", "💰", "thu", "#6b8e23", null, []]
];
const JARS = [
  ["nec", "Thiết yếu", "🏠", "#2f7fc1"], ["ffa", "Tự do tài chính", "💹", "#1d8a4b"],
  ["edu", "Giáo dục", "📚", "#4a6fd1"], ["ltss", "Tiết kiệm dài hạn", "🏦", "#d4a017"],
  ["play", "Hưởng thụ", "🎉", "#e0563f"], ["give", "Cho đi", "❤️", "#c2410c"]
];
const WALLET_KINDS = [["cash", "Tiền mặt"], ["bank", "Ngân hàng / thẻ"], ["momo", "MoMo"], ["zalopay", "ZaloPay"], ["other", "Khác"]];
const EVENTS = ["Đám cưới", "Đầy tháng, thôi nôi", "Tân gia", "Sinh nhật", "Đám hiếu", "Thăm ốm", "Lễ, Tết", "Khác"];

function freshState() {
  return {
    v: 1, tx: [],
    cats: DEFAULT_CATS.map(([id, name, icon, type, color, jar, keywords]) => ({id, name, icon, type, color, jar, keywords})),
    wallets: [
      {id: "w_cash", name: "Tiền mặt", icon: "💵", kind: "cash", init: 0},
      {id: "w_bank", name: "Ngân hàng", icon: "🏦", kind: "bank", init: 0},
      {id: "w_momo", name: "MoMo", icon: "📱", kind: "momo", init: 0}
    ],
    recurring: [], debts: [], gifts: [],
    goals: [{id: uid(), name: "Quỹ Tết", icon: "🧧", target: 10000000, deadline: "2027-02-06", moves: []}],
    split: {people: [{name: "Tôi", paid: 0}, {name: "", paid: 0}], cat: "an"},
    shop: {items: [], seen: {}},
    tools: {},
    settings: {
      theme: "auto", pinHash: null, pinSalt: null, lockAfter: 60,
      budget: {total: 0, cats: {}},
      jars: {nec: 55, ffa: 10, edu: 10, ltss: 10, play: 10, give: 5},
      defaultWallet: "w_cash", lastBackup: null
    }
  };
}
function migrate(s) {
  const f = freshState();
  if (!s || !Array.isArray(s.tx)) return f;
  for (const k of Object.keys(f)) if (s[k] === undefined) s[k] = f[k];
  for (const k of Object.keys(f.settings)) if (s.settings[k] === undefined) s.settings[k] = f.settings[k];
  return s;
}

let S = null;
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 250); }
async function flush() {
  clearTimeout(saveTimer);
  const json = JSON.stringify(S);
  try { if (Store.db) await Store.put("kv", "state", json); }
  catch (e) { toast("Không lưu được dữ liệu: " + e.message); }
  try { if (json.length < 2e6) localStorage.setItem("so-chi-tieu", json); } catch (e) { /* bỏ qua */ }
}
async function putPhoto(id, blob) { if (Store.db) await Store.put("photos", id, blob); }
async function getPhoto(id) { return Store.db ? Store.get("photos", id) : null; }
async function delPhoto(id) { if (Store.db) await Store.del("photos", id); }

// ---------- Tra cứu, tổng hợp ----------
const OTHER_CAT = {id: "khac", name: "Khác", icon: "📦", color: "#7c8a86", type: "chi"};
const cat = id => S.cats.find(c => c.id === id) || OTHER_CAT;
const wal = id => S.wallets.find(w => w.id === id) || {id, name: "(ví đã xoá)", icon: "👛"};
const catsOf = type => S.cats.filter(c => c.type === type && !c.hidden);
const txIn = mk => S.tx.filter(t => t.date.startsWith(mk));
function sum(list, type) { let s = 0; for (const t of list) if (t.type === type) s += t.amount; return s; }
function byCat(list, type) {
  const m = {};
  for (const t of list) if (t.type === type) m[t.cat] = (m[t.cat] || 0) + t.amount;
  return m;
}
function balances() {
  const b = {};
  for (const w of S.wallets) b[w.id] = Number(w.init) || 0;
  for (const t of S.tx) {
    if (!(t.wallet in b)) b[t.wallet] = 0;
    if (t.type === "chi") b[t.wallet] -= t.amount;
    else if (t.type === "thu") b[t.wallet] += t.amount;
    else if (t.type === "chuyen") { b[t.wallet] -= t.amount; if (t.to in b) b[t.to] += t.amount; }
  }
  return b;
}
const sortTx = list => list.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));
const debtLeft = d => d.amount - d.pays.reduce((a, p) => a + p.amount, 0);

// ---------- Khung chung: tab, bảng trượt, thông báo ----------
const ui = {searchOpen: false, search: "", months: 1, statMonth: null, statType: "chi", bookTab: "vi",
            catType: "chi", showDone: false, recurNote: ""};
let tab = "today";
const TITLES = {today: "Hôm nay", stats: "Thống kê", book: "Sổ", tools: "Tiện ích", settings: "Cài đặt"};

function setTab(t) {
  tab = t;
  document.querySelectorAll(".tab[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === (t === "settings" ? "tools" : t)));
  for (const k of Object.keys(TITLES)) $("v-" + k).hidden = k !== t;
  $("title").textContent = TITLES[t];
  render();
  window.scrollTo(0, 0);
}
function render() {
  ({today: renderToday, stats: renderStats, book: renderBook, tools: renderTools, settings: renderSettings})[tab]();
}
function setActions(...els) { $("topActions").replaceChildren(...els.filter(Boolean)); }

function openSheet(title, body, side) {
  $("sheetTitle").textContent = title;
  $("sheetBody").replaceChildren(body);
  $("sheetSide").replaceChildren(...(side ? [side] : []));
  $("sheetWrap").hidden = false;
  $("sheetBody").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
function closeSheet() { $("sheetWrap").hidden = true; document.body.style.overflow = ""; }

let toastTimer = null;
function toast(msg, actLabel, act) {
  const el = $("toast");
  el.replaceChildren(msg);
  if (actLabel) el.append(h("button", {type: "button", onclick: () => { el.hidden = true; act(); }}, actLabel));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, actLabel ? 5000 : 2400);
}

// Nút xoá cần chạm 2 lần (trình duyệt trên iPhone không có hộp xác nhận đẹp).
function confirmBtn(label, confirmLabel, fn, cls) {
  let armed = false, timer = null;
  const b = h("button", {class: cls || "btn danger block", type: "button", onclick: () => {
    if (armed) { clearTimeout(timer); fn(); return; }
    armed = true; b.textContent = confirmLabel;
    timer = setTimeout(() => { armed = false; b.textContent = label; }, 3500);
  }}, label);
  return b;
}

// ---------- Ô nhập dùng lại ----------
const field = (label, ctl) => h("label", {class: "field"}, h("span", null, label), ctl);
function moneyInput(val, id) {
  const el = h("input", {class: "input num", inputmode: "numeric", id, placeholder: "0", autocomplete: "off",
                         value: val ? NF.format(val) : ""});
  el.addEventListener("input", () => {
    const d = el.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13);
    el.value = d ? NF.format(Number(d)) : "";
  });
  el.money = () => Number(el.value.replace(/\D/g, "") || 0);
  return el;
}
function segCtl(opts, val, on, cls) {
  const el = h("div", {class: cls || "seg"});
  const paint = () => el.replaceChildren(...opts.map(([k, l]) =>
    h("button", {type: "button", class: k === val ? "on" : "", onclick: () => { val = k; paint(); on(k); }}, l)));
  paint();
  return el;
}
function walletSel(val, on, id) {
  return h("select", {class: "input", id, value: val, onchange: e => on(e.target.value)},
    S.wallets.map(w => h("option", {value: w.id}, w.icon + " " + w.name)));
}
function catSel(type, val, on, id) {
  return h("select", {class: "input", id, value: val, onchange: e => on(e.target.value)},
    catsOf(type).map(c => h("option", {value: c.id}, c.icon + " " + c.name)));
}
const catIcon = c => h("span", {class: "cat-ic", style: {background: tint(c.color)}}, c.icon);

function txRow(t) {
  const tr = t.type === "chuyen";
  const c = tr ? {icon: "⇄", color: "#0e7468", name: "Chuyển tiền"} : cat(t.cat);
  const sub = tr ? wal(t.wallet).name + " → " + wal(t.to).name : [wal(t.wallet).name, t.note].filter(Boolean).join(" · ");
  return h("button", {class: "tx", type: "button", onclick: () => txSheet(t)},
    catIcon(c),
    h("div", {class: "grow"},
      h("div", {class: "t1 ellipsis"}, c.name, t.photo ? " 📎" : "", t.rec ? " ↻" : ""),
      h("div", {class: "t2 ellipsis"}, sub)),
    h("div", {class: "amt num " + t.type}, sign(t.type) + NF.format(t.amount)));
}

// ---------- Thêm / sửa khoản ----------
function otherWallet(id) { const w = S.wallets.find(x => x.id !== id); return w ? w.id : id; }

function txSheet(orig, preset, after) {
  const editing = !!orig;
  const d = Object.assign({type: "chi", amount: 0, cat: null, wallet: S.settings.defaultWallet, to: null,
                           date: today(), note: "", photo: false}, orig || {}, preset || {});
  if (!S.wallets.some(w => w.id === d.wallet) && S.wallets[0]) d.wallet = S.wallets[0].id;
  let expr = d.amount ? String(d.amount) : "";  // VD "45000+30000−5000"
  let photoBlob = null, photoRemoved = false;
  const evalExpr = s => s.split(/(?=[+−])/).reduce((a, part) => {
    const n = Number(part.replace(/[+−]/g, "") || 0);
    return a + (part[0] === "−" ? -n : n);
  }, 0);

  const disp = h("div", {class: "v num"}), hint = h("div", {class: "h"});
  function paintAmt() {
    const n = Math.max(0, evalExpr(expr));
    disp.textContent = sign(d.type) + NF.format(n) + "đ";
    disp.className = "v num " + d.type;
    hint.textContent = /[+−]/.test(expr)
      ? expr.split(/([+−])/).map(p => /[+−]/.test(p) ? " " + p + " " : p ? NF.format(Number(p)) : "").join("")
      : n >= 1e5 ? "≈ " + short(n) : "";
  }
  function press(k) {
    if (k === "⌫") expr = expr.slice(0, -1);
    else if (k === "C") expr = "";
    else if (k === "+" || k === "−") {
      if (!expr) return;
      expr = /[+−]$/.test(expr) ? expr.slice(0, -1) + k : expr + k;
    } else {
      const cur = expr.split(/[+−]/).pop();
      if (!cur && /^0+$/.test(k)) return;
      if ((cur + k).length > 12 || expr.length > 80) return;
      expr += k;
    }
    paintAmt();
  }
  const keypad = h("div", {class: "keypad"},
    ["1", "2", "3", "⌫", "4", "5", "6", "C", "7", "8", "9", "+", "000", "0", "00", "−"].map(k =>
      h("button", {type: "button", class: /^[⌫C+−]$/.test(k) ? "fn" : "", "aria-label": k === "−" ? "trừ" : null,
                   onclick: () => press(k)}, k)));

  const quick = h("input", {class: "input", placeholder: "Hoặc gõ: phở 45k hôm qua", autocomplete: "off", enterkeyhint: "done"});
  const applyQuick = () => {
    if (!quick.value.trim()) return;
    const r = P.parseQuick(quick.value, S.cats.filter(c => !c.hidden), S.wallets, today());
    if (r.amount) expr = String(r.amount);
    if (d.type !== "chuyen") { d.type = r.type; if (r.cat) d.cat = r.cat.id; }
    if (r.wallet) { d.wallet = r.wallet.id; walletBox.value = d.wallet; }
    dateIn.value = r.date;
    if (r.note) noteIn.value = r.note;
    quick.value = "";
    typeSeg.replaceWith(typeSeg = makeSeg());
    paintAmt(); paintCats();
  };
  quick.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applyQuick(); quick.blur(); } });
  quick.addEventListener("change", applyQuick);

  const makeSeg = () => segCtl([["chi", "Chi"], ["thu", "Thu"], ["chuyen", "Chuyển ví"]], d.type, v => {
    d.type = v;
    if (v !== "chuyen" && d.cat && cat(d.cat).type !== v) d.cat = null;
    paintAmt(); paintCats();
  });
  let typeSeg = makeSeg();

  const walletBox = walletSel(d.wallet, v => { d.wallet = v; });
  const walletRow = field("Ví", walletBox);
  const catBox = h("div");
  function paintCats() {
    if (d.type === "chuyen") {
      if (!d.to || d.to === d.wallet) d.to = otherWallet(d.wallet);
      walletRow.hidden = true;
      catBox.replaceChildren(h("div", {class: "grid2"},
        field("Từ ví", walletSel(d.wallet, v => { d.wallet = v; walletBox.value = v; })),
        field("Sang ví", walletSel(d.to, v => { d.to = v; }))));
      return;
    }
    walletRow.hidden = false;
    const g = h("div", {class: "catgrid"});
    for (const c of catsOf(d.type)) {
      g.append(h("button", {type: "button", class: d.cat === c.id ? "on" : "", onclick: () => { d.cat = c.id; paintCats(); }},
        catIcon(c), h("span", null, c.name)));
    }
    catBox.replaceChildren(g);
  }

  const dateIn = h("input", {class: "input", type: "date", value: d.date});
  const noteIn = h("input", {class: "input", placeholder: "Ghi chú (không bắt buộc)", value: d.note, autocomplete: "off"});

  const photoImg = h("img", {class: "photo-prev", alt: "Ảnh hoá đơn", hidden: true});
  const photoDel = h("button", {type: "button", class: "btn sm danger", hidden: true, onclick: () => {
    photoBlob = null; photoRemoved = true; photoImg.hidden = true; photoDel.hidden = true;
  }}, "Bỏ ảnh");
  const photoIn = h("input", {type: "file", accept: "image/*", hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      photoBlob = await resizeImage(f); photoRemoved = false;
      photoImg.src = URL.createObjectURL(photoBlob); photoImg.hidden = false; photoDel.hidden = false;
    } catch (err) { toast(err.message); }
  }});
  if (editing && d.photo) getPhoto(orig.id).then(b => {
    if (b) { photoImg.src = URL.createObjectURL(b); photoImg.hidden = false; photoDel.hidden = false; }
  });

  const repeat = editing ? null : h("input", {type: "checkbox"});

  async function doSave() {
    const amount = Math.max(0, evalExpr(expr));
    if (!amount) { toast("Nhập số tiền trước đã"); return; }
    if (d.type === "chuyen" && d.to === d.wallet) { toast("Chọn hai ví khác nhau"); return; }
    if (d.type !== "chuyen" && !d.cat) d.cat = d.type === "thu" ? "thukhac" : "khac";
    const t = editing ? orig : {id: uid(), ts: Date.now()};
    Object.assign(t, {type: d.type, amount, cat: d.type === "chuyen" ? null : d.cat, wallet: d.wallet,
                      to: d.type === "chuyen" ? d.to : null, date: dateIn.value || today(), note: noteIn.value.trim()});
    try {
      if (photoBlob) { await putPhoto(t.id, photoBlob); t.photo = true; }
      else if (photoRemoved) { await delPhoto(t.id); t.photo = false; }
    } catch (e) { toast("Không lưu được ảnh: " + e.message); }
    if (!editing) S.tx.push(t);
    if (after) after(t);
    if (repeat && repeat.checked) {
      const day = Number(t.date.slice(8));
      S.recurring.push({id: uid(), type: t.type, amount, cat: t.cat, wallet: t.wallet, to: t.to, note: t.note,
                        day, next: addMonthsDay(t.date, 1, day), on: true});
    }
    save(); closeSheet(); render();
    toast(editing ? "Đã sửa" : "Đã ghi " + money(amount));
  }

  const body = h("div", {class: "stack"},
    typeSeg,
    h("div", {class: "amount-disp"}, disp, hint),
    keypad,
    quick,
    catBox,
    walletRow,
    h("div", {class: "grid2"}, field("Ngày", dateIn), field("Ghi chú", noteIn)),
    h("div", {class: "row wrap"},
      h("button", {type: "button", class: "btn sm", onclick: () => photoIn.click()}, "📷 Ảnh hoá đơn"), photoDel, photoIn),
    photoImg,
    repeat ? h("label", {class: "check"}, repeat, "Lặp lại hằng tháng vào ngày này") : null,
    h("button", {type: "button", class: "btn primary block", onclick: doSave}, editing ? "Lưu thay đổi" : "Lưu"),
    editing ? confirmBtn("Xoá khoản này", "Chạm lần nữa để xoá", () => {
      const i = S.tx.indexOf(orig);
      if (i >= 0) S.tx.splice(i, 1);
      save(); closeSheet(); render();
      toast("Đã xoá", "Hoàn tác", () => { S.tx.push(orig); save(); render(); });
    }) : null);
  // Thứ tự trong bảng: typeSeg nằm đầu body, makeSeg() thay nó tại chỗ khi gõ nhanh.
  paintAmt(); paintCats();
  openSheet(editing ? "Sửa khoản" : "Thêm khoản", body, h("button", {class: "link", type: "button", onclick: doSave}, "Lưu"));
}

function resizeImage(file, max) {
  max = max || 1280;
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error("Không đọc được ảnh")), "image/jpeg", 0.72);
    };
    img.onerror = () => rej(new Error("Không đọc được ảnh"));
    img.src = url;
  });
}

function quickAdd(text, input) {
  if (!text.trim()) { txSheet(); return; }
  const r = P.parseQuick(text, S.cats.filter(c => !c.hidden), S.wallets, today());
  if (!r.amount) { txSheet(null, {note: text.trim()}); return; }
  const t = {id: uid(), ts: Date.now(), type: r.type, amount: r.amount,
             cat: r.cat ? r.cat.id : (r.type === "thu" ? "thukhac" : "khac"),
             wallet: r.wallet ? r.wallet.id : S.settings.defaultWallet, to: null, date: r.date, note: r.note};
  S.tx.push(t);
  if (input) input.value = "";
  save(); render();
  toast(cat(t.cat).icon + " " + cat(t.cat).name + " " + sign(t.type) + money(t.amount), "Sửa", () => txSheet(t));
}

function listSheet(title, list, preset) {
  const rows = sortTx(list);
  const chi = sum(rows, "chi"), thu = sum(rows, "thu");
  openSheet(title, h("div", {class: "stack"},
    h("div", {class: "row between small"},
      h("span", {class: "muted"}, rows.length + " khoản"),
      h("span", null, chi ? h("b", {class: "chi num"}, "−" + money(chi)) : null, chi && thu ? " · " : "",
        thu ? h("b", {class: "thu num"}, "+" + money(thu)) : null)),
    rows.length ? h("div", {class: "txlist"}, rows.map(txRow)) : h("div", {class: "empty"}, "Không có khoản nào."),
    preset ? h("button", {type: "button", class: "btn block", onclick: () => txSheet(null, preset)}, "+ Thêm khoản") : null));
}

// ---------- Tab Hôm nay ----------
function renderToday() {
  const v = $("v-today"), t = today(), mk = mkOf(t);
  setActions(
    h("button", {class: "icon-btn", type: "button", "aria-label": "Tìm kiếm", onclick: () => {
      ui.searchOpen = !ui.searchOpen; if (!ui.searchOpen) ui.search = "";
      renderToday(); if (ui.searchOpen) $("q").focus();
    }}, "🔍"));

  const month = txIn(mk);
  const chiM = sum(month, "chi"), thuM = sum(month, "thu");
  const chiToday = sum(month.filter(x => x.date === t), "chi");
  const bal = balances();
  const total = Object.values(bal).reduce((a, b) => a + b, 0);
  const bud = S.settings.budget.total;
  const stats = h("div", {class: "hero-stats"},
    h("div", null, h("span", null, "Thu tháng này"), h("b", null, short(thuM))),
    h("div", null, h("span", null, "Chi tháng này"), h("b", null, short(chiM))),
    h("div", null, h("span", null, "Tổng số dư"), h("b", null, short(total))));
  let hero;
  if (bud > 0) {
    const left = dim(mk) - Number(t.slice(8)) + 1;
    const allow = Math.max(0, (bud - (chiM - chiToday)) / left);
    const rest = allow - chiToday;
    hero = h("div", {class: "hero"},
      h("div", {class: "lbl"}, rest >= 0 ? "Hôm nay còn được tiêu" : "Hôm nay đã tiêu quá"),
      h("div", {class: "big"}, money(Math.abs(rest))),
      h("div", {class: "sub"}, allow > 0 ? "Mỗi ngày được " + money(allow) + " · hôm nay đã chi " + money(chiToday)
        : "Đã dùng hết hạn mức tháng · hôm nay đã chi " + money(chiToday)),
      h("div", {class: "bar"}, h("i", {style: {width: Math.min(100, chiM / bud * 100) + "%"}})),
      h("div", {class: "sub"}, "Tháng này " + short(chiM) + " / " + short(bud) + " · còn " + left + " ngày"),
      stats);
  } else {
    hero = h("div", {class: "hero"},
      h("div", {class: "lbl"}, "Đã chi hôm nay"),
      h("div", {class: "big"}, money(chiToday)),
      h("button", {type: "button", class: "link", style: {color: "inherit", textAlign: "left", padding: 0, textDecoration: "underline", fontWeight: 500},
                   onclick: () => setTab("settings")}, "Đặt hạn mức tháng để biết mỗi ngày được tiêu bao nhiêu"),
      stats);
  }

  const qi = h("input", {class: "input", id: "quickIn", placeholder: "Gõ nhanh: cafe 35k, grab 52k hôm qua",
                         autocomplete: "off", enterkeyhint: "done"});
  qi.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); quickAdd(qi.value, qi); } });
  const quick = h("div", {class: "quick"}, qi,
    h("button", {type: "button", class: "btn primary", onclick: () => quickAdd(qi.value, qi)}, "Ghi"));

  const alerts = h("div", {class: "alerts"});
  if (ui.recurNote) { alerts.append(h("div", {class: "alert info"}, "↻ " + ui.recurNote)); ui.recurNote = ""; }
  const spent = byCat(month, "chi");
  for (const [cid, lim] of Object.entries(S.settings.budget.cats)) {
    if (!lim) continue;
    const s = spent[cid] || 0, c = cat(cid);
    if (s >= lim) alerts.append(h("div", {class: "alert bad"}, c.icon + " " + c.name + " đã vượt hạn mức: " + short(s) + " / " + short(lim)));
    else if (s >= lim * 0.8) alerts.append(h("div", {class: "alert"}, c.icon + " " + c.name + " đã dùng " + Math.round(s / lim * 100) + "% hạn mức (" + short(s) + " / " + short(lim) + ")"));
  }
  for (const d of S.debts) if (d.due && d.due < t && debtLeft(d) > 0) {
    alerts.append(h("div", {class: "alert"}, (d.kind === "cho" ? "🤝 " + d.person + " quá hạn trả bạn " : "🙏 Quá hạn trả " + d.person + " ") + money(debtLeft(d))));
  }
  if (S.tx.length && new Date().getHours() >= 20 && !S.tx.some(x => x.date === t)) {
    alerts.append(h("div", {class: "alert info"}, "📝 Hôm nay chưa ghi khoản nào. Chạm + hoặc gõ nhanh ở ô trên."));
  }
  const lb = S.settings.lastBackup;
  if (S.tx.length >= 15 && (!lb || daysBetween(lb, t) > 14)) {
    alerts.append(h("div", {class: "alert info"},
      h("span", {class: "grow"}, lb ? "Đã " + daysBetween(lb, t) + " ngày chưa sao lưu dữ liệu." : "Bạn chưa sao lưu dữ liệu lần nào."),
      h("button", {type: "button", class: "btn sm primary", onclick: backup}, "Sao lưu")));
  }

  const search = ui.searchOpen ? h("input", {class: "input", id: "q", type: "search", placeholder: "Tìm theo ghi chú, danh mục, ví, số tiền",
                                             value: ui.search, autocomplete: "off"}) : null;
  const listBox = h("div", {class: "stack", style: {gap: 0}});
  function paintList() {
    let rows;
    if (ui.searchOpen && ui.search.trim()) {
      const q = P.norm(ui.search.trim());
      rows = S.tx.filter(x => P.norm([x.note, x.cat && cat(x.cat).name, wal(x.wallet).name, x.amount, x.type === "chuyen" ? "chuyen tien" : ""].join(" ")).includes(q));
    } else {
      const from = shiftMonth(mk, -(ui.months - 1));
      rows = S.tx.filter(x => x.date.slice(0, 7) >= from);
    }
    rows = sortTx(rows);
    const kids = [];
    if (!S.tx.length) {
      kids.push(h("div", {class: "card empty"},
        h("div", {style: {fontSize: "34px"}}, "🪙"),
        h("p", {class: "bold", style: {color: "var(--fg)", margin: "6px 0"}}, "Chưa có khoản nào"),
        h("p", {style: {margin: 0}}, "Bấm nút + để ghi, hoặc gõ nhanh “phở 45k” ở ô trên.")));
    } else if (!rows.length) {
      kids.push(h("div", {class: "empty"}, ui.search ? "Không tìm thấy khoản nào." : "Tháng này chưa có khoản nào."));
    }
    let i = 0;
    while (i < rows.length) {
      const day = rows[i].date, items = [];
      while (i < rows.length && rows[i].date === day) items.push(rows[i++]);
      const net = sum(items, "thu") - sum(items, "chi");
      kids.push(h("div", {class: "day"},
        h("div", {class: "day-head"}, h("span", null, dayLabel(day)),
          h("span", {class: "num " + (net < 0 ? "chi" : net > 0 ? "thu" : "")}, (net > 0 ? "+" : net < 0 ? "−" : "") + NF.format(Math.abs(net)))),
        h("div", {class: "txlist"}, items.map(txRow))));
    }
    const oldest = S.tx.reduce((a, x) => x.date < a ? x.date : a, t);
    if (!(ui.searchOpen && ui.search.trim()) && mkOf(oldest) < shiftMonth(mk, -(ui.months - 1))) {
      kids.push(h("button", {type: "button", class: "btn block", style: {marginTop: "12px"}, onclick: () => { ui.months++; paintList(); }},
        "Xem " + monthLabel(shiftMonth(mk, -ui.months)).toLowerCase()));
    }
    listBox.replaceChildren(...kids);
  }
  if (search) search.addEventListener("input", () => { ui.search = search.value; paintList(); });
  paintList();
  fill(v, hero, search, quick, favsRow(), alerts.children.length ? alerts : null, forecastCard(), listBox);
}

// Khoản hay ghi trong 60 ngày (cùng loại, danh mục, số tiền, ghi chú, ít nhất 2 lần).
function frequent(limit) {
  const since = P.addDays(today(), -60), m = new Map();
  for (const t of S.tx) {
    if (t.type === "chuyen" || t.rec || t.date < since) continue;
    const key = t.type + "|" + t.cat + "|" + t.amount + "|" + P.norm(t.note || "");
    const e = m.get(key) || {t, n: 0, last: ""};
    e.n++;
    if (t.date >= e.last) { e.last = t.date; e.t = t; }
    m.set(key, e);
  }
  return [...m.values()].filter(e => e.n >= 2)
    .sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, limit || 8).map(e => e.t);
}
function addLike(src) {
  const t = {id: uid(), ts: Date.now(), type: src.type, amount: src.amount, cat: src.cat, to: null, date: today(), note: src.note,
             wallet: S.wallets.some(w => w.id === src.wallet) ? src.wallet : S.settings.defaultWallet};
  S.tx.push(t); save(); render();
  toast("Đã ghi " + (t.note || cat(t.cat).name) + " " + money(t.amount), "Hoàn tác", () => {
    S.tx = S.tx.filter(x => x !== t); save(); render();
  });
}
function favsRow() {
  const list = frequent(8);
  if (!list.length) return null;
  return h("div", {class: "favs", "aria-label": "Khoản hay dùng, chạm để ghi"}, list.map(t => {
    const c = cat(t.cat);
    return h("button", {type: "button", class: "fav", onclick: () => addLike(t)},
      h("span", null, c.icon), h("span", {class: "fav-n"}, t.note || c.name), h("b", {class: "num " + t.type}, short(t.amount)));
  }));
}

// Dự báo chi cuối tháng theo tốc độ 14 ngày gần nhất (không tính khoản cố định), cộng khoản cố định sắp tới.
function forecastCard() {
  const t = today(), mk = mkOf(t), day = Number(t.slice(8)), n = dim(mk);
  if (!S.tx.length) return null;
  const first = S.tx.reduce((a, x) => x.date < a ? x.date : a, t);
  const hist = daysBetween(first, t) + 1;
  if (hist < 5) return null;
  const win = Math.min(14, hist), from = P.addDays(t, -(win - 1));
  const pace = sum(S.tx.filter(x => !x.rec && x.date >= from && x.date <= t), "chi") / win;
  const month = txIn(mk);
  const chiM = sum(month.filter(x => x.date <= t), "chi");
  const pending = S.recurring.filter(r => r.on && r.type === "chi" && r.next && r.next > t && r.next.startsWith(mk))
    .reduce((a, r) => a + r.amount, 0);
  const fc = chiM + pace * (n - day) + pending;
  const bud = S.settings.budget.total;

  const notes = [];
  if (hist >= 14) {
    const wk = (a, b) => byCat(S.tx.filter(x => x.date > P.addDays(t, a) && x.date <= P.addDays(t, b)), "chi");
    const cur = wk(-7, 0), prev = wk(-14, -7);
    let up = null, down = null;
    for (const id of new Set([...Object.keys(cur), ...Object.keys(prev)])) {
      const x = cur[id] || 0, y = prev[id] || 0, d = x - y;
      if (d >= 100000 && (y ? x >= y * 1.3 : x >= 200000) && (!up || d > up.d)) up = {id, d, p: y ? Math.round(d / y * 100) : null};
      if (-d >= 100000 && x <= y * 0.7 && (!down || d < down.d)) down = {id, d, p: Math.round(-d / y * 100)};
    }
    if (up) { const c = cat(up.id); notes.push(["chi", c.icon + " " + c.name + " tuần này tăng " + (up.p != null ? up.p + "% " : "") + "(+" + short(up.d) + ") so với tuần trước"]); }
    if (down) { const c = cat(down.id); notes.push(["thu", c.icon + " " + c.name + " tuần này giảm " + down.p + "% (−" + short(-down.d) + ") so với tuần trước"]); }
  }
  const totM = sum(month, "chi");
  const top = Object.entries(byCat(month, "chi")).sort((a, b) => b[1] - a[1])[0];
  if (top && totM && notes.length < 2) {
    const c = cat(top[0]);
    notes.push(["", c.icon + " " + c.name + " chiếm " + Math.round(top[1] / totM * 100) + "% chi tiêu tháng này"]);
  }
  return h("div", {class: "card stack", style: {gap: "8px"}},
    h("div", {class: "row between"}, h("h3", {style: {margin: 0}}, "Dự báo cuối tháng"),
      h("span", {class: "tiny muted"}, "theo " + win + " ngày gần đây")),
    h("div", {class: "row between wrap", style: {alignItems: "baseline"}},
      h("b", {class: "num", style: {fontSize: "24px"}}, "≈ " + short(fc)),
      bud ? h("span", {class: "pill " + (fc > bud ? "chi" : "thu")},
        fc > bud ? "vượt hạn mức " + short(fc - bud) : "dưới hạn mức " + short(bud - fc)) : null),
    h("div", {class: "small muted"}, "Đang chi khoảng " + short(pace) + "/ngày" + (pending ? " · sắp tới còn " + short(pending) + " khoản cố định" : "")),
    notes.map(([cls, txt]) => h("div", {class: "small " + cls}, txt)));
}

// ---------- Tab Thống kê ----------
function niceCeil(x) {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

function donut(parts, total) {
  const r = 52, c = 2 * Math.PI * r;
  const s = svgEl("svg", {viewBox: "0 0 136 136", role: "img", "aria-label": "Tỉ lệ theo danh mục"});
  s.append(svgEl("circle", {cx: 68, cy: 68, r, fill: "none", style: "stroke:var(--surface-2)", "stroke-width": 18}));
  let off = 0;
  for (const p of parts) {
    const len = total ? p.v / total * c : 0;
    s.append(svgEl("circle", {cx: 68, cy: 68, r, fill: "none", stroke: p.color, "stroke-width": 18,
      "stroke-dasharray": len + " " + (c - len), "stroke-dashoffset": -off, transform: "rotate(-90 68 68)"}));
    off += len;
  }
  s.append(svgEl("text", {x: 68, y: 63, "text-anchor": "middle", style: "font:600 11px var(--font);fill:var(--muted)"}, "Tổng"),
           svgEl("text", {x: 68, y: 82, "text-anchor": "middle", style: "font:700 17px var(--font-num);fill:var(--fg)"}, short(total)));
  return s;
}

function dailyChart(vals, mk, perDay) {
  const W = 340, H = 160, pl = 32, pr = 4, pt = 10, pb = 20;
  const n = vals.length, max = niceCeil(Math.max(...vals, perDay || 0, 1));
  const bw = (W - pl - pr) / n, y = v => pt + (H - pt - pb) * (1 - v / max);
  const s = svgEl("svg", {class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Chi tiêu theo ngày"});
  for (const g of [0, max / 2, max]) {
    s.append(svgEl("line", {class: "gl", x1: pl, x2: W - pr, y1: y(g), y2: y(g)}),
             svgEl("text", {x: pl - 4, y: y(g) + 3, "text-anchor": "end"}, short(g)));
  }
  const t = today();
  vals.forEach((v, i) => {
    const iso = mk + "-" + String(i + 1).padStart(2, "0");
    if (v > 0) s.append(svgEl("rect", {x: pl + i * bw + 1, y: y(v), width: Math.max(1, bw - 2), height: y(0) - y(v), rx: 2,
      style: "fill:" + (iso === t ? "var(--gold)" : perDay && v > perDay ? "var(--chi)" : "var(--accent)")},
      svgEl("title", null, (i + 1) + "/" + Number(mk.slice(5)) + ": " + money(v))));
    if ([1, 5, 10, 15, 20, 25, n].includes(i + 1)) s.append(svgEl("text", {x: pl + i * bw + bw / 2, y: H - 5, "text-anchor": "middle"}, i + 1));
  });
  if (perDay) {
    s.append(svgEl("line", {x1: pl, x2: W - pr, y1: y(perDay), y2: y(perDay), "stroke-dasharray": "4 3", style: "stroke:var(--warn);stroke-width:1.5"}));
  }
  return s;
}

function trendChart(months) {
  const W = 340, H = 150, pl = 32, pb = 20, pt = 8;
  const max = niceCeil(Math.max(1, ...months.map(m => Math.max(m.thu, m.chi))));
  const gw = (W - pl) / months.length, bw = Math.min(16, gw / 3), y = v => pt + (H - pt - pb) * (1 - v / max);
  const s = svgEl("svg", {class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Thu chi 6 tháng"});
  for (const g of [0, max / 2, max]) {
    s.append(svgEl("line", {class: "gl", x1: pl, x2: W, y1: y(g), y2: y(g)}), svgEl("text", {x: pl - 4, y: y(g) + 3, "text-anchor": "end"}, short(g)));
  }
  months.forEach((m, i) => {
    const cx = pl + i * gw + gw / 2;
    s.append(
      svgEl("rect", {x: cx - bw - 1, y: y(m.thu), width: bw, height: y(0) - y(m.thu), rx: 2, style: "fill:var(--thu)"}, svgEl("title", null, monthLabel(m.mk) + " thu " + money(m.thu))),
      svgEl("rect", {x: cx + 1, y: y(m.chi), width: bw, height: y(0) - y(m.chi), rx: 2, style: "fill:var(--chi)"}, svgEl("title", null, monthLabel(m.mk) + " chi " + money(m.chi))),
      svgEl("text", {x: cx, y: H - 5, "text-anchor": "middle"}, "T" + Number(m.mk.slice(5))));
  });
  return s;
}

function pctDelta(cur, prev, upIsBad) {
  if (!prev) return cur ? h("span", {class: "delta muted"}, "mới") : null;
  const p = Math.round((cur - prev) / prev * 100);
  if (!p) return h("span", {class: "delta muted"}, "không đổi");
  const bad = upIsBad ? p > 0 : p < 0;
  return h("span", {class: "delta " + (bad ? "chi" : "thu")}, (p > 0 ? "▲ " : "▼ ") + Math.abs(p) + "%");
}

function renderStats() {
  const v = $("v-stats"), cur = mkOf(today());
  const mk = ui.statMonth || cur, prevMk = shiftMonth(mk, -1);
  const list = txIn(mk), prev = txIn(prevMk);
  setActions(h("button", {class: "icon-btn", type: "button", "aria-label": "Xuất Excel tháng này",
                          onclick: () => exportCSV(list, "chi-tieu-" + mk + ".csv")}, "⇪"));

  const chi = sum(list, "chi"), thu = sum(list, "thu"), pchi = sum(prev, "chi"), pthu = sum(prev, "thu");
  const nav = h("div", {class: "month-nav"},
    h("button", {class: "icon-btn", type: "button", "aria-label": "Tháng trước", onclick: () => { ui.statMonth = shiftMonth(mk, -1); renderStats(); }}, "‹"),
    h("b", null, monthLabel(mk)),
    h("button", {class: "icon-btn", type: "button", "aria-label": "Tháng sau", disabled: mk >= cur, onclick: () => { ui.statMonth = shiftMonth(mk, 1); renderStats(); }}, "›"));
  const kpis = h("div", {class: "kpis"},
    h("div", {class: "kpi"}, h("span", null, "Thu"), h("b", {class: "thu"}, short(thu)), pctDelta(thu, pthu, false)),
    h("div", {class: "kpi"}, h("span", null, "Chi"), h("b", {class: "chi"}, short(chi)), pctDelta(chi, pchi, true)),
    h("div", {class: "kpi"}, h("span", null, "Còn lại"), h("b", {class: thu - chi < 0 ? "chi" : ""}, short(thu - chi)),
      h("i", {class: "muted"}, thu ? "tiết kiệm " + Math.max(0, Math.round((thu - chi) / thu * 100)) + "%" : "")));

  // Theo danh mục
  const type = ui.statType;
  const by = byCat(list, type), tot = type === "chi" ? chi : thu;
  const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 7), rest = sorted.slice(7).reduce((a, x) => a + x[1], 0);
  const parts = top.map(([id, val]) => ({id, v: val, color: cat(id).color}));
  if (rest) parts.push({id: null, v: rest, color: "#9aa5a1"});
  const catCard = h("div", {class: "card"},
    h("div", {class: "row between", style: {marginBottom: "10px"}},
      h("h3", {style: {margin: 0}}, "Theo danh mục"),
      segCtl([["chi", "Chi"], ["thu", "Thu"]], type, x => { ui.statType = x; renderStats(); })),
    tot ? h("div", {class: "donut-wrap"}, donut(parts, tot),
      h("div", {class: "legend"}, parts.map(p => {
        const c = p.id ? cat(p.id) : {name: "Còn lại", icon: "…"};
        return h("button", {type: "button", class: "row", style: {background: "none", border: 0, padding: "2px 0", textAlign: "left"},
          onclick: () => p.id && listSheet(c.icon + " " + c.name + " · " + monthLabel(mk), list.filter(x => x.type === type && x.cat === p.id))},
          h("i", {style: {background: p.color}}), h("span", {class: "grow ellipsis"}, c.name),
          h("span", {class: "muted num"}, Math.round(p.v / tot * 100) + "%"), h("b", {class: "num", style: {minWidth: "44px", textAlign: "right"}}, short(p.v)));
      })))
      : h("div", {class: "empty"}, type === "chi" ? "Tháng này chưa có khoản chi." : "Tháng này chưa có khoản thu."));

  // So với tháng trước
  const pb = byCat(prev, "chi");
  const ids = [...new Set([...Object.keys(by), ...Object.keys(pb)])];
  const diffs = (type === "chi" ? ids : []).map(id => ({id, cur: (byCat(list, "chi")[id] || 0), prev: pb[id] || 0}))
    .filter(x => x.cur !== x.prev).sort((a, b) => Math.abs(b.cur - b.prev) - Math.abs(a.cur - a.prev)).slice(0, 6);
  const cmpCard = diffs.length && prev.length ? h("div", {class: "card"}, h("h3", null, "So với " + monthLabel(prevMk).toLowerCase()),
    h("div", {class: "cmp"}, diffs.map(x => {
      const c = cat(x.id), d = x.cur - x.prev;
      return h("div", {class: "row"}, h("span", null, c.icon), h("span", {class: "grow ellipsis"}, c.name),
        h("span", {class: "small muted num"}, short(x.prev) + " → " + short(x.cur)),
        h("span", {class: "delta " + (d > 0 ? "chi" : "thu"), style: {minWidth: "62px", textAlign: "right"}}, (d > 0 ? "+" : "−") + short(Math.abs(d))));
    }))) : null;

  // Theo ngày
  const n = dim(mk), daily = new Array(n).fill(0);
  for (const x of list) if (x.type === "chi") daily[Number(x.date.slice(8)) - 1] += x.amount;
  const elapsed = mk === cur ? Number(today().slice(8)) : n;
  const perDay = S.settings.budget.total ? S.settings.budget.total / n : 0;
  const dayCard = h("div", {class: "card"},
    h("h3", null, "Chi theo ngày"),
    dailyChart(daily, mk, perDay),
    h("div", {class: "row between small muted", style: {marginTop: "6px"}},
      h("span", null, "Trung bình " + money(chi / Math.max(1, elapsed)) + "/ngày"),
      perDay ? h("span", {class: "warn"}, "- - hạn mức " + short(perDay) + "/ngày") : null));

  // Lịch nhiệt
  const first = dateOf(mk + "-01").getDay(), offset = (first + 6) % 7, maxDay = Math.max(...daily, 1);
  const heat = h("div", {class: "heat"}, ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => h("div", {class: "hd"}, d)));
  for (let i = 0; i < offset; i++) heat.append(h("div"));
  daily.forEach((val, i) => {
    const iso = mk + "-" + String(i + 1).padStart(2, "0");
    const pc = val ? Math.round(15 + 70 * val / maxDay) : 0;
    heat.append(h("button", {type: "button", class: "c" + (iso === today() ? " today" : ""),
      style: val ? {background: `color-mix(in srgb, var(--chi) ${pc}%, var(--surface-2))`, color: pc > 55 ? "#fff" : ""} : null,
      onclick: () => listSheet(dayLabel(iso), list.filter(x => x.date === iso), {date: iso})},
      String(i + 1), val ? h("small", null, short(val)) : null));
  });
  const heatCard = h("div", {class: "card"}, h("h3", null, "Lịch chi tiêu"), heat,
    h("p", {class: "tiny muted", style: {margin: "8px 0 0"}}, "Ô càng đậm là ngày tiêu càng nhiều. Chạm vào ô để xem chi tiết."));

  // Theo thứ trong tuần
  const wsum = new Array(7).fill(0), wcnt = new Array(7).fill(0);
  for (let i = 0; i < elapsed; i++) { const wd = (dateOf(mk + "-" + String(i + 1).padStart(2, "0")).getDay() + 6) % 7; wsum[wd] += daily[i]; wcnt[wd]++; }
  const wavg = wsum.map((s, i) => wcnt[i] ? s / wcnt[i] : 0), wmax = Math.max(...wavg, 1);
  const wkCard = chi ? h("div", {class: "card"}, h("h3", null, "Trung bình theo thứ"),
    h("div", {class: "stack", style: {gap: "7px"}}, ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"].map((name, i) =>
      h("div", {class: "hbar"}, h("span", null, name), h("div", {class: "bar"}, h("i", {style: {width: wavg[i] / wmax * 100 + "%"}})),
        h("span", {class: "v small"}, short(wavg[i])))))) : null;

  // Khoản lớn nhất
  const big = list.filter(x => x.type === "chi").sort((a, b) => b.amount - a.amount).slice(0, 5);
  const topCard = big.length ? h("div", {class: "stack", style: {gap: "6px"}}, h("div", {class: "sec-title"}, "5 khoản chi lớn nhất"),
    h("div", {class: "txlist"}, big.map(txRow))) : null;

  // 6 tháng
  const months = [];
  for (let i = 5; i >= 0; i--) { const m = shiftMonth(mk, -i), l = txIn(m); months.push({mk: m, thu: sum(l, "thu"), chi: sum(l, "chi")}); }
  const trendCard = h("div", {class: "card"}, h("div", {class: "row between"}, h("h3", null, "6 tháng gần đây"),
    h("span", {class: "tiny"}, h("b", {class: "thu"}, "■ "), "Thu  ", h("b", {class: "chi"}, "■ "), "Chi")), trendChart(months));

  const yearBtn = h("button", {type: "button", class: "btn block", onclick: () => yearSheet(Number(mk.slice(0, 4)))},
    "🏆 Tổng kết năm " + mk.slice(0, 4));
  fill(v, nav, kpis, catCard, cmpCard, dayCard, heatCard, wkCard, topCard, trendCard, yearBtn);
}

function yearSheet(y) {
  const ys = String(y), list = S.tx.filter(t => t.date.startsWith(ys));
  const chi = sum(list, "chi"), thu = sum(list, "thu"), t0 = today();
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const mk = ys + "-" + String(m).padStart(2, "0"), l = list.filter(t => t.date.startsWith(mk));
    months.push({mk, thu: sum(l, "thu"), chi: sum(l, "chi")});
  }
  const nav = h("div", {class: "month-nav"},
    h("button", {class: "icon-btn", type: "button", "aria-label": "Năm trước", onclick: () => yearSheet(y - 1)}, "‹"),
    h("b", null, "Năm " + y),
    h("button", {class: "icon-btn", type: "button", "aria-label": "Năm sau", disabled: ys >= t0.slice(0, 4), onclick: () => yearSheet(y + 1)}, "›"));
  if (!list.length) {
    openSheet("Tổng kết năm", h("div", {class: "stack"}, nav, h("div", {class: "empty"}, "Năm " + y + " chưa có khoản nào.")));
    return;
  }
  const spentMonths = months.filter(m => m.chi > 0);
  const maxM = spentMonths.reduce((a, m) => !a || m.chi > a.chi ? m : a, null);
  const minM = spentMonths.reduce((a, m) => !a || m.chi < a.chi ? m : a, null);
  const chiList = list.filter(t => t.type === "chi");
  const daily = {}, cnt = {};
  for (const t of chiList) { daily[t.date] = (daily[t.date] || 0) + t.amount; cnt[t.cat] = (cnt[t.cat] || 0) + 1; }
  const topDay = Object.entries(daily).sort((a, b) => b[1] - a[1])[0];
  const start = list.reduce((a, t) => t.date < a ? t.date : a, ys + "-12-31");
  const end = t0.startsWith(ys) ? t0 : ys + "-12-31";
  const span = Math.max(1, daysBetween(start, end) + 1);
  const noSpend = span - Object.keys(daily).filter(d => d >= start && d <= end).length;
  const cf = chiList.filter(t => t.cat === "cf");
  const gifts = S.gifts.filter(g => g.kind === "di" && g.date.startsWith(ys));
  const byc = Object.entries(byCat(list, "chi")).sort((a, b) => b[1] - a[1]);
  const most = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  const big = chiList.slice().sort((a, b) => b.amount - a.amount)[0];
  const tile = (label, val, sub, cls) => h("div", {class: "kpi"}, h("span", null, label), h("b", {class: cls || ""}, val), sub ? h("i", {class: "muted"}, sub) : null);

  openSheet("Tổng kết năm", h("div", {class: "stack"},
    nav,
    h("div", {class: "kpis"},
      tile("Thu", short(thu), null, "thu"), tile("Chi", short(chi), null, "chi"),
      tile("Để dành", short(thu - chi), thu ? Math.max(0, Math.round((thu - chi) / thu * 100)) + "% thu nhập" : null)),
    h("div", {class: "card"}, h("h3", null, "Thu chi từng tháng"), trendChart(months)),
    h("div", {class: "grid2"},
      maxM ? tile("Tháng tiêu nhiều nhất", monthLabel(maxM.mk).replace("Tháng ", "T"), short(maxM.chi)) : null,
      minM && minM !== maxM ? tile("Tháng tiêu ít nhất", monthLabel(minM.mk).replace("Tháng ", "T"), short(minM.chi)) : null,
      topDay ? tile("Ngày tiêu nhiều nhất", dmy(topDay[0]).slice(0, -5), short(topDay[1])) : null,
      tile("Ngày không tiêu gì", noSpend + " ngày", "trên " + span + " ngày"),
      cf.length ? tile("Cà phê", cf.length + " lần", short(sum(cf, "chi"))) : null,
      gifts.length ? tile("Hiếu hỉ đã mừng", gifts.length + " lần", short(gifts.reduce((a, g) => a + g.amount, 0))) : null,
      tile("Trung bình", short(chi / span), "mỗi ngày"),
      tile("Đã ghi", list.length + " khoản", most ? "nhiều nhất: " + cat(most[0]).name : null)),
    byc.length ? h("div", {class: "card stack", style: {gap: "9px"}}, h("h3", {style: {margin: 0}}, "Tiêu nhiều nhất vào"),
      byc.slice(0, 5).map(([id, v]) => {
        const c = cat(id);
        return h("div", {class: "stack", style: {gap: "4px"}},
          h("div", {class: "row"}, h("span", null, c.icon), h("span", {class: "grow"}, c.name),
            h("span", {class: "small muted num"}, Math.round(v / chi * 100) + "%"), h("b", {class: "num"}, short(v))),
          h("div", {class: "bar"}, h("i", {style: {width: v / byc[0][1] * 100 + "%", background: c.color}})));
      })) : null,
    big ? h("div", {class: "sec-title"}, "Khoản chi lớn nhất năm") : null,
    big ? h("div", {class: "txlist"}, txRow(big)) : null));
}

// ---------- Tab Sổ ----------
function renderBook() {
  const v = $("v-book");
  setActions();
  const tabs = segCtl([["vi", "Ví"], ["dicho", "Đi chợ"], ["no", "Nợ"], ["hieuhi", "Hiếu hỉ"], ["muctieu", "Mục tiêu"], ["hu", "6 hũ"], ["chia", "Chia tiền"]],
    ui.bookTab, k => { ui.bookTab = k; renderBook(); }, "seg chips");
  const box = h("div", {class: "stack", style: {gap: "14px"}});
  ({vi: bookWallets, dicho: bookShop, no: bookDebts, hieuhi: bookGifts, muctieu: bookGoals, hu: bookJars, chia: bookSplit})[ui.bookTab](box);
  fill(v, tabs, box);
}

function bookWallets(box) {
  const bal = balances(), total = Object.values(bal).reduce((a, b) => a + b, 0);
  box.append(
    h("div", {class: "card"}, h("h3", null, "Tổng số dư"), h("div", {class: "wallet-bal", style: {fontSize: "28px"}}, money(total))),
    h("div", {class: "list"}, S.wallets.map(w => h("button", {type: "button", class: "li", onclick: () => walletSheet(w)},
      h("span", {class: "cat-ic", style: {background: "var(--surface-2)"}}, w.icon),
      h("div", {class: "grow"}, h("div", {class: "bold"}, w.name, w.id === S.settings.defaultWallet ? h("span", {class: "pill", style: {marginLeft: "6px"}}, "mặc định") : null),
        h("div", {class: "small muted"}, (WALLET_KINDS.find(k => k[0] === w.kind) || ["", "Khác"])[1])),
      h("span", {class: "wallet-bal " + (bal[w.id] < 0 ? "chi" : "")}, money(bal[w.id] || 0))))),
    h("div", {class: "grid2"},
      h("button", {type: "button", class: "btn", onclick: () => walletSheet(null)}, "+ Thêm ví"),
      h("button", {type: "button", class: "btn primary", onclick: () => txSheet(null, {type: "chuyen"})}, "⇄ Chuyển tiền")),
    h("p", {class: "tiny muted", style: {margin: "0 4px"}}, "Chuyển tiền giữa các ví (rút ATM, nạp MoMo…) không tính là chi tiêu."));
}

function walletSheet(w) {
  const bal = balances();
  const name = h("input", {class: "input", value: w ? w.name : "", placeholder: "VD: Techcombank"});
  const icon = h("input", {class: "input", value: w ? w.icon : "👛", maxlength: 4});
  let kind = w ? w.kind : "bank";
  const kindSel = h("select", {class: "input", value: kind, onchange: e => { kind = e.target.value; }},
    WALLET_KINDS.map(([k, l]) => h("option", {value: k}, l)));
  const cur = moneyInput(w ? Math.abs(bal[w.id] || 0) : 0);
  let neg = w ? (bal[w.id] || 0) < 0 : false;
  const negChk = h("input", {type: "checkbox", checked: neg, onchange: e => { neg = e.target.checked; }});
  const def = h("input", {type: "checkbox", checked: w ? w.id === S.settings.defaultWallet : false});
  const used = w ? S.tx.some(t => t.wallet === w.id || t.to === w.id) : false;
  const doSave = () => {
    if (!name.value.trim()) { toast("Nhập tên ví"); return; }
    const want = (neg ? -1 : 1) * cur.money();
    const x = w || {id: uid(), init: 0};
    Object.assign(x, {name: name.value.trim(), icon: icon.value.trim() || "👛", kind});
    x.init = want - ((bal[x.id] || 0) - (w ? Number(w.init) || 0 : 0));
    if (!w) S.wallets.push(x);
    if (def.checked) S.settings.defaultWallet = x.id;
    save(); closeSheet(); render(); toast("Đã lưu ví");
  };
  openSheet(w ? "Sửa ví" : "Thêm ví", h("div", {class: "stack"},
    h("div", {class: "grid2"}, field("Tên ví", name), field("Biểu tượng", icon)),
    field("Loại", kindSel),
    field("Số dư hiện tại", cur),
    h("label", {class: "check"}, negChk, "Số dư âm (thẻ tín dụng đang nợ)"),
    h("label", {class: "check"}, def, "Dùng làm ví mặc định khi ghi"),
    h("button", {type: "button", class: "btn primary block", onclick: doSave}, "Lưu"),
    w ? (used ? h("p", {class: "tiny muted"}, "Ví này đã có giao dịch nên không xoá được.")
              : confirmBtn("Xoá ví", "Chạm lần nữa để xoá", () => {
                  S.wallets = S.wallets.filter(x => x !== w);
                  if (S.settings.defaultWallet === w.id && S.wallets[0]) S.settings.defaultWallet = S.wallets[0].id;
                  save(); closeSheet(); render();
                })) : null));
}

function bookDebts(box) {
  const active = S.debts.filter(d => debtLeft(d) > 0).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const done = S.debts.filter(d => debtLeft(d) <= 0);
  const owedToMe = active.filter(d => d.kind === "cho").reduce((a, d) => a + debtLeft(d), 0);
  const iOwe = active.filter(d => d.kind === "vay").reduce((a, d) => a + debtLeft(d), 0);
  const row = d => {
    const left = debtLeft(d), over = d.due && d.due < today() && left > 0;
    return h("button", {type: "button", class: "li", onclick: () => debtSheet(d)},
      h("span", {class: "cat-ic", style: {background: "var(--surface-2)"}}, d.kind === "cho" ? "🤝" : "🙏"),
      h("div", {class: "grow"}, h("div", {class: "bold ellipsis"}, d.person),
        h("div", {class: "small muted ellipsis"}, d.kind === "cho" ? "Cho mượn" : "Mượn", " · ", dmy(d.date),
          d.note ? " · " + d.note : "")),
      h("div", {style: {textAlign: "right"}},
        h("div", {class: "wallet-bal " + (d.kind === "cho" ? "thu" : "chi"), style: {fontSize: "15px"}}, left > 0 ? money(left) : "Xong"),
        d.due && left > 0 ? h("span", {class: "pill" + (over ? " warn" : "")}, (over ? "quá hạn " : "hạn ") + dmy(d.due)) : null));
  };
  box.append(
    h("div", {class: "kpis", style: {gridTemplateColumns: "1fr 1fr"}},
      h("div", {class: "kpi"}, h("span", null, "Người ta nợ mình"), h("b", {class: "thu"}, money(owedToMe))),
      h("div", {class: "kpi"}, h("span", null, "Mình nợ người ta"), h("b", {class: "chi"}, money(iOwe)))),
    h("button", {type: "button", class: "btn primary block", onclick: () => debtSheet(null)}, "+ Ghi khoản nợ"),
    active.length ? h("div", {class: "list"}, active.map(row)) : h("div", {class: "empty"}, "Không có khoản nợ nào đang mở."),
    done.length ? h("button", {type: "button", class: "link", onclick: () => { ui.showDone = !ui.showDone; renderBook(); }},
      (ui.showDone ? "Ẩn " : "Xem ") + done.length + " khoản đã trả xong") : null,
    ui.showDone && done.length ? h("div", {class: "list"}, done.map(row)) : null,
    h("p", {class: "tiny muted", style: {margin: "0 4px"}}, "Sổ nợ theo dõi riêng, không cộng trừ vào ví."));
}

function debtSheet(d) {
  let kind = d ? d.kind : "cho";
  const person = h("input", {class: "input", value: d ? d.person : "", placeholder: "Tên người"});
  const amt = moneyInput(d ? d.amount : 0);
  const date = h("input", {class: "input", type: "date", value: d ? d.date : today()});
  const due = h("input", {class: "input", type: "date", value: d ? d.due || "" : ""});
  const note = h("input", {class: "input", value: d ? d.note : "", placeholder: "Ghi chú"});
  const doSave = () => {
    if (!person.value.trim() || !amt.money()) { toast("Nhập tên và số tiền"); return; }
    const x = d || {id: uid(), pays: []};
    Object.assign(x, {kind, person: person.value.trim(), amount: amt.money(), date: date.value || today(), due: due.value || null, note: note.value.trim()});
    if (!d) S.debts.push(x);
    save(); closeSheet(); render();
  };
  const kids = [
    segCtl([["cho", "Mình cho mượn"], ["vay", "Mình đi mượn"]], kind, k => { kind = k; }),
    field("Người", person), field("Số tiền", amt),
    h("div", {class: "grid2"}, field("Ngày", date), field("Hạn trả", due)),
    field("Ghi chú", note),
    h("button", {type: "button", class: "btn primary block", onclick: doSave}, "Lưu")
  ];
  if (d) {
    const payAmt = moneyInput(debtLeft(d) > 0 ? debtLeft(d) : 0), payDate = h("input", {class: "input", type: "date", value: today()});
    kids.push(
      h("div", {class: "sec-title"}, "Đã trả " + money(d.amount - debtLeft(d)) + " · còn " + money(Math.max(0, debtLeft(d)))),
      d.pays.length ? h("div", {class: "list"}, d.pays.map((p, i) => h("div", {class: "li"},
        h("span", {class: "grow"}, dmy(p.date)), h("b", {class: "num"}, money(p.amount)),
        h("button", {type: "button", class: "link", style: {color: "var(--chi)"}, onclick: () => { d.pays.splice(i, 1); save(); debtSheet(d); }}, "Xoá")))) : null,
      h("div", {class: "grid2"}, field("Số tiền trả", payAmt), field("Ngày trả", payDate)),
      h("button", {type: "button", class: "btn block", onclick: () => {
        if (!payAmt.money()) return;
        d.pays.push({date: payDate.value || today(), amount: payAmt.money()});
        save(); render(); debtSheet(d); toast(debtLeft(d) <= 0 ? "Đã trả xong" : "Đã ghi lần trả");
      }}, "Ghi một lần trả"),
      confirmBtn("Xoá khoản nợ", "Chạm lần nữa để xoá", () => { S.debts = S.debts.filter(x => x !== d); save(); closeSheet(); render(); }));
  }
  openSheet(d ? "Khoản nợ" : "Ghi khoản nợ", h("div", {class: "stack"}, kids));
}

function bookGifts(box) {
  const y = today().slice(0, 4);
  const yr = S.gifts.filter(g => g.date.startsWith(y));
  const q = h("input", {class: "input", type: "search", placeholder: "Tìm theo tên người", autocomplete: "off", id: "giftQ"});
  const listBox = h("div", {class: "stack", style: {gap: "8px"}});
  function paint() {
    const nq = P.norm(q.value.trim());
    const people = {};
    for (const g of S.gifts) {
      if (nq && !P.norm(g.person).includes(nq)) continue;
      const k = P.norm(g.person);
      (people[k] = people[k] || {name: g.person, items: []}).items.push(g);
    }
    const groups = Object.values(people).map(p => {
      p.items.sort((a, b) => b.date.localeCompare(a.date));
      return p;
    }).sort((a, b) => b.items[0].date.localeCompare(a.items[0].date));
    listBox.replaceChildren(groups.length ? h("div", {class: "list"}, groups.map(p => {
      const di = p.items.filter(g => g.kind === "di").reduce((a, g) => a + g.amount, 0);
      const nh = p.items.filter(g => g.kind === "nhan").reduce((a, g) => a + g.amount, 0);
      const last = p.items[0];
      return h("button", {type: "button", class: "li", onclick: () => personGiftSheet(p.name)},
        h("span", {class: "cat-ic", style: {background: tint("#c2410c")}}, "🎁"),
        h("div", {class: "grow"}, h("div", {class: "bold ellipsis"}, p.name),
          h("div", {class: "small muted ellipsis"}, last.event + " · " + dmy(last.date))),
        h("div", {class: "small", style: {textAlign: "right"}},
          di ? h("div", {class: "chi num"}, "Mừng " + short(di)) : null,
          nh ? h("div", {class: "thu num"}, "Nhận " + short(nh)) : null));
    })) : h("div", {class: "empty"}, S.gifts.length ? "Không tìm thấy." : "Ghi lại các lần mừng cưới, đầy tháng, tân gia… để sau này đáp lễ cho đúng."));
  }
  q.addEventListener("input", paint);
  paint();
  box.append(
    h("div", {class: "kpis", style: {gridTemplateColumns: "1fr 1fr"}},
      h("div", {class: "kpi"}, h("span", null, "Đã mừng năm " + y), h("b", {class: "chi"}, short(yr.filter(g => g.kind === "di").reduce((a, g) => a + g.amount, 0))),
        h("i", {class: "muted"}, yr.filter(g => g.kind === "di").length + " lần")),
      h("div", {class: "kpi"}, h("span", null, "Đã nhận năm " + y), h("b", {class: "thu"}, short(yr.filter(g => g.kind === "nhan").reduce((a, g) => a + g.amount, 0))),
        h("i", {class: "muted"}, yr.filter(g => g.kind === "nhan").length + " lần"))),
    h("button", {type: "button", class: "btn primary block", onclick: () => giftSheet(null)}, "+ Ghi hiếu hỉ"),
    q, listBox);
}

function personGiftSheet(name) {
  const k = P.norm(name);
  const items = S.gifts.filter(g => P.norm(g.person) === k).sort((a, b) => b.date.localeCompare(a.date));
  openSheet(name, h("div", {class: "stack"},
    h("div", {class: "list"}, items.map(g => h("button", {type: "button", class: "li", onclick: () => giftSheet(g)},
      h("div", {class: "grow"}, h("div", {class: "bold"}, g.event), h("div", {class: "small muted"}, dmy(g.date) + (g.note ? " · " + g.note : ""))),
      h("b", {class: "num " + (g.kind === "di" ? "chi" : "thu")}, (g.kind === "di" ? "Mừng " : "Nhận ") + money(g.amount))))),
    h("button", {type: "button", class: "btn block", onclick: () => giftSheet(null, name)}, "+ Thêm lần mới với " + name)));
}

function giftSheet(g, presetName) {
  let kind = g ? g.kind : "di";
  const persons = [...new Set(S.gifts.map(x => x.person))];
  const dl = h("datalist", {id: "giftPeople"}, persons.map(p => h("option", {value: p})));
  const person = h("input", {class: "input", list: "giftPeople", value: g ? g.person : presetName || "", placeholder: "Tên người / gia đình", autocomplete: "off"});
  const hist = h("div", {class: "small muted"});
  const showHist = () => {
    const k = P.norm(person.value.trim());
    const past = k ? S.gifts.filter(x => x !== g && P.norm(x.person) === k).sort((a, b) => b.date.localeCompare(a.date)) : [];
    hist.replaceChildren(...(past.length ? ["Trước đây: ", past.slice(0, 3).map(x =>
      (x.kind === "di" ? "mình mừng " : "họ mừng mình ") + short(x.amount) + " (" + x.event + " " + x.date.slice(0, 4) + ")").join("; ")] : []));
  };
  person.addEventListener("input", showHist);
  const ev = h("select", {class: "input", value: g ? g.event : EVENTS[0]}, EVENTS.map(e => h("option", {value: e}, e)));
  const amt = moneyInput(g ? g.amount : 0);
  const date = h("input", {class: "input", type: "date", value: g ? g.date : today()});
  const note = h("input", {class: "input", value: g ? g.note : "", placeholder: "Ghi chú"});
  const linked = g && g.txId ? S.tx.find(t => t.id === g.txId) : null;
  const rec = h("input", {type: "checkbox", checked: g ? !!linked : true});
  let wallet = linked ? linked.wallet : S.settings.defaultWallet;
  const doSave = () => {
    if (!person.value.trim() || !amt.money()) { toast("Nhập tên và số tiền"); return; }
    const x = g || {id: uid()};
    Object.assign(x, {kind, person: person.value.trim(), event: ev.value, amount: amt.money(), date: date.value || today(), note: note.value.trim()});
    let t = x.txId ? S.tx.find(y => y.id === x.txId) : null;
    if (rec.checked) {
      if (!t) { t = {id: uid(), ts: Date.now()}; S.tx.push(t); x.txId = t.id; }
      Object.assign(t, {type: kind === "di" ? "chi" : "thu", cat: kind === "di" ? "hieuhi" : "duoccho", amount: x.amount,
                        wallet, to: null, date: x.date, note: x.event + " · " + x.person});
    } else if (t) { S.tx = S.tx.filter(y => y !== t); x.txId = null; }
    if (!g) S.gifts.push(x);
    save(); closeSheet(); render(); toast("Đã lưu");
  };
  openSheet(g ? "Sửa hiếu hỉ" : "Ghi hiếu hỉ", h("div", {class: "stack"},
    segCtl([["di", "Mình đi mừng"], ["nhan", "Mình được mừng"]], kind, k => { kind = k; }),
    field("Người", person), dl, hist,
    h("div", {class: "grid2"}, field("Dịp", ev), field("Ngày", date)),
    field("Số tiền", amt), field("Ghi chú", note),
    h("label", {class: "check"}, rec, "Ghi vào chi tiêu / thu nhập"),
    field("Ví", walletSel(wallet, v => { wallet = v; })),
    h("button", {type: "button", class: "btn primary block", onclick: doSave}, "Lưu"),
    g ? confirmBtn("Xoá", "Chạm lần nữa để xoá", () => {
      S.gifts = S.gifts.filter(x => x !== g);
      if (g.txId) S.tx = S.tx.filter(t => t.id !== g.txId);
      save(); closeSheet(); render();
    }) : null));
  showHist();
}

function bookGoals(box) {
  const t = today();
  box.append(h("button", {type: "button", class: "btn primary block", onclick: () => goalSheet(null)}, "+ Thêm mục tiêu"));
  if (!S.goals.length) box.append(h("div", {class: "empty"}, "Chưa có mục tiêu tiết kiệm nào."));
  for (const g of S.goals) {
    const saved = g.moves.reduce((a, m) => a + m.amount, 0);
    const pct = g.target ? Math.min(100, saved / g.target * 100) : 0;
    const left = Math.max(0, g.target - saved);
    const days = g.deadline ? daysBetween(t, g.deadline) : null;
    let pace = "";
    if (left <= 0) pace = "Đã đạt mục tiêu 🎉";
    else if (days != null && days > 0) pace = "Còn " + days + " ngày · cần " + money(left / days) + "/ngày (" + short(left / Math.max(1, days / 30)) + "/tháng)";
    else if (days != null) pace = "Đã quá hạn, còn thiếu " + money(left);
    box.append(h("div", {class: "card stack", style: {gap: "10px"}},
      h("button", {type: "button", class: "row", style: {background: "none", border: 0, padding: 0, textAlign: "left"}, onclick: () => goalSheet(g)},
        h("span", {class: "cat-ic", style: {background: tint("#d99a2b")}}, g.icon),
        h("div", {class: "grow"}, h("div", {class: "bold"}, g.name), h("div", {class: "small muted"}, g.deadline ? "Hạn " + dmy(g.deadline) : "Không đặt hạn")),
        h("span", {class: "muted"}, "›")),
      h("div", {class: "row between"}, h("b", {class: "num", style: {fontSize: "18px"}}, money(saved)), h("span", {class: "muted num small"}, "/ " + money(g.target))),
      h("div", {class: "bar " + (pct >= 100 ? "ok" : "")}, h("i", {style: {width: pct + "%", background: pct >= 100 ? "" : "var(--gold)"}})),
      h("div", {class: "small muted"}, pace),
      h("div", {class: "grid2"},
        h("button", {type: "button", class: "btn sm", onclick: () => goalMoveSheet(g, 1)}, "+ Bỏ thêm"),
        h("button", {type: "button", class: "btn sm", onclick: () => goalMoveSheet(g, -1)}, "− Rút ra"))));
  }
  box.append(h("p", {class: "tiny muted", style: {margin: "0 4px"}}, "Mục tiêu theo dõi riêng, không trừ vào ví. Nếu để tiền ở tài khoản tiết kiệm, có thể tạo một ví riêng rồi chuyển tiền vào ví đó."));
}

function goalSheet(g) {
  const name = h("input", {class: "input", value: g ? g.name : "", placeholder: "VD: Quỹ Tết, Mua xe"});
  const icon = h("input", {class: "input", value: g ? g.icon : "🎯", maxlength: 4});
  const target = moneyInput(g ? g.target : 0);
  const dl = h("input", {class: "input", type: "date", value: g ? g.deadline || "" : ""});
  const doSave = () => {
    if (!name.value.trim() || !target.money()) { toast("Nhập tên và số tiền cần có"); return; }
    const x = g || {id: uid(), moves: []};
    Object.assign(x, {name: name.value.trim(), icon: icon.value.trim() || "🎯", target: target.money(), deadline: dl.value || null});
    if (!g) S.goals.push(x);
    save(); closeSheet(); render();
  };
  openSheet(g ? "Sửa mục tiêu" : "Mục tiêu mới", h("div", {class: "stack"},
    h("div", {class: "grid2"}, field("Tên", name), field("Biểu tượng", icon)),
    field("Số tiền cần có", target), field("Hạn", dl),
    h("button", {type: "button", class: "btn primary block", onclick: doSave}, "Lưu"),
    g && g.moves.length ? h("div", {class: "sec-title"}, "Lịch sử") : null,
    g && g.moves.length ? h("div", {class: "list"}, g.moves.slice().reverse().map(m => h("div", {class: "li"},
      h("div", {class: "grow"}, dmy(m.date), m.note ? h("div", {class: "small muted"}, m.note) : null),
      h("b", {class: "num " + (m.amount < 0 ? "chi" : "thu")}, (m.amount < 0 ? "−" : "+") + money(Math.abs(m.amount)))))) : null,
    g ? confirmBtn("Xoá mục tiêu", "Chạm lần nữa để xoá", () => { S.goals = S.goals.filter(x => x !== g); save(); closeSheet(); render(); }) : null));
}

function goalMoveSheet(g, dir) {
  const amt = moneyInput(0), date = h("input", {class: "input", type: "date", value: today()});
  const note = h("input", {class: "input", placeholder: "Ghi chú"});
  openSheet((dir > 0 ? "Bỏ thêm vào " : "Rút từ ") + g.name, h("div", {class: "stack"},
    field("Số tiền", amt), h("div", {class: "grid2"}, field("Ngày", date), field("Ghi chú", note)),
    h("button", {type: "button", class: "btn primary block", onclick: () => {
      if (!amt.money()) return;
      g.moves.push({date: date.value || today(), amount: dir * amt.money(), note: note.value.trim()});
      save(); closeSheet(); render(); toast("Đã ghi");
    }}, "Lưu")));
  setTimeout(() => amt.focus(), 300);
}

function bookJars(box) {
  const mk = mkOf(today()), list = txIn(mk);
  const thu = sum(list, "thu"), pct = S.settings.jars;
  const spent = {};
  for (const t of list) if (t.type === "chi") { const j = cat(t.cat).jar || "nec"; spent[j] = (spent[j] || 0) + t.amount; }
  box.append(h("div", {class: "card"}, h("h3", null, "Thu nhập " + monthLabel(mk).toLowerCase()),
    h("div", {class: "wallet-bal thu", style: {fontSize: "24px"}}, money(thu)),
    h("p", {class: "small muted", style: {margin: "6px 0 0"}}, thu ? "Chia theo phương pháp 6 chiếc hũ. Đổi tỉ lệ trong Cài đặt." :
      "Chưa có thu nhập tháng này. Ghi khoản Lương để app chia vào 6 hũ.")));
  box.append(h("div", {class: "card stack", style: {gap: "14px"}}, JARS.map(([id, name, icon, color]) => {
    const alloc = thu * (pct[id] || 0) / 100, s = spent[id] || 0;
    const r = alloc ? s / alloc : (s ? 2 : 0);
    return h("div", {class: "jar"},
      h("span", {class: "cat-ic", style: {background: tint(color)}}, icon),
      h("div", {class: "stack", style: {gap: "5px"}},
        h("div", {class: "row between"}, h("b", null, name + " · " + (pct[id] || 0) + "%"), h("span", {class: "num small"}, short(s) + " / " + short(alloc))),
        h("div", {class: "bar " + (r > 1 ? "over" : r > 0.8 ? "mid" : "ok")}, h("i", {style: {width: Math.min(100, r * 100) + "%"}})),
        h("div", {class: "tiny muted"}, alloc - s >= 0 ? "Còn " + money(alloc - s) : "Vượt " + money(s - alloc))));
  })));
  box.append(h("p", {class: "tiny muted", style: {margin: "0 4px"}}, "Mỗi danh mục chi thuộc một hũ (sửa trong Cài đặt › Danh mục). Hũ Tự do tài chính và Tiết kiệm dài hạn thường là tiền để dành, không tiêu."));
}

function bookSplit(box) {
  const sp = S.split;
  const rowsBox = h("div", {class: "stack", style: {gap: "8px"}});
  const result = h("div", {class: "stack"});
  function compute() {
    const people = sp.people.filter(p => p.name.trim() || p.paid);
    const total = people.reduce((a, p) => a + p.paid, 0);
    if (people.length < 2 || !total) { result.replaceChildren(h("div", {class: "empty"}, "Nhập ít nhất 2 người và số tiền mỗi người đã trả.")); return; }
    const share = total / people.length;
    const round = v => share >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v);
    const cred = [], debt = [];
    people.forEach((p, i) => { const b = p.paid - share; const nm = p.name.trim() || "Người " + (i + 1); if (b > 0.5) cred.push({nm, b}); else if (b < -0.5) debt.push({nm, b: -b}); });
    const moves = [];
    let i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      const x = Math.min(debt[i].b, cred[j].b);
      moves.push([debt[i].nm, cred[j].nm, x]);
      debt[i].b -= x; cred[j].b -= x;
      if (debt[i].b < 0.5) i++;
      if (cred[j].b < 0.5) j++;
    }
    const text = "Tổng " + money(total) + ", mỗi người " + money(round(share)) + "\n" + moves.map(m => m[0] + " trả " + m[1] + " " + money(round(m[2]))).join("\n");
    const me = sp.people[0];
    result.replaceChildren(
      h("div", {class: "card"},
        h("div", {class: "row between"}, h("span", {class: "muted"}, "Tổng"), h("b", {class: "num"}, money(total))),
        h("div", {class: "row between"}, h("span", {class: "muted"}, "Mỗi người"), h("b", {class: "num"}, money(round(share))))),
      moves.length ? h("div", {class: "list"}, moves.map(m => h("div", {class: "li"},
        h("span", {class: "grow"}, h("b", null, m[0]), " trả ", h("b", null, m[1])), h("b", {class: "num"}, money(round(m[2])))))) :
        h("div", {class: "empty"}, "Mọi người đã trả đều nhau."),
      h("div", {class: "grid2"},
        h("button", {type: "button", class: "btn", onclick: () => {
          navigator.clipboard.writeText(text).then(() => toast("Đã chép, dán vào Zalo để gửi nhóm"), () => toast("Không chép được"));
        }}, "📋 Chép kết quả"),
        h("button", {type: "button", class: "btn primary", onclick: () => {
          S.tx.push({id: uid(), ts: Date.now(), type: "chi", amount: round(share), cat: sp.cat || "an", wallet: S.settings.defaultWallet, to: null,
                     date: today(), note: "Chia tiền nhóm (" + people.length + " người)"});
          save(); toast("Đã ghi phần của " + (me.name || "bạn") + ": " + money(round(share)));
        }}, "Ghi phần của tôi")),
      field("Danh mục khi ghi", catSel("chi", sp.cat || "an", v => { sp.cat = v; save(); })));
  }
  function paintRows() {
    rowsBox.replaceChildren(...sp.people.map((p, i) => {
      const nm = h("input", {class: "input", value: p.name, placeholder: i === 0 ? "Tôi" : "Tên", autocomplete: "off"});
      nm.addEventListener("input", () => { p.name = nm.value; save(); compute(); });
      const pd = moneyInput(p.paid);
      pd.addEventListener("input", () => { p.paid = pd.money(); save(); compute(); });
      return h("div", {class: "row"}, h("div", {class: "grow"}, nm), h("div", {class: "grow"}, pd),
        h("button", {type: "button", class: "icon-btn", "aria-label": "Bỏ người này", disabled: sp.people.length <= 2,
          onclick: () => { sp.people.splice(i, 1); save(); paintRows(); compute(); }}, "×"));
    }));
  }
  paintRows(); compute();
  box.append(
    h("div", {class: "row between small muted", style: {padding: "0 4px"}}, h("span", null, "Tên"), h("span", null, "Đã trả"), h("span", {style: {width: "36px"}})),
    rowsBox,
    h("div", {class: "grid2"},
      h("button", {type: "button", class: "btn", onclick: () => { sp.people.push({name: "", paid: 0}); save(); paintRows(); }}, "+ Thêm người"),
      h("button", {type: "button", class: "btn", onclick: () => { S.split = {people: [{name: "Tôi", paid: 0}, {name: "", paid: 0}], cat: sp.cat}; save(); renderBook(); }}, "Làm lại")),
    h("div", {class: "sec-title"}, "Kết quả"), result);
}

// Danh sách đi chợ: món đã tick gộp thành một khoản chi "Đi chợ".
function shopPrice(text) {
  // "thịt ba chỉ 120k" -> 120000; "sữa 32.000" -> 32000; "2 hộp sữa" -> không có giá
  let m = text.match(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|ng)(?![\p{L}])/iu);
  if (m) return {name: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim(), price: Math.round(P.toNum(m[1]) * 1000)};
  m = text.match(/(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(đ|d|vnd)?\s*$/i);
  if (m) return {name: text.slice(0, m.index).trim(), price: P.toNum(m[1])};
  return {name: text.trim(), price: 0};
}
function bookShop(box) {
  const sh = S.shop;
  const inp = h("input", {class: "input", id: "shopIn", placeholder: "Thêm món: thịt ba chỉ 120k", autocomplete: "off", enterkeyhint: "done"});
  const listBox = h("div", {class: "stack", style: {gap: "10px"}});
  const addItem = (name, price) => {
    name = name.trim();
    if (!name) return;
    sh.items.push({id: uid(), name, price: price || 0, done: false});
    const k = P.norm(name), s = sh.seen[k] || {name, price: 0, n: 0};
    s.n++; s.name = name; if (price) s.price = price;
    sh.seen[k] = s;
    save(); paint();
  };
  const submit = () => {
    const r = shopPrice(inp.value);
    addItem(r.name || inp.value, r.price);
    inp.value = ""; inp.focus();
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } });

  function paint() {
    const todo = sh.items.filter(i => !i.done), done = sh.items.filter(i => i.done);
    const est = sh.items.reduce((a, i) => a + (i.price || 0), 0);
    const doneSum = done.reduce((a, i) => a + (i.price || 0), 0);
    const row = it => {
      const price = moneyInput(it.price);
      Object.assign(price.style, {maxWidth: "112px", textAlign: "right", padding: "6px 10px"});
      price.setAttribute("aria-label", "Giá " + it.name);
      price.addEventListener("change", () => {
        it.price = price.money();
        const s = sh.seen[P.norm(it.name)];
        if (s && it.price) s.price = it.price;
        save(); paint();
      });
      return h("div", {class: "li shop" + (it.done ? " done" : "")},
        h("input", {type: "checkbox", checked: it.done, "aria-label": "Đã mua " + it.name,
                    onchange: e => { it.done = e.target.checked; save(); paint(); }}),
        h("span", {class: "grow"}, it.name), price,
        h("button", {type: "button", class: "icon-btn", "aria-label": "Bỏ " + it.name,
                     onclick: () => { sh.items = sh.items.filter(x => x !== it); save(); paint(); }}, "×"));
    };
    const inList = new Set(sh.items.map(i => P.norm(i.name)));
    const sugg = Object.entries(sh.seen).filter(([k]) => !inList.has(k)).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    fill(listBox,
      sugg.length ? h("div", {class: "favs"}, sugg.map(([, s]) => h("button", {type: "button", class: "fav", onclick: () => addItem(s.name, s.price)},
        h("span", null, "+"), h("span", {class: "fav-n"}, s.name), s.price ? h("b", {class: "num"}, short(s.price)) : null))) : null,
      sh.items.length ? h("div", {class: "list"}, todo.map(row), done.map(row))
        : h("div", {class: "empty"}, "Danh sách trống. Thêm món cần mua ở ô trên, giá có thể để trống rồi điền sau."),
      sh.items.length ? h("div", {class: "row between small muted", style: {padding: "0 4px"}},
        h("span", null, todo.length + " món chưa mua"), h("span", null, "Dự kiến " + money(est))) : null,
      done.length ? h("button", {type: "button", class: "btn primary block", onclick: () => {
        const names = done.map(i => i.name).join(", ");
        txSheet(null, {type: "chi", cat: "cho", amount: doneSum, note: names.length > 60 ? names.slice(0, 57) + "…" : names},
          () => { sh.items = sh.items.filter(i => !i.done); });
      }}, "Ghi " + done.length + " món đã mua vào chi tiêu" + (doneSum ? " (" + short(doneSum) + ")" : "")) : null,
      done.length ? confirmBtn("Bỏ các món đã mua", "Chạm lần nữa để bỏ", () => {
        sh.items = sh.items.filter(i => !i.done); save(); paint();
      }, "btn block") : null);
  }
  paint();
  box.append(h("div", {class: "quick"}, inp, h("button", {type: "button", class: "btn primary", onclick: submit}, "Thêm")), listBox);
}

// ---------- Tab Cài đặt ----------
function renderSettings() {
  const v = $("v-settings"), st = S.settings;
  setActions(h("button", {class: "icon-btn", type: "button", "aria-label": "Về Tiện ích", onclick: () => setTab("tools")}, "‹"));
  const card = (title, ...kids) => h("div", {class: "card stack"}, h("h3", {style: {margin: 0}}, title), kids);

  // Hạn mức
  const spent = byCat(txIn(mkOf(today())), "chi");
  const total = moneyInput(st.budget.total, "budTotal");
  total.addEventListener("change", () => { st.budget.total = total.money(); save(); toast("Đã lưu hạn mức"); });
  const catLims = catsOf("chi").map(c => {
    const inp = moneyInput(st.budget.cats[c.id] || 0, "bud-" + c.id);
    inp.style.maxWidth = "130px"; inp.style.textAlign = "right";
    inp.addEventListener("change", () => { const n = inp.money(); if (n) st.budget.cats[c.id] = n; else delete st.budget.cats[c.id]; save(); });
    return h("div", {class: "row"}, catIcon(c),
      h("div", {class: "grow"}, h("div", {class: "ellipsis"}, c.name), h("div", {class: "tiny muted"}, "tháng này " + short(spent[c.id] || 0))), inp);
  });
  const sumCats = Object.values(st.budget.cats).reduce((a, b) => a + b, 0);
  const budCard = card("Hạn mức chi tiêu",
    field("Hạn mức cả tháng", total),
    h("p", {class: "tiny muted", style: {margin: 0}}, "Dùng để tính “Hôm nay còn được tiêu bao nhiêu”. Để trống nếu không cần."),
    h("details", null, h("summary", {class: "bold", style: {cursor: "pointer", padding: "4px 0"}}, "Hạn mức theo danh mục" + (sumCats ? " (tổng " + short(sumCats) + ")" : "")),
      h("div", {class: "stack", style: {marginTop: "10px"}}, catLims)));

  // Danh mục
  const catList = h("div", {class: "list", style: {boxShadow: "none", border: "1px solid var(--line)"}},
    S.cats.filter(c => c.type === ui.catType).map(c => h("button", {type: "button", class: "li", onclick: () => catSheet(c)},
      catIcon(c), h("div", {class: "grow"}, h("div", null, c.name, c.hidden ? h("span", {class: "pill", style: {marginLeft: "6px"}}, "đang ẩn") : null),
        c.type === "chi" ? h("div", {class: "tiny muted"}, "Hũ: " + (JARS.find(j => j[0] === c.jar) || JARS[0])[1]) : null),
      h("span", {class: "muted"}, "›"))));
  const catCard = card("Danh mục",
    segCtl([["chi", "Chi"], ["thu", "Thu"]], ui.catType, x => { ui.catType = x; renderSettings(); }),
    catList,
    h("button", {type: "button", class: "btn block", onclick: () => catSheet(null)}, "+ Thêm danh mục"));

  // Cố định hằng tháng
  const recCard = card("Khoản cố định hằng tháng",
    h("p", {class: "tiny muted", style: {margin: 0}}, "Tiền nhà, internet, Netflix, trả góp… App tự ghi vào đúng ngày mỗi tháng."),
    S.recurring.length ? h("div", {class: "list", style: {boxShadow: "none", border: "1px solid var(--line)"}}, S.recurring.map(r => {
      const c = r.type === "chuyen" ? {icon: "⇄", color: "#0e7468", name: "Chuyển tiền"} : cat(r.cat);
      return h("button", {type: "button", class: "li", onclick: () => recurSheet(r)}, catIcon(c),
        h("div", {class: "grow"}, h("div", {class: "ellipsis"}, r.note || c.name),
          h("div", {class: "tiny muted"}, r.on ? "Ngày " + r.day + " hằng tháng · lần tới " + dmy(r.next) : "Đang tắt")),
        h("b", {class: "num " + r.type}, sign(r.type) + short(r.amount)));
    })) : null,
    h("button", {type: "button", class: "btn block", onclick: () => recurSheet(null)}, "+ Thêm khoản cố định"));

  // Nhắc ghi chi tiêu
  const remindCard = card("Nhắc ghi chi tiêu",
    h("p", {class: "small muted", style: {margin: 0}}, "App trên màn hình chính không tự gửi thông báo được. Dùng app Lời nhắc có sẵn của iPhone:"),
    h("ol", {class: "steps"},
      h("li", null, "Mở app ", h("b", null, "Lời nhắc"), ", tạo lời nhắc mới “Ghi chi tiêu”."),
      h("li", null, "Chạm ", h("b", null, "ⓘ"), ", bật ", h("b", null, "Ngày"), " và ", h("b", null, "Giờ"), ", chọn 21:00."),
      h("li", null, "Ở ", h("b", null, "Lặp lại"), " chọn ", h("b", null, "Hằng ngày"), ", rồi bấm ", h("b", null, "Xong"), ".")),
    h("p", {class: "tiny muted", style: {margin: 0}}, "Sau 20 giờ, nếu hôm đó chưa ghi khoản nào, màn Hôm nay cũng nhắc bạn."));

  // 6 hũ
  const jarInputs = JARS.map(([id, name, icon]) => {
    const inp = h("input", {class: "input num", inputmode: "numeric", value: String(st.jars[id] || 0), style: {maxWidth: "76px", textAlign: "right"}});
    inp.addEventListener("change", () => { st.jars[id] = Math.max(0, Math.min(100, Number(inp.value.replace(/\D/g, "")) || 0)); save(); renderSettings(); });
    return h("div", {class: "row"}, h("span", null, icon), h("span", {class: "grow"}, name), inp, h("span", {class: "muted"}, "%"));
  });
  const jarSum = JARS.reduce((a, j) => a + (st.jars[j[0]] || 0), 0);
  const jarCard = card("6 chiếc hũ",
    h("details", null, h("summary", {class: "bold", style: {cursor: "pointer", padding: "4px 0"}}, "Tỉ lệ chia thu nhập"),
      h("div", {class: "stack", style: {marginTop: "10px"}}, jarInputs,
        h("div", {class: "small " + (jarSum === 100 ? "thu" : "chi")}, "Tổng " + jarSum + "%" + (jarSum === 100 ? "" : " (nên bằng 100%)")))));

  // Bảo mật, giao diện
  const lockSel = h("select", {class: "input", value: String(st.lockAfter), onchange: e => { st.lockAfter = Number(e.target.value); save(); }},
    [["0", "Ngay khi rời app"], ["60", "Sau 1 phút"], ["300", "Sau 5 phút"], ["1800", "Sau 30 phút"]].map(([k, l]) => h("option", {value: k}, l)));
  const secCard = card("Bảo mật",
    st.pinHash ? h("div", {class: "stack"},
      h("div", {class: "row between"}, h("span", null, "🔒 Đang bật khoá PIN"), h("button", {type: "button", class: "btn sm", onclick: setPin}, "Đổi mã")),
      field("Khoá lại", lockSel),
      confirmBtn("Tắt khoá PIN", "Chạm lần nữa để tắt", () => { st.pinHash = null; st.pinSalt = null; save(); renderSettings(); toast("Đã tắt khoá PIN"); }, "btn block"))
      : h("button", {type: "button", class: "btn block", onclick: setPin}, "🔒 Đặt mã PIN 4 số"));
  const looksCard = card("Giao diện",
    segCtl([["auto", "Theo máy"], ["light", "Sáng"], ["dark", "Tối"]], st.theme, k => { st.theme = k; applyTheme(); save(); }),
    field("Ví mặc định khi ghi", walletSel(st.defaultWallet, x => { st.defaultWallet = x; save(); })));

  // Dữ liệu
  const restoreIn = h("input", {type: "file", accept: "application/json,.json", hidden: true, onchange: e => { const f = e.target.files[0]; if (f) restoreSheet(f); e.target.value = ""; }});
  const dataCard = card("Dữ liệu",
    h("p", {class: "small muted", style: {margin: 0}},
      "Dữ liệu chỉ nằm trên iPhone này (" + S.tx.length + " khoản). Nếu xoá app khỏi màn hình chính hoặc xoá dữ liệu Safari thì sẽ mất, nên hãy sao lưu thường xuyên ra iCloud Drive hoặc Zalo. ",
      st.lastBackup ? "Lần sao lưu cuối: " + dmy(st.lastBackup) + "." : "Chưa sao lưu lần nào."),
    h("div", {class: "grid2"},
      h("button", {type: "button", class: "btn primary", onclick: backup}, "Sao lưu"),
      h("button", {type: "button", class: "btn", onclick: () => restoreIn.click()}, "Khôi phục")),
    restoreIn,
    h("button", {type: "button", class: "btn block", onclick: () => exportCSV(S.tx, "chi-tieu-tat-ca-" + today() + ".csv")}, "Xuất Excel (CSV) toàn bộ"),
    confirmBtn("Xoá toàn bộ dữ liệu", "Chạm lần nữa: xoá hết, không lấy lại được", async () => {
      S = freshState(); if (Store.db) await Store.clear("photos"); await flush(); applyTheme(); render(); toast("Đã xoá toàn bộ dữ liệu");
    }));

  const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  const installCard = standalone ? null : card("Cài lên iPhone",
    h("ol", {class: "steps"},
      h("li", null, "Mở trang này bằng ", h("b", null, "Safari"), "."),
      h("li", null, "Bấm nút ", h("b", null, "Chia sẻ"), " (ô vuông có mũi tên lên)."),
      h("li", null, "Chọn ", h("b", null, "Thêm vào MH chính"), " › ", h("b", null, "Thêm"), "."),
      h("li", null, "Mở app từ icon trên màn hình chính. App chạy toàn màn hình và dùng được khi không có mạng.")),
    h("p", {class: "tiny warn", style: {margin: 0}}, "Lưu ý: dữ liệu trong Safari và trong app ở màn hình chính là hai nơi riêng. Hãy cài xong rồi mới bắt đầu ghi."));

  fill(v, installCard, budCard, catCard, recCard, remindCard, jarCard, secCard, looksCard, dataCard,
    h("p", {class: "tiny muted", style: {textAlign: "center"}}, "Sổ Chi Tiêu " + VERSION + " · dữ liệu không rời khỏi máy"));
}

function catSheet(c) {
  const type = c ? c.type : ui.catType;
  const name = h("input", {class: "input", value: c ? c.name : "", placeholder: "Tên danh mục"});
  const icon = h("input", {class: "input", value: c ? c.icon : "🏷️", maxlength: 4});
  const color = h("input", {class: "input", type: "color", value: c ? c.color : "#0e7468", style: {height: "44px", padding: "4px"}});
  const jar = type === "chi" ? h("select", {class: "input", value: c ? c.jar || "nec" : "nec"}, JARS.map(([id, nm, ic]) => h("option", {value: id}, ic + " " + nm))) : null;
  const kws = h("textarea", {class: "input", rows: 3, placeholder: "VD: phở, bún, cơm tấm"});
  kws.value = c ? (c.keywords || []).join(", ") : "";
  const hidden = h("input", {type: "checkbox", checked: c ? !!c.hidden : false});
  const used = c ? S.tx.filter(t => t.cat === c.id).length : 0;
  const doSave = () => {
    if (!name.value.trim()) { toast("Nhập tên danh mục"); return; }
    const x = c || {id: uid(), type};
    Object.assign(x, {name: name.value.trim(), icon: icon.value.trim() || "🏷️", color: color.value, jar: jar ? jar.value : null,
                      keywords: kws.value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean), hidden: hidden.checked});
    if (!c) S.cats.push(x);
    save(); closeSheet(); render();
  };
  openSheet(c ? "Sửa danh mục" : "Danh mục " + (type === "chi" ? "chi" : "thu") + " mới", h("div", {class: "stack"},
    h("div", {class: "grid2"}, field("Tên", name), field("Biểu tượng (emoji)", icon)),
    h("div", {class: "grid2"}, field("Màu", color), jar ? field("Thuộc hũ", jar) : h("span")),
    field("Từ khoá để tự nhận (cách nhau bằng dấu phẩy)", kws),
    h("label", {class: "check"}, hidden, "Ẩn khỏi danh sách khi ghi"),
    h("button", {type: "button", class: "btn primary block", onclick: doSave}, "Lưu"),
    c && !used && !["khac", "thukhac"].includes(c.id) ? confirmBtn("Xoá danh mục", "Chạm lần nữa để xoá", () => {
      S.cats = S.cats.filter(x => x !== c); delete S.settings.budget.cats[c.id]; save(); closeSheet(); render();
    }) : c && used ? h("p", {class: "tiny muted"}, "Đã có " + used + " khoản dùng danh mục này nên không xoá được. Có thể ẩn đi.") : null));
}

function recurSheet(r) {
  const d = Object.assign({type: "chi", amount: 0, cat: "nha", wallet: S.settings.defaultWallet, to: null, note: "", day: Number(today().slice(8)), on: true}, r || {});
  const amt = moneyInput(d.amount);
  const catBox = h("div");
  const paintCat = () => {
    if (d.type === "chuyen") {
      if (!d.to || d.to === d.wallet) d.to = otherWallet(d.wallet);
      catBox.replaceChildren(field("Sang ví", walletSel(d.to, v => { d.to = v; })));
      return;
    }
    if (cat(d.cat).type !== d.type || !S.cats.some(c => c.id === d.cat)) d.cat = catsOf(d.type)[0].id;
    catBox.replaceChildren(field("Danh mục", catSel(d.type, d.cat, v => { d.cat = v; })));
  };
  const day = h("input", {class: "input num", type: "number", min: "1", max: "31", inputmode: "numeric", value: String(d.day)});
  const next = h("input", {class: "input", type: "date", value: r ? r.next : ""});
  const note = h("input", {class: "input", value: d.note, placeholder: "VD: Tiền nhà, Netflix"});
  const on = h("input", {type: "checkbox", checked: d.on});
  const doSave = () => {
    const dd = Math.max(1, Math.min(31, Number(day.value) || 1));
    if (!amt.money()) { toast("Nhập số tiền"); return; }
    const x = r || {id: uid()};
    let nx = next.value;
    if (!nx || (r && dd !== r.day && next.value === r.next)) {
      const t = today(), thisMonth = addMonthsDay(t, 0, dd);
      nx = thisMonth > t ? thisMonth : addMonthsDay(t, 1, dd);
    }
    Object.assign(x, {type: d.type, amount: amt.money(), cat: d.type === "chuyen" ? null : d.cat, wallet: d.wallet,
                      to: d.type === "chuyen" ? d.to : null, note: note.value.trim(), day: dd, next: nx, on: on.checked});
    if (!r) S.recurring.push(x);
    save(); runRecurring(); closeSheet(); render(); toast("Đã lưu khoản cố định");
  };
  paintCat();
  openSheet(r ? "Khoản cố định" : "Thêm khoản cố định", h("div", {class: "stack"},
    segCtl([["chi", "Chi"], ["thu", "Thu"], ["chuyen", "Chuyển ví"]], d.type, k => { d.type = k; paintCat(); }),
    field("Số tiền", amt), field("Tên / ghi chú", note), catBox,
    field(d.type === "chuyen" ? "Từ ví" : "Ví", walletSel(d.wallet, v => { d.wallet = v; })),
    h("div", {class: "grid2"}, field("Ngày trong tháng", day), field("Lần tới", next)),
    h("p", {class: "tiny muted", style: {margin: 0}}, "Tháng nào ít ngày hơn thì ghi vào ngày cuối tháng. Để trống “Lần tới” để app tự tính."),
    h("label", {class: "check"}, on, "Đang bật"),
    h("button", {type: "button", class: "btn primary block", onclick: doSave}, "Lưu"),
    r ? confirmBtn("Xoá khoản cố định", "Chạm lần nữa để xoá", () => { S.recurring = S.recurring.filter(x => x !== r); save(); closeSheet(); render(); }) : null));
}

function runRecurring() {
  const t = today();
  let n = 0;
  for (const r of S.recurring) {
    if (!r.on || !r.next) continue;
    let guard = 0;
    while (r.next <= t && guard++ < 36) {
      S.tx.push({id: uid(), ts: Date.now() + n, type: r.type, amount: r.amount, cat: r.cat, wallet: r.wallet,
                 to: r.to || null, date: r.next, note: r.note || "Khoản cố định", rec: r.id});
      n++;
      r.next = addMonthsDay(r.next, 1, r.day);
    }
  }
  if (n) { save(); ui.recurNote = "Đã tự ghi " + n + " khoản cố định hằng tháng"; }
}

// ---------- Sao lưu, xuất file ----------
async function shareFile(name, blob) {
  const file = new File([blob], name, {type: blob.type});
  if (navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: name}); return true; }
    catch (e) { if (e.name === "AbortError") return false; }
  }
  const a = h("a", {href: URL.createObjectURL(blob), download: name});
  document.body.append(a); a.click(); a.remove();
  return true;
}
function blobToDataURL(b) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
}
async function backup() {
  const photos = {};
  try {
    if (Store.db) for (const k of await Store.keys("photos")) { const b = await Store.get("photos", k); if (b) photos[k] = await blobToDataURL(b); }
  } catch (e) { /* vẫn sao lưu phần còn lại */ }
  const data = {app: "so-chi-tieu", v: 1, exported: new Date().toISOString(), state: S, photos};
  const ok = await shareFile("chi-tieu-" + today() + ".json", new Blob([JSON.stringify(data)], {type: "application/json"}));
  if (ok) { S.settings.lastBackup = today(); save(); render(); toast("Đã tạo bản sao lưu"); }
}
async function restoreSheet(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast("File không đọc được"); return; }
  if (!data || data.app !== "so-chi-tieu" || !data.state || !Array.isArray(data.state.tx)) { toast("Đây không phải file sao lưu của Sổ Chi Tiêu"); return; }
  openSheet("Khôi phục", h("div", {class: "stack"},
    h("p", null, "Bản sao lưu ngày ", h("b", null, data.exported ? dmy(data.exported.slice(0, 10)) : "?"), " có ",
      h("b", null, data.state.tx.length + " khoản"), ". Khôi phục sẽ ", h("b", null, "thay toàn bộ"), " dữ liệu hiện tại (" + S.tx.length + " khoản)."),
    confirmBtn("Khôi phục", "Chạm lần nữa để thay dữ liệu", async () => {
      S = migrate(data.state);
      if (Store.db) {
        await Store.clear("photos");
        for (const [k, url] of Object.entries(data.photos || {})) { try { await Store.put("photos", k, await (await fetch(url)).blob()); } catch (e) { /* bỏ ảnh lỗi */ } }
      }
      await flush(); applyTheme(); closeSheet(); render(); toast("Đã khôi phục " + S.tx.length + " khoản");
    }, "btn primary block")));
}
function exportCSV(list, name) {
  if (!list.length) { toast("Không có khoản nào để xuất"); return; }
  const esc = s => { s = String(s == null ? "" : s); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const TYPE = {chi: "Chi", thu: "Thu", chuyen: "Chuyển ví"};
  const lines = [["Ngày", "Loại", "Danh mục", "Ví", "Sang ví", "Số tiền", "Thu(+)/Chi(-)", "Ghi chú"].join(",")];
  for (const t of sortTx(list).reverse()) {
    lines.push([dmy(t.date), TYPE[t.type], t.cat ? cat(t.cat).name : "", wal(t.wallet).name, t.to ? wal(t.to).name : "",
                t.amount, t.type === "chi" ? -t.amount : t.type === "thu" ? t.amount : 0, t.note].map(esc).join(","));
  }
  shareFile(name, new Blob(["﻿" + lines.join("\r\n")], {type: "text/csv"}));
}

// ---------- Khoá PIN ----------
async function hashPin(pin, salt) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return P.hash(salt + ":" + pin);
}
function pinPad(title, onDone, cancellable) {
  let code = "";
  $("lockMsg").textContent = title;
  const dots = $("pinDots");
  const paint = () => Array.from(dots.children).forEach((d, i) => d.classList.toggle("f", i < code.length));
  $("pinpad").replaceChildren(...["1", "2", "3", "4", "5", "6", "7", "8", "9", cancellable ? "Huỷ" : "", "0", "⌫"].map(k =>
    h("button", {type: "button", class: k === "⌫" || k.length > 1 || !k ? "ghost" : "", disabled: !k, "aria-label": k === "⌫" ? "Xoá" : k, onclick: () => {
      if (k === "Huỷ") { $("lock").hidden = true; return; }
      if (k === "⌫") { code = code.slice(0, -1); paint(); return; }
      if (code.length >= 4) return;
      code += k; paint();
      if (code.length === 4) setTimeout(async () => {
        const c = code;
        if (!(await onDone(c))) { code = ""; paint(); dots.classList.remove("shake"); void dots.offsetWidth; dots.classList.add("shake"); }
      }, 120);
    }}, k)));
  paint();
  $("lock").hidden = false;
}
function unlock() {
  pinPad("Nhập mã PIN", async c => {
    if (await hashPin(c, S.settings.pinSalt) === S.settings.pinHash) { $("lock").hidden = true; return true; }
    return false;
  }, false);
}
function setPin() {
  pinPad("Nhập mã PIN mới (4 số)", c1 => {
    pinPad("Nhập lại mã PIN", async c2 => {
      if (c2 !== c1) { toast("Hai lần nhập không khớp, làm lại nhé"); setPin(); return true; }
      S.settings.pinSalt = uid();
      S.settings.pinHash = await hashPin(c2, S.settings.pinSalt);
      save(); $("lock").hidden = true; renderSettings(); toast("Đã bật khoá PIN");
      return true;
    }, true);
    return true;
  }, true);
}

// ---------- Khởi động ----------
function applyTheme() {
  const t = S.settings.theme, root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
}

let hiddenAt = 0;
async function boot() {
  // Safari đôi khi treo khi mở IndexedDB lần đầu: quá 3 giây thì dùng bản dự phòng trong localStorage.
  try {
    if (window.indexedDB) await Promise.race([Store.open(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))]);
  } catch (e) { Store.db = null; }
  let json = null;
  try { if (Store.db) json = await Store.get("kv", "state"); } catch (e) { /* dùng bản dự phòng */ }
  if (!json) { try { json = localStorage.getItem("so-chi-tieu"); } catch (e) { /* không có */ } }
  try { S = migrate(json ? JSON.parse(json) : null); } catch (e) { S = freshState(); }
  ui.statMonth = mkOf(today());
  applyTheme();
  runRecurring();

  document.querySelectorAll(".tab[data-tab]").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $("addBtn").addEventListener("click", () => txSheet());
  $("sheetBg").addEventListener("click", closeSheet);
  $("sheetClose").addEventListener("click", closeSheet);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); flush(); return; }
    if (S.settings.pinHash && hiddenAt && Date.now() - hiddenAt >= S.settings.lockAfter * 1000) unlock();
    const before = S.tx.length;
    runRecurring();
    if (S.tx.length !== before || tab === "today") render();
  });

  setTab("today");
  if (S.settings.pinHash) unlock();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
}
// Chờ nạp xong mọi file (tools.js nạp sau app.js) rồi mới chạy.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
