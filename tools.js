"use strict";
// Tab Tiện ích: lịch âm, máy tính, bảng kê tiền, quy đổi ngoại tệ, tính lãi suất.
// Dùng các hàm chung trong app.js (h, fill, openSheet, money, S, save…).

const TOOLS = [
  ["🌙", "Lịch âm", "Ngày âm, can chi, ngày lễ", () => lunarSheet()],
  ["🧮", "Máy tính", "Tính xong ghi luôn thành khoản chi", () => calcSheet()],
  ["💵", "Bảng kê tiền", "Đếm tiền mặt theo mệnh giá", () => cashSheet()],
  ["💱", "Quy đổi ngoại tệ", "USD, EUR, JPY, KRW… sang VND", () => fxSheet()],
  ["📈", "Tính lãi suất", "Gửi tiết kiệm, vay trả góp", () => rateSheet()]
];
function toolState() {
  if (!S.tools) S.tools = {};
  const t = S.tools;
  t.cash = t.cash || {counts: {}, wallet: null};
  t.fx = t.fx || {rates: null, updated: null, manual: {}, from: "USD", to: "VND", amount: "100"};
  t.rate = t.rate || {mode: "gui", P: 100000000, r: "5,5", n: 12, gui: "cuoiky", vay: "giamdan"};
  t.calc = t.calc || {hist: []};
  return t;
}
function lunarText(iso) {
  const [d, m, y, leap] = Lunar.fromSolar(iso);
  return "ngày " + d + " tháng " + m + (leap ? " nhuận" : "") + " năm " + Lunar.yearName(y);
}

function renderTools() {
  const v = $("v-tools"), t = today();
  setActions(h("button", {class: "icon-btn", type: "button", "aria-label": "Cài đặt", onclick: () => setTab("settings")}, "⚙"));
  const [, , ly] = Lunar.fromSolar(t);
  let tet = Lunar.toSolar(1, 1, ly + 1, 0);
  const daysTet = daysBetween(t, tet);
  const d = dateOf(t);
  fill(v,
    h("button", {type: "button", class: "lunar-today", onclick: () => lunarSheet()},
      h("div", {class: "lt-day"}, h("span", null, WD[d.getDay()]), h("b", {class: "num"}, String(d.getDate())), h("span", null, "tháng " + (d.getMonth() + 1))),
      h("div", {class: "grow"},
        h("div", {class: "small muted"}, "Âm lịch"),
        h("div", {class: "bold"}, lunarText(t)),
        h("div", {class: "small"}, "Ngày " + Lunar.dayName(t)),
        h("div", {class: "small", style: {color: "var(--gold)", fontWeight: 650, marginTop: "4px"}},
          daysTet === 0 ? "🧧 Chúc mừng năm mới!" : "🧧 Còn " + daysTet + " ngày đến Tết " + Lunar.yearName(ly + 1)))),
    h("div", {class: "tools"}, TOOLS.map(([icon, name, desc, fn]) =>
      h("button", {type: "button", class: "tool", onclick: fn},
        h("span", {class: "tool-ic"}, icon), h("b", null, name), h("span", {class: "small muted"}, desc))),
      h("button", {type: "button", class: "tool", onclick: () => setTab("settings")},
        h("span", {class: "tool-ic"}, "⚙️"), h("b", null, "Cài đặt"), h("span", {class: "small muted"}, "Hạn mức, danh mục, sao lưu"))));
}

// ---------- Lịch âm ----------
const HOLIDAYS_LUNAR = [[1, 1, "Tết Nguyên Đán"], [15, 1, "Rằm tháng Giêng"], [10, 3, "Giỗ Tổ Hùng Vương"],
  [15, 4, "Lễ Phật Đản"], [5, 5, "Tết Đoan Ngọ"], [15, 7, "Lễ Vu Lan"], [15, 8, "Tết Trung Thu"], [23, 12, "Ông Công, Ông Táo"]];
const HOLIDAYS_SOLAR = [["01-01", "Tết Dương lịch"], ["02-14", "Lễ Tình nhân"], ["03-08", "Quốc tế Phụ nữ"], ["04-30", "Giải phóng miền Nam"],
  ["05-01", "Quốc tế Lao động"], ["06-01", "Quốc tế Thiếu nhi"], ["09-02", "Quốc khánh"], ["10-20", "Phụ nữ Việt Nam"],
  ["11-20", "Nhà giáo Việt Nam"], ["12-24", "Giáng sinh"]];

function holidaysOn(iso) {
  const [d, m, , leap] = Lunar.fromSolar(iso), out = [];
  if (!leap) for (const [hd, hm, name] of HOLIDAYS_LUNAR) if (hd === d && hm === m) out.push(name);
  for (const [md, name] of HOLIDAYS_SOLAR) if (iso.slice(5) === md) out.push(name);
  return out;
}
function upcomingHolidays(from, n) {
  const out = [];
  for (let i = 0; i < 400 && out.length < n; i++) {
    const iso = P.addDays(from, i);
    for (const name of holidaysOn(iso)) out.push([iso, name]);
  }
  return out.slice(0, n);
}

function lunarSheet(mk, sel) {
  const t = today();
  mk = mk || mkOf(t); sel = sel || t;
  const first = dateOf(mk + "-01"), offset = (first.getDay() + 6) % 7, n = dim(mk);
  const grid = h("div", {class: "lcal"}, ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(x => h("div", {class: "hd"}, x)));
  for (let i = 0; i < offset; i++) grid.append(h("div"));
  for (let i = 1; i <= n; i++) {
    const iso = mk + "-" + String(i).padStart(2, "0");
    const [ld, lm] = Lunar.fromSolar(iso);
    const cls = ["c"];
    if (iso === t) cls.push("today");
    if (iso === sel) cls.push("sel");
    if (ld === 1 || ld === 15) cls.push("moon");
    if (dateOf(iso).getDay() === 0) cls.push("sun");
    if (holidaysOn(iso).length) cls.push("hol");
    grid.append(h("button", {type: "button", class: cls.join(" "), onclick: () => lunarSheet(mk, iso)},
      h("b", null, String(i)), h("small", null, ld === 1 ? ld + "/" + lm : String(ld))));
  }
  const [sd, sm, sy, sl] = Lunar.fromSolar(sel);
  const hol = holidaysOn(sel);
  const next = upcomingHolidays(t, 5);
  const detail = h("div", {class: "card stack", style: {gap: "6px"}},
    h("div", {class: "bold"}, dayLabel(sel) + " · " + dmy(sel)),
    h("div", null, "Âm lịch: ", h("b", null, sd + "/" + sm + (sl ? " (nhuận)" : "")), " năm " + Lunar.yearName(sy)),
    h("div", {class: "small muted"}, "Ngày " + Lunar.dayName(sel) + " · tháng " + Lunar.monthName(sm, sy) + " · năm " + Lunar.yearName(sy)),
    hol.length ? h("div", {class: "small", style: {color: "var(--gold)", fontWeight: 650}}, "🎉 " + hol.join(", ")) : null,
    sel !== t ? h("div", {class: "small muted"}, (daysBetween(t, sel) > 0 ? "Còn " + daysBetween(t, sel) + " ngày nữa" : "Cách đây " + daysBetween(sel, t) + " ngày")) : null);
  openSheet("Lịch âm", h("div", {class: "stack"},
    h("div", {class: "month-nav"},
      h("button", {class: "icon-btn", type: "button", "aria-label": "Tháng trước", onclick: () => lunarSheet(shiftMonth(mk, -1), sel)}, "‹"),
      h("b", null, monthLabel(mk)),
      h("button", {class: "icon-btn", type: "button", "aria-label": "Tháng sau", onclick: () => lunarSheet(shiftMonth(mk, 1), sel)}, "›")),
    grid,
    detail,
    mk !== mkOf(t) || sel !== t ? h("button", {type: "button", class: "btn block", onclick: () => lunarSheet()}, "Về hôm nay") : null,
    h("div", {class: "sec-title"}, "Ngày lễ sắp tới"),
    h("div", {class: "list"}, next.map(([iso, name]) => h("button", {type: "button", class: "li", onclick: () => lunarSheet(mkOf(iso), iso)},
      h("div", {class: "grow"}, h("div", {class: "bold"}, name), h("div", {class: "small muted"}, dayLabel(iso) + " · " + dmy(iso) + " · âm " + Lunar.fromSolar(iso).slice(0, 2).join("/"))),
      h("span", {class: "pill"}, iso === t ? "hôm nay" : "còn " + daysBetween(t, iso) + " ngày"))))));
}

// ---------- Máy tính ----------
let calcExpr = "";
const NF4 = new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 4});
// Biểu thức gồm số (dấu phẩy thập phân), + − × ÷ và %. "200.000 + 10%" = 220.000 như máy tính cầm tay.
function calcEval(s) {
  const t = s.replace(/[+−×÷]+$/, "").match(/\d+(?:,\d*)?|[+−×÷%]/g) || [];
  let i = 0, pct = false;
  const num = () => {
    pct = false;
    if (t[i] === "−") { i++; return -num(); }
    let v = parseFloat((t[i++] || "0").replace(",", "."));
    if (isNaN(v)) v = 0;
    while (t[i] === "%") { v /= 100; i++; pct = true; }
    return v;
  };
  const term = () => {
    let v = num();
    while (t[i] === "×" || t[i] === "÷") { const op = t[i++]; const r = num(); v = op === "×" ? v * r : (r ? v / r : NaN); }
    return v;
  };
  let v = term();
  while (t[i] === "+" || t[i] === "−") {
    const op = t[i++]; let r = term();
    if (pct) r = v * r;
    v = op === "+" ? v + r : v - r;
  }
  return v;
}
const calcShow = s => s.replace(/\d+(?:,\d*)?/g, x => {
  const [a, b] = x.split(",");
  return NF.format(Number(a)) + (b !== undefined ? "," + b : "");
}).replace(/([+−×÷])/g, " $1 ");

function calcSheet() {
  const st = toolState().calc;
  const exprEl = h("div", {class: "calc-expr"}), resEl = h("div", {class: "calc-res num"});
  const histBox = h("div", {class: "stack", style: {gap: "4px"}});
  const recBtn = h("button", {type: "button", class: "btn primary block"});
  function paint() {
    exprEl.textContent = calcShow(calcExpr) || "0";
    const v = calcEval(calcExpr);
    resEl.textContent = isFinite(v) ? "= " + NF4.format(v) : "Không chia được cho 0";
    recBtn.hidden = !(isFinite(v) && v >= 1);
    recBtn.textContent = "Ghi " + money(Math.round(v)) + " thành khoản chi";
    fill(histBox, st.hist.length ? h("div", {class: "sec-title"}, "Vừa tính") : null,
      st.hist.slice(0, 5).map(([e, r]) => h("button", {type: "button", class: "li", style: {padding: "8px 12px"}, onclick: () => { calcExpr = r; paint(); }},
        h("span", {class: "grow small muted ellipsis"}, calcShow(e)), h("b", {class: "num"}, NF4.format(Number(r.replace(",", ".")))))));
  }
  function press(k) {
    const last = calcExpr.slice(-1);
    if (k === "C") calcExpr = "";
    else if (k === "⌫") calcExpr = calcExpr.slice(0, -1);
    else if (k === "=") {
      const v = calcEval(calcExpr);
      if (!isFinite(v) || !/[+−×÷%]/.test(calcExpr)) return;
      const r = String(Math.round(v * 10000) / 10000).replace(".", ",");
      st.hist.unshift([calcExpr, r]); st.hist = st.hist.slice(0, 10); save();
      calcExpr = r.replace(/^-/, "−");
    } else if ("+−×÷".includes(k)) {
      if (!calcExpr && k !== "−") return;
      calcExpr = "+−×÷".includes(last) ? calcExpr.slice(0, -1) + k : calcExpr + k;
    } else if (k === "%") {
      if (/\d/.test(last)) calcExpr += "%";
    } else if (k === ",") {
      const cur = calcExpr.split(/[+−×÷%]/).pop();
      if (!cur.includes(",")) calcExpr += cur ? "," : "0,";
    } else {
      if (calcExpr.length > 60) return;
      calcExpr += k;
    }
    paint();
  }
  recBtn.addEventListener("click", () => { const v = Math.round(calcEval(calcExpr)); closeSheet(); txSheet(null, {amount: v}); });
  const keys = ["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "000", "0", ",", "="];
  paint();
  openSheet("Máy tính", h("div", {class: "stack"},
    h("div", {class: "calc-disp card"}, exprEl, resEl),
    h("div", {class: "keypad"}, keys.map(k => h("button", {type: "button",
      class: k === "=" ? "eq" : /^[C⌫%÷×−+]$/.test(k) ? "fn" : "", onclick: () => press(k)}, k))),
    recBtn, histBox));
}

// ---------- Bảng kê tiền ----------
const DENOMS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];
function cashSheet() {
  const st = toolState().cash;
  if (!st.wallet || !S.wallets.some(w => w.id === st.wallet)) {
    const w = S.wallets.find(x => x.kind === "cash") || S.wallets[0];
    st.wallet = w ? w.id : null;
  }
  const totalEl = h("b", {class: "num", style: {fontSize: "30px"}}), sheetsEl = h("span", {class: "small muted"});
  const cmpEl = h("div", {class: "stack", style: {gap: "8px"}});
  const subs = {};
  const total = () => DENOMS.reduce((a, d) => a + d * (st.counts[d] || 0), 0);
  function paintTotals() {
    const tot = total(), sheets = DENOMS.reduce((a, d) => a + (st.counts[d] || 0), 0);
    totalEl.textContent = money(tot);
    sheetsEl.textContent = sheets + " tờ";
    for (const d of DENOMS) subs[d].textContent = st.counts[d] ? NF.format(d * st.counts[d]) : "";
    if (!st.wallet) { fill(cmpEl); return; }
    const bal = balances()[st.wallet] || 0, diff = tot - bal;
    fill(cmpEl,
      field("So với số dư ví", walletSel(st.wallet, v => { st.wallet = v; save(); paintTotals(); })),
      h("div", {class: "row between small"}, h("span", {class: "muted"}, "Trên app: " + money(bal)),
        h("b", {class: diff ? (diff > 0 ? "thu" : "chi") : "muted"}, diff ? (diff > 0 ? "Thừa " : "Thiếu ") + money(Math.abs(diff)) : "Khớp ✓")),
      diff ? h("button", {type: "button", class: "btn sm", onclick: () => {
        const w = S.wallets.find(x => x.id === st.wallet);
        if (!w) return;
        w.init = (Number(w.init) || 0) + diff;
        save(); render(); paintTotals(); toast("Đã cập nhật số dư " + w.name + " thành " + money(tot));
      }}, "Cập nhật số dư ví bằng số đã đếm") : null);
  }
  const rows = DENOMS.map(d => {
    const inp = h("input", {class: "input num", inputmode: "numeric", value: st.counts[d] ? String(st.counts[d]) : "", placeholder: "0",
                            "aria-label": "Số tờ " + NF.format(d)});
    const set = n => { n = Math.max(0, Math.min(9999, n)); if (n) st.counts[d] = n; else delete st.counts[d]; inp.value = n ? String(n) : ""; save(); paintTotals(); };
    inp.addEventListener("input", () => set(Number(inp.value.replace(/\D/g, "")) || 0));
    subs[d] = h("span", {class: "v num small"});
    return h("div", {class: "cash-row"},
      h("span", {class: "den num"}, NF.format(d)),
      h("div", {class: "row", style: {gap: "4px"}},
        h("button", {type: "button", class: "icon-btn", "aria-label": "Bớt 1 tờ", onclick: () => set((st.counts[d] || 0) - 1)}, "−"),
        inp,
        h("button", {type: "button", class: "icon-btn", "aria-label": "Thêm 1 tờ", onclick: () => set((st.counts[d] || 0) + 1)}, "+")),
      subs[d]);
  });
  const copyText = () => DENOMS.filter(d => st.counts[d]).map(d => NF.format(d) + " × " + st.counts[d] + " = " + NF.format(d * st.counts[d])).join("\n") + "\nTổng: " + money(total());
  paintTotals();
  openSheet("Bảng kê tiền", h("div", {class: "stack"},
    h("div", {class: "card stack", style: {gap: "8px"}},
      h("div", {class: "row between", style: {alignItems: "baseline"}}, totalEl, sheetsEl), cmpEl),
    h("div", {class: "card stack", style: {gap: "8px"}}, h("div", {class: "cash-row tiny muted"}, h("span", null, "Mệnh giá"), h("span", {style: {textAlign: "center"}}, "Số tờ"), h("span", {class: "v"}, "Thành tiền")), rows),
    h("div", {class: "grid2"},
      h("button", {type: "button", class: "btn", onclick: () => {
        navigator.clipboard.writeText(copyText()).then(() => toast("Đã chép bảng kê"), () => toast("Không chép được"));
      }}, "📋 Chép bảng kê"),
      confirmBtn("Xoá số đếm", "Chạm lần nữa", () => { st.counts = {}; save(); cashSheet(); }, "btn"))));
}

// ---------- Quy đổi ngoại tệ ----------
const CURRENCIES = [["VND", "🇻🇳", "Việt Nam đồng"], ["USD", "🇺🇸", "Đô la Mỹ"], ["EUR", "🇪🇺", "Euro"], ["JPY", "🇯🇵", "Yên Nhật"],
  ["KRW", "🇰🇷", "Won Hàn Quốc"], ["CNY", "🇨🇳", "Nhân dân tệ"], ["TWD", "🇹🇼", "Đài tệ"], ["THB", "🇹🇭", "Baht Thái"],
  ["SGD", "🇸🇬", "Đô Singapore"], ["AUD", "🇦🇺", "Đô Úc"], ["GBP", "🇬🇧", "Bảng Anh"], ["HKD", "🇭🇰", "Đô Hồng Kông"],
  ["MYR", "🇲🇾", "Ringgit Malaysia"], ["CAD", "🇨🇦", "Đô Canada"], ["LAK", "🇱🇦", "Kíp Lào"], ["KHR", "🇰🇭", "Riel Campuchia"]];
function parseDec(s) {
  s = String(s || "").replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "");
  return Number(s.replace(",", ".")) || 0;
}
function vndPer(fx, cur) {
  if (cur === "VND") return 1;
  if (fx.manual[cur]) return fx.manual[cur];
  if (fx.rates && fx.rates[cur] && fx.rates.VND) return fx.rates.VND / fx.rates[cur];
  return 0;
}
const fmtCur = (v, cur) => cur === "VND" ? money(v) : new Intl.NumberFormat("vi-VN", {maximumFractionDigits: v < 1 ? 6 : 2}).format(v) + " " + cur;

async function fxUpdate(after) {
  const fx = toolState().fx;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", {cache: "no-store"});
    const j = await r.json();
    if (j.result !== "success" || !j.rates || !j.rates.VND) throw new Error("bad");
    fx.rates = j.rates; fx.updated = new Date().toISOString();
    save(); toast("Đã cập nhật tỉ giá"); after();
  } catch (e) { toast("Không lấy được tỉ giá. Kiểm tra mạng rồi thử lại."); }
}

function fxSheet() {
  const fx = toolState().fx;
  const amt = h("input", {class: "input num", inputmode: "decimal", value: fx.amount, placeholder: "Số tiền", autocomplete: "off", style: {fontSize: "20px"}});
  const curSel = (val, on) => h("select", {class: "input", value: val, onchange: e => on(e.target.value)},
    CURRENCIES.map(([c, f, name]) => h("option", {value: c}, f + " " + c + " · " + name)));
  const out = h("div", {class: "fx-out"});
  const rateBox = h("div", {class: "stack", style: {gap: "0"}});
  let fromSel, toSel;
  function paint() {
    const a = parseDec(amt.value), rf = vndPer(fx, fx.from), rt = vndPer(fx, fx.to);
    fill(out, rf && rt
      ? [h("div", {class: "small muted"}, fmtCur(a, fx.from) + " ="), h("div", {class: "num fx-big"}, fmtCur(a * rf / rt, fx.to)),
         h("div", {class: "tiny muted"}, "1 " + fx.from + " = " + fmtCur(rf / rt, fx.to))]
      : h("div", {class: "small"}, "Chưa có tỉ giá cho " + (rf ? fx.to : fx.from) + ". Bấm “Cập nhật tỉ giá” (cần mạng) hoặc tự nhập tỉ giá ở bảng dưới."));
  }
  function paintRates() {
    fill(rateBox, h("div", {class: "list"}, CURRENCIES.filter(c => c[0] !== "VND").map(([c, f, name]) => {
      const auto = fx.rates && fx.rates[c] ? fx.rates.VND / fx.rates[c] : 0;
      const inp = h("input", {class: "input num", inputmode: "decimal", value: fx.manual[c] ? NF4.format(fx.manual[c]) : "",
        placeholder: auto ? NF4.format(auto) : "tự nhập", "aria-label": "Tỉ giá " + c,
        style: {maxWidth: "130px", textAlign: "right", padding: "6px 10px"}});
      inp.addEventListener("change", () => { const n = parseDec(inp.value); if (n > 0) fx.manual[c] = n; else delete fx.manual[c]; save(); paint(); paintRates(); });
      return h("div", {class: "li", style: {padding: "8px 12px"}},
        h("span", null, f), h("div", {class: "grow"}, h("div", {class: "bold"}, c), h("div", {class: "tiny muted"}, name + (fx.manual[c] ? " · tự nhập" : ""))),
        inp, h("span", {class: "tiny muted"}, "đ"));
    })));
  }
  amt.addEventListener("input", () => { fx.amount = amt.value; save(); paint(); });
  fromSel = curSel(fx.from, v => { fx.from = v; save(); paint(); });
  toSel = curSel(fx.to, v => { fx.to = v; save(); paint(); });
  const swap = h("button", {type: "button", class: "icon-btn", "aria-label": "Đổi chiều", onclick: () => {
    [fx.from, fx.to] = [fx.to, fx.from]; fromSel.value = fx.from; toSel.value = fx.to; save(); paint();
  }}, "⇅");
  paint(); paintRates();
  openSheet("Quy đổi ngoại tệ", h("div", {class: "stack"},
    amt,
    h("div", {class: "row"}, h("div", {class: "grow stack", style: {gap: "8px"}}, field("Từ", fromSel), field("Sang", toSel)), swap),
    h("div", {class: "card"}, out),
    h("div", {class: "row between wrap"},
      h("span", {class: "tiny muted"}, fx.updated ? "Tỉ giá cập nhật lúc " + new Date(fx.updated).toLocaleString("vi-VN") : "Chưa cập nhật tỉ giá"),
      h("button", {type: "button", class: "btn sm primary", onclick: () => fxUpdate(() => fxSheet())}, "↻ Cập nhật tỉ giá")),
    h("p", {class: "tiny muted", style: {margin: 0}}, "Tỉ giá tham khảo từ open.er-api.com, lệch vài phần trăm so với giá mua bán của ngân hàng và tiệm vàng. Muốn đúng giá thì nhập tay tỉ giá ở bảng dưới (để trống là dùng tỉ giá tự động)."),
    h("div", {class: "sec-title"}, "1 đơn vị đổi được bao nhiêu VND"),
    rateBox));
}

// ---------- Tính lãi suất ----------
function rateSheet() {
  const st = toolState().rate;
  const P0 = moneyInput(st.P);
  const r = h("input", {class: "input num", inputmode: "decimal", value: String(st.r), placeholder: "5,5"});
  const n = h("input", {class: "input num", inputmode: "numeric", value: String(st.n), placeholder: "12"});
  const sub = h("div");
  const out = h("div", {class: "stack"});
  function calc() {
    st.P = P0.money(); st.r = r.value; st.n = Number(n.value.replace(/\D/g, "")) || 0; save();
    const P = st.P, rate = parseDec(st.r) / 100, m = Math.min(st.n, 600);
    if (!P || !rate || !m) { fill(out, h("div", {class: "empty"}, "Nhập số tiền, lãi suất và số tháng.")); return; }
    const kpi = (label, val, cls) => h("div", {class: "kpi"}, h("span", null, label), h("b", {class: cls || ""}, val));
    if (st.mode === "gui") {
      let lai, note;
      if (st.gui === "kep") { lai = P * Math.pow(1 + rate / 12, m) - P; note = "Lãi mỗi tháng cộng vào gốc rồi tính lãi tiếp."; }
      else { lai = P * rate * m / 12; note = st.gui === "thang" ? "Mỗi tháng nhận " + money(P * rate / 12) + " tiền lãi, gốc giữ nguyên." : "Nhận cả gốc và lãi khi hết kỳ hạn."; }
      fill(out,
        h("div", {class: "kpis", style: {gridTemplateColumns: "1fr 1fr"}}, kpi("Tiền lãi", money(lai), "thu"), kpi("Tổng nhận", money(P + lai))),
        h("p", {class: "small muted", style: {margin: 0}}, note + " Lãi trung bình " + money(lai / m) + "/tháng."),
        h("p", {class: "tiny muted", style: {margin: 0}}, "Ngân hàng thường tính lãi theo số ngày thực tế / 365, nên số thật có thể lệch vài nghìn đồng."));
      return;
    }
    const i = rate / 12, rows = [];
    let left = P, totalInt = 0;
    for (let k = 1; k <= m; k++) {
      let goc, lai;
      if (st.vay === "giamdan") { goc = P / m; lai = left * i; }
      else if (st.vay === "deu") { const A = P * i / (1 - Math.pow(1 + i, -m)); lai = left * i; goc = A - lai; }
      else { goc = P / m; lai = P * i; }
      left = Math.max(0, left - goc); totalInt += lai;
      rows.push([k, goc, lai, goc + lai, left]);
    }
    const firstPay = rows[0][3], lastPay = rows[rows.length - 1][3];
    fill(out,
      h("div", {class: "kpis", style: {gridTemplateColumns: "1fr 1fr"}},
        kpi(st.vay === "giamdan" ? "Tháng đầu trả" : "Mỗi tháng trả", money(firstPay), "chi"),
        st.vay === "giamdan" ? kpi("Tháng cuối trả", money(lastPay)) : kpi("Số tháng", m + " tháng"),
        kpi("Tổng tiền lãi", money(totalInt), "chi"), kpi("Tổng phải trả", money(P + totalInt))),
      st.vay === "phang" ? h("p", {class: "small warn", style: {margin: 0}}, "Lãi phẳng tính trên số tiền vay ban đầu suốt cả kỳ, nên lãi thật cao gần gấp đôi lãi ghi trên hợp đồng. Hay gặp ở vay tiêu dùng, trả góp điện thoại.") : null,
      h("details", null, h("summary", {class: "bold", style: {cursor: "pointer", padding: "4px 0"}}, "Lịch trả từng tháng"),
        h("div", {class: "tbl-wrap"}, h("table", {class: "tbl"},
          h("thead", null, h("tr", null, ["Kỳ", "Gốc", "Lãi", "Phải trả", "Còn nợ"].map(x => h("th", null, x)))),
          h("tbody", null, rows.map(row => h("tr", null, row.map((x, j) => h("td", null, j ? short(x) : String(x))))))))));
  }
  function paintSub() {
    fill(sub, st.mode === "gui"
      ? field("Cách nhận lãi", segCtl([["cuoiky", "Cuối kỳ"], ["thang", "Hằng tháng"], ["kep", "Lãi nhập gốc"]], st.gui, x => { st.gui = x; calc(); }))
      : field("Cách trả", segCtl([["giamdan", "Dư nợ giảm dần"], ["deu", "Trả đều"], ["phang", "Lãi phẳng"]], st.vay, x => { st.vay = x; calc(); })));
  }
  [P0, r, n].forEach(x => x.addEventListener("input", calc));
  paintSub(); calc();
  openSheet("Tính lãi suất", h("div", {class: "stack"},
    segCtl([["gui", "Gửi tiết kiệm"], ["vay", "Vay trả góp"]], st.mode, x => { st.mode = x; paintSub(); calc(); }),
    field("Số tiền", P0),
    h("div", {class: "grid2"}, field("Lãi suất (%/năm)", r), field("Số tháng", n)),
    sub, out));
}
