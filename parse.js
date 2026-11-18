// Phân tích chữ: câu gõ nhanh ("cafe 35k hôm qua") và tin nhắn / thông báo ngân hàng.
// Hàm thuần, không đụng tới giao diện, để chạy thử được ngoài trình duyệt.
(function (root) {
  "use strict";

  // Bỏ dấu tiếng Việt, viết thường. Giữ nguyên độ dài chuỗi (chuỗi vào ở dạng NFC)
  // để vị trí trong chuỗi đã bỏ dấu dùng được cho chuỗi gốc.
  function norm(s) {
    return String(s || "").normalize("NFC").toLowerCase()
      .replace(/đ/g, "d")
      .split("").map(ch => ch.normalize("NFD").replace(/[̀-ͯ]/g, "") || ch).join("");
  }

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(isoDate, n) {
    const [y, m, d] = isoDate.split("-").map(Number);
    return iso(new Date(y, m - 1, d + n));
  }

  // "35.000" / "35,000" / "1.234.567" là số có dấu phân cách hàng nghìn; "1.5" / "2,5" là số thập phân.
  function toNum(str) {
    if (/^\d{1,3}([.,]\d{3})+$/.test(str)) return Number(str.replace(/[.,]/g, ""));
    return parseFloat(str.replace(",", "."));
  }

  const UNIT = {k: 1e3, ng: 1e3, nghin: 1e3, ngan: 1e3, tr: 1e6, trieu: 1e6, cu: 1e6, m: 1e6,
                d: 1, vnd: 1, dong: 1};
  // Số tiền trong câu gõ: 35k, 35 nghìn, 1tr2, 1,5tr, 150.000đ, 35 (hiểu là 35k)
  const MONEY_RE = /(^|[^\w.,])(\d+(?:[.,]\d+)*)\s*(k|nghin|ngan|ng|trieu|tr|cu|m|vnd|dong|d)?(\d{1,3})?(?![a-z0-9])/;

  function moneyFrom(match) {
    let v = toNum(match[2]);
    const unit = match[3];
    if (unit) {
      const mul = UNIT[unit];
      if (match[4] && mul >= 1e3) v += Number(match[4]) / Math.pow(10, match[4].length); // 1tr2 = 1,2 triệu
      v *= mul;
    } else if (v < 1000) {
      v *= 1000; // "cafe 35" = 35.000đ
    }
    return Math.round(v);
  }

  function lowerNFC(s) { return String(s || "").normalize("NFC").toLowerCase(); }
  function words(s) { return " " + s.replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " "; }

  // Tìm danh mục theo từ khoá dài nhất khớp được (để "cà phê" thắng "cá").
  // Câu gõ có dấu thì so có dấu ("chợ" khác "cho"), gõ không dấu thì so không dấu.
  function guessCat(text, cats, type) {
    const acc = words(lowerNFC(text)), plain = words(norm(text));
    const marked = acc !== plain;
    let best = null, bestLen = 0;
    for (const c of cats) {
      if (type && c.type !== type) continue;
      for (const kw of (c.keywords || []).concat([c.name])) {
        const k = words(lowerNFC(kw)).trim(), kp = words(norm(kw)).trim();
        if (!k || k.length <= bestLen) continue;
        const hit = marked && k !== kp ? acc.includes(" " + k + " ") : plain.includes(" " + kp + " ");
        if (hit) { best = c; bestLen = k.length; }
      }
    }
    return best;
  }

  const INCOME_WORDS = ["luong", "thuong", "nhan tien", "duoc cho", "duoc tang", "tien lai", "lai ngan hang",
                        "ban hang", "hoan tien", "thu nhap", "thu tien"];
  const WALLET_WORDS = [
    [["momo"], "momo"], [["zalopay", "zalo pay", "zlp"], "zalopay"],
    [["the", "visa", "ck", "chuyen khoan", "ngan hang", "bank", "card"], "bank"],
    [["tien mat", "tm", "cash"], "cash"]
  ];

  function guessWallet(text, wallets) {
    const t = " " + norm(text).replace(/[^a-z0-9]+/g, " ") + " ";
    for (const w of wallets) if (t.includes(" " + norm(w.name).replace(/[^a-z0-9]+/g, " ").trim() + " ")) return w;
    for (const [words, kind] of WALLET_WORDS) {
      if (words.some(x => t.includes(" " + x + " "))) {
        const w = wallets.find(w => w.kind === kind);
        if (w) return w;
      }
    }
    return null;
  }

  // Câu gõ nhanh -> {amount, type, cat, wallet, date, note}. amount = 0 nếu không thấy số tiền.
  function parseQuick(text, cats, wallets, today) {
    let raw = String(text || "").normalize("NFC").trim();
    let n = norm(raw);
    let date = today;
    const rel = [["hom kia", -2], ["hom qua", -1], ["hom nay", 0]];
    for (const [w, d] of rel) {
      const i = n.indexOf(w);
      if (i >= 0) { date = addDays(today, d); raw = raw.slice(0, i) + raw.slice(i + w.length); n = norm(raw); break; }
    }
    const dm = n.match(/(^|\s)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?=\s|$)/);
    if (dm) {
      const y = dm[4] ? (dm[4].length === 2 ? 2000 + Number(dm[4]) : Number(dm[4])) : Number(today.slice(0, 4));
      const d = new Date(y, Number(dm[3]) - 1, Number(dm[2]));
      if (!isNaN(d) && d.getDate() === Number(dm[2])) {
        date = iso(d);
        const i = dm.index + dm[1].length;
        raw = raw.slice(0, i) + raw.slice(i + dm[0].length - dm[1].length); n = norm(raw);
      }
    }
    let amount = 0;
    const m = n.match(MONEY_RE);
    if (m) {
      amount = moneyFrom(m);
      const i = m.index + m[1].length;
      raw = raw.slice(0, i) + raw.slice(m.index + m[0].length);
    }
    const note = raw.replace(/\s+/g, " ").trim();
    const nn = " " + norm(note).replace(/[^a-z0-9]+/g, " ") + " ";
    let type = INCOME_WORDS.some(w => nn.includes(" " + w + " ")) ? "thu" : "chi";
    let cat = guessCat(note, cats, type);
    if (!cat && type === "chi") {
      const inc = guessCat(note, cats, "thu");
      if (inc) { type = "thu"; cat = inc; }
    }
    return {amount, type, cat, wallet: guessWallet(note, wallets), date, note};
  }

  // ---------- Tin nhắn / thông báo ngân hàng ----------

  const BANKS = [
    ["vietcombank", ["vcb", "vietcombank"]], ["techcombank", ["tcb", "techcombank"]],
    ["mb", ["mbbank", "mb bank", "mb:"]], ["bidv", ["bidv"]], ["vietinbank", ["vietinbank", "ctg"]],
    ["agribank", ["agribank"]], ["acb", ["acb"]], ["tpbank", ["tpbank"]], ["vpbank", ["vpbank"]],
    ["sacombank", ["sacombank", "stb"]], ["vib", ["vib"]], ["hdbank", ["hdbank"]], ["shb", ["shb"]],
    ["ocb", ["ocb"]], ["msb", ["msb"]], ["cake", ["cake"]], ["timo", ["timo"]],
    ["momo", ["momo"]], ["zalopay", ["zalopay"]]
  ];
  const OUT_WORDS = ["giam", "tru", "thanh toan", "chuyen tien", "chuyen di", "rut tien", "chi tieu", "da tra", "debit", "da chuyen"];
  const IN_WORDS = ["tang", "cong", "nhan duoc", "nhan tien", "ban da nhan", "credit", "duoc hoan", "hoan tien", "+"];
  const BAL_WORDS = ["so du", "sd", "sdc", "sdkd", "balance", "bal", "so du kha dung"];

  function nearBalance(n, idx) {
    const before = n.slice(Math.max(0, idx - 10), idx).replace(/[^a-z ]+/g, " ");
    return BAL_WORDS.some(w => new RegExp("(^|\\s)" + w + "\\s*$").test(before.trimEnd() ) );
  }

  // Tách văn bản dán vào thành từng tin nhắn.
  function splitMessages(text) {
    const SIGNED = /[+-]\s?\d{1,3}(?:[.,]\d{3})+/;
    const out = [];
    for (const block of String(text || "").split(/\n\s*\n/)) {
      const lines = block.split("\n").map(s => s.trim()).filter(Boolean);
      if (!lines.length) continue;
      const signed = lines.filter(l => SIGNED.test(l));
      if (signed.length > 1 && signed.length === lines.length) out.push(...lines);
      else out.push(lines.join(" "));
    }
    return out;
  }

  function hash(s) {
    let h = 2166136261;
    for (const ch of norm(s).replace(/\s+/g, " ").trim()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  // Một tin nhắn -> {amount, type, date, time, note, bank, hash} hoặc null nếu không thấy số tiền.
  function parseBankMessage(msg, today) {
    const raw = String(msg || "").normalize("NFC").trim();
    const n = norm(raw);
    let amount = 0, type = null;

    // 1) Số có dấu +/- (kiểu "-150,000VND"), bỏ số dư.
    const signedRe = /([+-])\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,})(?:[.,]00)?\s*(?:vnd|d|đ)?/g;
    let m;
    while ((m = signedRe.exec(n))) {
      const prev = n[m.index - 1];
      if (prev && /[0-9a-z]/.test(prev) && !/\s|:/.test(prev)) continue; // "0123-4567" trong số TK
      if (nearBalance(n, m.index)) continue;
      amount = toNum(m[2]); type = m[1] === "-" ? "chi" : "thu"; break;
    }
    // 2) Không có dấu: số có đơn vị tiền, đọc chiều từ chữ xung quanh.
    if (!amount) {
      const re = /(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(vnd|dong|d|đ)(?![a-z])/g;
      while ((m = re.exec(n))) {
        if (nearBalance(n, m.index)) continue;
        amount = toNum(m[1]);
        const around = n.slice(Math.max(0, m.index - 40), m.index);
        const lastOut = Math.max(...OUT_WORDS.map(w => around.lastIndexOf(w)));
        const lastIn = Math.max(...IN_WORDS.filter(w => w !== "+").map(w => around.lastIndexOf(w)));
        type = lastIn > lastOut ? "thu" : lastOut >= 0 ? "chi" : (IN_WORDS.some(w => n.includes(w) && w !== "+") ? "thu" : "chi");
        break;
      }
    }
    if (!amount) return null;

    let date = today, time = "";
    const dm = n.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (dm) {
      const y = dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3]);
      const d = new Date(y, Number(dm[2]) - 1, Number(dm[1]));
      if (!isNaN(d) && d.getDate() === Number(dm[1])) date = iso(d);
    }
    const tm = n.match(/(?:^|\D)(\d{1,2}):(\d{2})(?::\d{2})?(?!\d)/);
    if (tm && Number(tm[1]) < 24) time = pad(tm[1]) + ":" + tm[2];

    // Nội dung: sau "ND:" / "Noi dung:" / "Mo ta:", nếu không có thì sau "cho" / "tu".
    let note = "";
    const nd = n.match(/(?:\bnd|noi dung(?: gd)?|mo ta|nội dung|description|content)\s*[:\-]\s*/);
    if (nd) {
      note = raw.slice(nd.index + nd[0].length).split(/\s*\|\s*|\.\s+(?=[A-Z])|\s*;\s*/)[0];
    } else {
      const c = n.match(/\b(?:cho|tai|tu)\s+/);
      if (c) note = raw.slice(c.index).split(/[.|;\n]/)[0];
    }
    note = note.replace(/\s+(lúc|luc|vào|vao)\s+\d.*$/i, "").replace(/^(cho|từ|tu|tại|tai)\s+/i, "")
      .replace(/\s+/g, " ").trim().slice(0, 80);

    let bank = "";
    for (const [name, keys] of BANKS) if (keys.some(k => n.includes(k))) { bank = name; break; }
    return {amount: Math.round(amount), type, date, time, note, bank, hash: hash(raw), raw};
  }

  function parseBankText(text, today) {
    return splitMessages(text).map(m => parseBankMessage(m, today)).filter(Boolean);
  }

  const api = {norm, iso, addDays, toNum, guessCat, guessWallet, parseQuick, splitMessages,
               parseBankMessage, parseBankText, hash};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Parse = api;
})(typeof self !== "undefined" ? self : this);
