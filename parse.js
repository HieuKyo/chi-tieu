// Phân tích câu gõ nhanh: "cafe 35k hôm qua", "đi chợ 45k+30k".
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

  // Tổng nhiều số: "45k+30k", "45 + 30", "1tr2+500k"
  const SUM_RE = /(^|\s)(\d[\d.,]*\s*(?:k|nghin|ngan|ng|trieu|tr|cu|m|vnd|dong|d)?\d{0,3}(?:\s*\+\s*\d[\d.,]*\s*(?:k|nghin|ngan|ng|trieu|tr|cu|m|vnd|dong|d)?\d{0,3})+)(?![a-z0-9])/;

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
    const sm = n.match(SUM_RE);
    const m = sm || n.match(MONEY_RE);
    if (sm) {
      // "45k+30k+12k": cộng từng số, mỗi số hiểu đơn vị riêng
      amount = sm[2].split("+").reduce((a, part) => {
        const x = (" " + part.trim()).match(MONEY_RE);
        return a + (x ? moneyFrom(x) : 0);
      }, 0);
    } else if (m) {
      amount = moneyFrom(m);
    }
    if (m) {
      const i = m.index + m[1].length;
      raw = raw.slice(0, i) + raw.slice(m.index + m[0].length);
      n = norm(raw);
    }
    // "rau 15k + thịt 120k": có dấu + và còn số tiền khác thì cộng nốt
    if (!sm && m && n.includes("+")) {
      let x;
      while ((x = n.match(MONEY_RE))) {
        amount += moneyFrom(x);
        const i = x.index + x[1].length;
        raw = raw.slice(0, i) + raw.slice(x.index + x[0].length);
        n = norm(raw);
      }
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

  function hash(s) {
    let h = 2166136261;
    for (const ch of norm(s).replace(/\s+/g, " ").trim()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  const api = {norm, iso, addDays, toNum, guessCat, guessWallet, parseQuick, hash};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Parse = api;
})(typeof self !== "undefined" ? self : this);
