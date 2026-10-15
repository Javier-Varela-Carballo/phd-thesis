// Web edition behaviour. Every part is an enhancement: without it the page
// still reads, links still work, and the rail is still there on wide screens.
(() => {
  const rail = document.getElementById("rail");

  // Contents rail behind a button on narrow screens.
  const btn = document.querySelector(".rail-toggle");
  const setOpen = open => {
    document.body.classList.toggle("rail-open", open);
    btn?.setAttribute("aria-expanded", open);
  };
  btn?.addEventListener("click", () => setOpen(!document.body.classList.contains("rail-open")));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.body.classList.contains("rail-open")) { setOpen(false); btn?.focus(); }
  });

  // The rail opens scrolled to the current page.
  if (rail) {
    const cur = rail.querySelector('[aria-current="page"]');
    if (cur) rail.scrollTop = cur.offsetTop - rail.clientHeight / 2;
  }

  // Reading-progress coupler: a directional coupler drawn as the circuit
  // layouts draw it. Reading the page propagates light along z, and power
  // moves from one guide to the other as cos²(πz/2L) / sin²(πz/2L), with full
  // transfer where the coupling region ends. Pointing at the band names the
  // part of the page at that position; clicking or dragging goes there.
  const article = document.querySelector(".body, .home");
  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const progress = () => Math.min(1, Math.max(0, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
  // A coupler along one axis of `host`: `vertical` runs it top to bottom.
  function coupler(host, vertical, id) {
    const svg = el("svg", { preserveAspectRatio: "none", "aria-hidden": "true", "shape-rendering": "geometricPrecision" });
    svg.style.pointerEvents = "none";
    host.append(svg);
    let L = 0, bend = 0, clip;
    const css = getComputedStyle(host);
    const fill = css.getPropertyValue("--cp-fill").trim(), edge = css.getPropertyValue("--cp-edge").trim(), light = css.getPropertyValue("--light").trim();
    const w = parseFloat(css.getPropertyValue("--cp-w")) || 3, gap = parseFloat(css.getPropertyValue("--cp-gap")) || 6;
    const update = () => {
      const p = progress();
      // Dark at the top of the page, the output port lit at the bottom.
      clip?.setAttribute(vertical ? "height" : "width", (L * p).toFixed(1));
    };
    const draw = () => {
      const W = host.clientWidth, H = host.clientHeight;
      L = vertical ? H : W;
      const T = vertical ? W : H;
      if (!L || !T) return;
      bend = Math.min(190, L / 5);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.replaceChildren();
      // S-bends as true curves (cubic Béziers with horizontal tangents at both
      // ends), so the browser antialiases them instead of a chain of segments.
      const mid = T / 2, a0 = mid - gap / 2, b0 = mid + gap / 2, spread = Math.max(0, mid - w);
      const pt = (z, t) => vertical ? `${t.toFixed(2)} ${z.toFixed(2)}` : `${z.toFixed(2)} ${t.toFixed(2)}`;
      const guide = (t0, t1) => [
        "M" + pt(0, t0),
        "C" + pt(bend / 2, t0) + " " + pt(bend / 2, t1) + " " + pt(bend, t1),
        "L" + pt(L - bend, t1),
        "C" + pt(L - bend / 2, t1) + " " + pt(L - bend / 2, t0) + " " + pt(L, t0),
      ].join(" ");
      const a = guide(Math.max(w, a0 - spread * .9), a0), b = guide(Math.min(T - w, b0 + spread * .9), b0);
      const g0 = { gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: vertical ? 0 : W, y2: vertical ? H : 0 };
      const grad = (gid, f) => {
        const g = el("linearGradient", { id: gid, ...g0 });
        for (let i = 0; i <= 24; i++) g.append(el("stop", { offset: (bend + (L - 2 * bend) * i / 24) / L, "stop-color": light, "stop-opacity": f(i / 24).toFixed(3) }));
        return g;
      };
      const defs = el("defs", {});
      const cp = el("clipPath", { id: id + "-clip" });
      clip = el("rect", { x: 0, y: 0, width: vertical ? W : 0, height: vertical ? 0 : H });
      cp.append(clip);
      defs.append(grad(id + "-a", z => Math.cos(Math.PI * z / 2) ** 2), grad(id + "-b", z => Math.sin(Math.PI * z / 2) ** 2), cp);
      svg.append(defs);
      for (const d of [a, b]) {
        if (edge) svg.append(el("path", { d, fill: "none", stroke: edge, "stroke-width": w + 1.5, "stroke-linejoin": "round" }));
        svg.append(el("path", { d, fill: "none", stroke: fill, "stroke-width": w, "stroke-linejoin": "round" }));
      }
      const lit = el("g", { "clip-path": `url(#${id}-clip)` });
      lit.append(el("path", { d: a, fill: "none", stroke: `url(#${id}-a)`, "stroke-width": w }), el("path", { d: b, fill: "none", stroke: `url(#${id}-b)`, "stroke-width": w }));
      svg.append(lit);
      update();
    };
    draw();
    new ResizeObserver(draw).observe(host);
    addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  }
  const band = document.querySelector(".coupler");
  if (article && band) {
    coupler(band, false, "cp-band");
    const tip = Object.assign(document.createElement("div"), { className: "coupler-tip" });
    band.append(tip);
    const maxY = () => document.documentElement.scrollHeight - innerHeight;
    const pAt = x => Math.min(1, Math.max(0, x / Math.max(1, band.clientWidth)));
    const heads = [...article.querySelectorAll(":scope > h2, :scope > h3, :scope > h4, .stop")];
    const headAt = y => {
      let h = heads[0];
      for (const c of heads) if (c.getBoundingClientRect().top + scrollY <= y + innerHeight * .3) h = c;
      return h;
    };
    let dragging = false;
    const seek = e => scrollTo({ top: pAt(e.offsetX) * maxY(), behavior: dragging ? "instant" : "smooth" });
    band.addEventListener("pointermove", e => {
      const h = headAt(pAt(e.offsetX) * maxY());
      tip.textContent = h ? h.textContent.trim() : "";
      tip.style.left = Math.min(Math.max(e.offsetX, 8), band.clientWidth - tip.offsetWidth - 8) + "px";
      band.classList.add("is-pointing");
      if (dragging) seek(e);
    });
    band.addEventListener("pointerleave", () => band.classList.remove("is-pointing"));
    band.addEventListener("pointerdown", e => { band.setPointerCapture(e.pointerId); seek(e); dragging = true; });
    band.addEventListener("pointerup", () => { dragging = false; });
  }

  // Wide content: a table, listing or display equation wider than the text
  // column is scaled down to fit it, to no less than FLOOR of its size; past
  // that it scrolls in its own box (site.css draws the scroll shadows). A table
  // is scaled with `zoom` (its padding is in rem); a listing or an equation
  // through its font size, which its width follows.
  const FLOOR = .7;
  if (article?.matches(".body")) {
    const parts = [...article.querySelectorAll(":scope > figure > table, :scope > figure pre, :scope > .equation > math")];
    const fitCol = () => {
      for (const el of parts) {
        if (el.matches("table")) {
          el.style.zoom = "";
          const fig = el.parentElement, cs = getComputedStyle(fig);
          const room = fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 1;
          const k = room / el.getBoundingClientRect().width;
          if (k < 1) el.style.zoom = Math.max(FLOOR, k);
          continue;
        }
        el.style.fontSize = "";
        if (el.scrollWidth <= el.clientWidth + 1) continue;
        const base = parseFloat(getComputedStyle(el).fontSize);
        let k = 1;
        // Width is close to linear in font size: two corrections land on it.
        for (let i = 0; i < 3 && k > FLOOR && el.scrollWidth > el.clientWidth + 1; i++) {
          k = Math.max(FLOOR, k * (el.clientWidth - 1) / el.scrollWidth);
          el.style.fontSize = base * k + "px";
        }
      }
    };
    if (parts.length) {
      new ResizeObserver(() => requestAnimationFrame(fitCol)).observe(article);
      document.fonts?.ready.then(fitCol);
    }
  }

  // Margin apparatus: the page's subsections, a plate per figure and table, and
  // the numbered equations. Each group folds.
  if (article) {
    const subs = [...article.querySelectorAll("h4[id]")];
    const figs = [...article.querySelectorAll(":scope > figure[id]")];
    const eqs = [...article.querySelectorAll(":scope > .equation")].map(e => [e, e.querySelector(":scope > p")?.textContent.trim().replace(/^\(|\)$/g, "")]).filter(([, n]) => n);
    if (subs.length || figs.length || eqs.length) {
      const aside = document.createElement("aside");
      aside.className = "local";
      aside.setAttribute("aria-label", "In this section");
      const group = (text, list) => {
        const d = Object.assign(document.createElement("details"), { open: true });
        d.append(Object.assign(document.createElement("summary"), { textContent: text }), list);
        aside.append(d);
      };
      // A clone for the margin, without the sizes Typst or the column fit gave it
      // (an SVG keeps its own unless `free`, when its cell sizes it).
      const bare = (c, free) => {
        c.removeAttribute("loading"); c.removeAttribute("id");
        c.querySelectorAll("[id]").forEach(e => e.closest("svg") || e.removeAttribute("id"));
        for (const p of ["zoom", "font-size"]) c.style.removeProperty(p);
        if (free || !c.matches("svg")) for (const p of ["width", "height"]) c.style.removeProperty(p);
        return c;
      };
      if (subs.length) {
        const ol = document.createElement("ol");
        ol.className = "subs";
        for (const h of subs) {
          const n = h.querySelector(".hn")?.textContent ?? "";
          const li = document.createElement("li");
          li.dataset.for = h.id;
          const a = Object.assign(document.createElement("a"), { href: "#" + h.id });
          a.append(Object.assign(document.createElement("span"), { className: "n", textContent: n }),
            Object.assign(document.createElement("span"), { className: "t", textContent: h.textContent.replace(n, "").trim() }));
          li.append(a);
          ol.append(li);
        }
        group("In this section", ol);
      }
      if (figs.length) {
        const ol = document.createElement("ol");
        ol.className = "plates";
        for (const f of figs) {
          const a = Object.assign(document.createElement("a"), { href: "#" + f.id });
          const th = Object.assign(document.createElement("div"), { className: "thumb" });
          // A grid of panels shows every panel, in the grid's own columns.
          const grid = f.querySelector(":scope > .subgrid");
          const panels = grid ? [...grid.querySelectorAll(":scope > * > figure > :is(img, svg), :scope > * > figure .crop")] : [];
          if (panels.length > 1) {
            const spec = grid.style.gridTemplateColumns, rep = spec.match(/repeat\(\s*(\d+)/);
            const cols = Math.min(panels.length, rep ? +rep[1] : spec.trim().split(/\s+/).length || panels.length);
            th.classList.add("is-panels");
            th.style.setProperty("--cols", cols);
            th.style.setProperty("--rows", Math.ceil(panels.length / cols));
            for (const p of panels) {
              const cell = Object.assign(document.createElement("div"), { className: "cell" });
              const c = p.matches(".crop") ? p.cloneNode(true) : bare(p.cloneNode(true), true);
              // A cropped photo keeps its cut: as large as its cell allows at its aspect ratio.
              if (c.matches(".crop")) {
                c.querySelector("img")?.removeAttribute("loading");
                c.style.width = `min(100cqw, ${parseFloat(c.style.aspectRatio) || 1} * 100cqh)`;
              }
              cell.append(c);
              th.append(cell);
            }
          } else {
            const media = f.querySelector("img, svg, table");
            if (media) th.append(bare(media.cloneNode(true), false));
          }
          const cap = f.querySelector(":scope > figcaption");
          const fl = cap?.querySelector(".fl")?.textContent ?? "";
          a.append(th, Object.assign(document.createElement("span"), { className: "fl", textContent: fl }),
            Object.assign(document.createElement("div"), { className: "cap", textContent: (cap?.textContent ?? "").replace(fl, "").trim() }));
          const li = document.createElement("li");
          li.append(a);
          ol.append(li);
        }
        group(`Figures and tables · ${figs.length}`, ol);
      }
      if (eqs.length) {
        const ol = document.createElement("ol");
        ol.className = "eqs";
        for (const [e, n] of eqs) {
          if (!e.id && !document.getElementById("eq-" + n)) e.id = "eq-" + n;
          const a = Object.assign(document.createElement("a"), { href: "#" + e.id, title: `Equation ${n}` });
          const view = Object.assign(document.createElement("div"), { className: "eqv" });
          const m = e.querySelector(":scope > math");
          if (m) view.append(bare(m.cloneNode(true), false));
          a.append(Object.assign(document.createElement("span"), { className: "n", textContent: n }), view);
          const li = document.createElement("li");
          li.append(a);
          ol.append(li);
        }
        group(`Equations · ${eqs.length}`, ol);
      }
      article.parentElement.append(aside);
      const items = [...aside.querySelectorAll("li[data-for]")];
      const spy = () => {
        let cur = null;
        for (const h of subs) if (h.getBoundingClientRect().top < innerHeight * .35) cur = h;
        for (const li of items) li.classList.toggle("is-here", li.dataset.for === cur?.id);
      };
      if (items.length) { spy(); addEventListener("scroll", () => requestAnimationFrame(spy), { passive: true }); }
    }
  }

  // A reference's target lights (site.css, `is-lit`) as soon as it is followed,
  // stays lit while the page scrolls to it, and fades a moment after the page
  // stops: on arrival, on a new hash, and on following the same link again,
  // which scrolls back without changing the hash.
  let unlight = null;
  const light = () => {
    const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!t) return;
    unlight?.();
    t.classList.add("is-lit");
    let settle;
    const wait = () => { clearTimeout(settle); settle = setTimeout(unlight, 450); };
    unlight = () => { clearTimeout(settle); removeEventListener("scroll", wait); t.classList.remove("is-lit"); unlight = null; };
    addEventListener("scroll", wait, { passive: true });
    wait();
  };
  addEventListener("hashchange", light);
  document.addEventListener("click", e => {
    const a = e.target.closest?.("a[href*='#']");
    if (a && a.hash === location.hash && a.pathname === location.pathname) light();
  });
  if (location.hash) light();

  // Following an in-page link (a reference, a margin entry) offers a way
  // back to the spot the reader left.
  const back = document.createElement("button");
  back.className = "return";
  back.type = "button";
  back.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 2.5 7 6 10.5"/><path d="M2.5 7h7a4 4 0 0 1 0 8H8"/></svg><span>Back</span>';
  back.setAttribute("aria-label", "Back to where you were");
  document.body.append(back);
  // It stays while the reader is at the target and goes once they read on.
  let origin = null, arrival = null;
  const hideBack = () => { origin = arrival = null; back.classList.remove("is-shown"); };
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !a.closest(".body, .local") || e.defaultPrevented) return;
    origin = scrollY;
    arrival = null;
    const land = () => { if (origin !== null && arrival === null) { arrival = scrollY; back.classList.add("is-shown"); } };
    addEventListener("scrollend", land, { once: true });
    setTimeout(land, 900);
  });
  back.addEventListener("click", () => {
    if (origin === null) return;
    const y = origin;
    hideBack();
    scrollTo({ top: y, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  addEventListener("scroll", () => {
    if (arrival === null) return;
    if (Math.abs(scrollY - origin) < 40 || Math.abs(scrollY - arrival) > innerHeight * .4) hideBack();
  }, { passive: true });

  // Cross-reference previews: hovering or focusing a reference to an
  // equation, figure, table, section, citation or glossary term shows it.
  // The pin keeps it open as a window that can be moved and stacked, so a
  // figure can stay in view while the text that discusses it is read.
  const cache = new Map();
  const docOf = url => {
    const key = url.split("#")[0];
    if (key === location.href.split("#")[0]) return Promise.resolve(document);
    // Opened from disk (the unzipped edition), the browser refuses to fetch other pages.
    if (location.protocol === "file:") return Promise.reject(new Error("no cross-page previews on file:"));
    if (!cache.has(key)) cache.set(key, fetch(key).then(r => r.text()).then(t => new DOMParser().parseFromString(t, "text/html")));
    return cache.get(key);
  };
  let pop = null, hideT, showT;
  // A section: its heading and what follows, up to the next heading of the same
  // or higher level. A preview keeps its opening, up to two paragraphs read past
  // any figures or lower headings in between; a pinned window holds all of it.
  function sectionOf(t, all) {
    const node = document.createElement("div");
    node.className = "xp-section";
    node.append(t.cloneNode(true));
    const level = +t.tagName[1];
    let paras = 0, chars = 0;
    for (let n = t.nextElementSibling; n && (all || paras < 2 && chars < 900); n = n.nextElementSibling) {
      if (/^H[2-6]$/.test(n.tagName) && +n.tagName[1] <= level || n.matches(".pager")) break;
      if (!all && !n.matches("p, ul, ol, .equation, h4, h5, h6")) continue;
      node.append(n.cloneNode(true));
      if (n.matches("p, ul, ol")) { paras++; chars += n.textContent.length; }
    }
    if (!all && paras === 0) node.append(Object.assign(document.createElement("p"), { className: "xp-empty", textContent: "This section opens with a figure or a list of subsections." }));
    return node;
  }
  const whole = new WeakMap();
  const hide = () => {
    const p = pop;
    pop = null;
    p?.classList.remove("is-shown");
    setTimeout(() => p?.remove(), 180);
  };
  async function show(a) {
    const url = new URL(a.href, location.href);
    const id = decodeURIComponent(url.hash.slice(1));
    if (!id || url.origin !== location.origin) return;
    let doc;
    try { doc = await docOf(url.href); } catch { return; }
    const t = doc.getElementById(id);
    if (!t || t.matches("body, main")) return;
    // Cloned content loses its ids, and its links and images resolve against its own page.
    // Ids inside an inline SVG stay: its glyphs (<use href="#g…">) and fills
    // (url(#t…)) point at them, and a figure from another page has no other copy here.
    const prep = node => {
      node.removeAttribute("id");
      node.querySelectorAll("[id]").forEach(e => e.closest("svg") || e.removeAttribute("id"));
      if (doc !== document) {
        node.querySelectorAll("img[src]").forEach(i => { i.src = new URL(i.getAttribute("src"), url).href; });
        node.querySelectorAll("a[href]").forEach(l => { l.href = new URL(l.getAttribute("href"), url).href; });
      }
      return node;
    };
    const section = t.matches("h2, h3, h4, h5");
    const node = prep(section ? sectionOf(t, false) : t.cloneNode(true));
    const head = Object.assign(document.createElement("p"), { className: "xp-head", textContent: a.textContent.replace(/[()[\]]/g, "").trim() });
    const where = doc === document ? "this page" : doc.body.dataset.title ?? doc.title;
    head.append(Object.assign(document.createElement("span"), { className: "xp-where", textContent: where }));
    hide();
    const pin = Object.assign(document.createElement("button"), { type: "button", className: "xp-pin", title: "Keep open" });
    pin.setAttribute("aria-label", "Keep open");
    pin.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2h4M7 2v4l-2.5 3h7L9 6V2M8 9v5"/></svg>';
    head.append(pin);
    pop = Object.assign(document.createElement("div"), { className: "xref-pop" });
    pop.setAttribute("role", "tooltip");
    pop.append(head, node);
    if (section) whole.set(pop, () => prep(sectionOf(t, true)));
    pin.addEventListener("click", () => pinWindow(pop));
    const w = pop;
    head.addEventListener("pointerdown", e => dragFrom(w, head, e));
    pop.addEventListener("pointerenter", () => clearTimeout(hideT));
    pop.addEventListener("pointerleave", () => { hideT = setTimeout(hide, 200); });
    document.body.append(pop);
    const r = a.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.max(12, Math.min(r.left, innerWidth - pw - 12)) + "px";
    pop.style.top = (r.bottom + 10 + ph < innerHeight ? r.bottom + 10 : Math.max(12, r.top - ph - 10)) + "px";
    const shown = pop;
    requestAnimationFrame(() => shown.classList.add("is-shown"));
  }
  // Lay `block` out as wide as lets it fit a W × H box, its height following
  // its width (an image, a vector figure, a grid of panels with their
  // subcaptions, whose text does not scale with them). Returns the width used.
  function fitWidth(block, W, H) {
    const tried = [];
    const at = w => {
      w = Math.max(24, Math.min(W, Math.floor(w)));
      block.style.setProperty("width", w + "px", "important");
      const h = block.getBoundingClientRect().height;
      tried.push([w, h]);
      return [w, h];
    };
    let [w0, h0] = at(W);
    if (h0 <= H) return W;
    let [w1, h1] = at(W * H / h0);
    // Height is close to linear in width: a few secant steps land on H.
    for (let i = 0; i < 3 && (h1 > H || H - h1 > 2) && w0 !== w1; i++) {
      const a = (h0 - h1) / (w0 - w1);
      [w0, h0] = [w1, h1];
      [w1, h1] = at(a > 0 ? w1 + (H - h1) / a : w1 * H / h1);
    }
    // Subcaptions that wrap to more lines as their panels narrow can bend it:
    // then halve the interval between a width that fits and one that does not.
    if (h1 > H) {
      let lo = 24, hi = w1;
      for (let i = 0; i < 7 && hi - lo > 2; i++) {
        const [w, h] = at((lo + hi) / 2);
        if (h <= H) lo = w; else hi = w;
      }
    }
    const last = tried.at(-1)[0];
    const fit = tried.filter(t => t[1] <= H).sort((a, b) => b[0] - a[0])[0] ?? [...tried].sort((a, b) => a[1] - b[1])[0];
    if (fit[0] !== last) at(fit[0]);
    return fit[0];
  }
  // A pinned figure window fits its figure, picture or panels, into the room
  // its header and caption leave, whatever size the window is given.
  const figBlock = fig => [...fig.children].find(c => c.matches("img, svg, p:has(img), .subgrid:has(img, svg)"));
  function fitPinned(w) {
    const fig = w.querySelector(":scope > figure");
    const block = fig && figBlock(fig);
    if (!block || !w.isConnected) return;
    block.classList.add("xp-fit");
    const cs = getComputedStyle(w), wr = w.getBoundingClientRect(), fr = fig.getBoundingClientRect();
    let other = 0;
    for (const c of fig.children) {
      if (c === block || !c.getClientRects().length) continue;
      const s = getComputedStyle(c);
      other += c.getBoundingClientRect().height + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
    }
    const top = fr.top - wr.top - w.clientTop + w.scrollTop;
    const H = Math.max(120, w.clientHeight - top - other - parseFloat(cs.paddingBottom) - 2);
    fitWidth(block, fig.clientWidth, H);
  }
  const refit = new ResizeObserver(es => requestAnimationFrame(() => es.forEach(e => fitPinned(e.target))));
  // A narrower browser window narrows a pinned one (its max size) and brings it back into view.
  addEventListener("resize", () => document.querySelectorAll(".xref-pop.is-pinned").forEach(w => {
    const r = w.getBoundingClientRect();
    w.style.left = Math.max(0, Math.min(r.left, innerWidth - r.width - 8)) + "px";
    w.style.top = Math.max(0, Math.min(r.top, innerHeight - r.height - 8)) + "px";
  }));
  let zTop = 81;
  function pinWindow(w) {
    if (!w || w.classList.contains("is-pinned")) return;
    if (pop === w) pop = null;
    clearTimeout(hideT);
    // Fix its current size, so its content follows the window from here on;
    // a section then fills in the rest of its text, read by scrolling the window,
    // and a figure grows to whatever room the window gives it.
    const fig = w.querySelector(":scope > figure"), fits = !!(fig && figBlock(fig));
    w.style.width = w.offsetWidth + "px";
    if (fits) {
      const r = w.getBoundingClientRect();
      w.style.height = Math.max(r.height, Math.min(w.scrollHeight + 2, innerHeight - r.top - 8)) + "px";
    }
    if (whole.has(w)) {
      w.style.height = w.offsetHeight + "px";
      w.querySelector(".xp-section").replaceWith(whole.get(w)());
    }
    w.classList.add("is-pinned");
    w.setAttribute("role", "dialog");
    w.style.zIndex = ++zTop;
    const head = w.querySelector(".xp-head");
    head.querySelector(".xp-pin").remove();
    const close = Object.assign(document.createElement("button"), { type: "button", className: "xp-close", title: "Close" });
    close.setAttribute("aria-label", "Close");
    close.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    close.addEventListener("click", () => { refit.unobserve(w); w.remove(); });
    head.append(close);
    w.addEventListener("pointerdown", () => { w.style.zIndex = ++zTop; });
    if (fits) { fitPinned(w); refit.observe(w); }
  }
  // Any preview moves by its header; dragging one that is not pinned yet pins it.
  function dragFrom(w, head, e) {
    if (e.button !== 0 || e.target.closest("button")) return;
    clearTimeout(hideT);
    const r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const move = m => {
      if (!w.classList.contains("is-pinned")) {
        if (Math.hypot(m.clientX - e.clientX, m.clientY - e.clientY) < 4) return;
        pinWindow(w);
      }
      w.style.left = Math.min(Math.max(m.clientX - dx, 0), innerWidth - 60) + "px";
      w.style.top = Math.min(Math.max(m.clientY - dy, 0), innerHeight - 40) + "px";
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", () => head.removeEventListener("pointermove", move), { once: true });
  }
  // Full view: clicking a figure or a table in the text opens it over the page,
  // with its caption. Clicking a figure in a preview pins it and lets the figure
  // alone fill the window, at whatever size the window is; clicking again
  // restores it. A table in a preview opens in the full view too.
  // The full view lays its plate out to fit the screen: a figure as large as
  // fits, a table enlarged when small (up to TABLE_UP) and scrolled when large.
  const TABLE_UP = 1.75;
  let lastFocus = null;
  function fullView(fig, withCaption) {
    const media = [...fig.children].filter(c => !c.matches("figcaption"));
    if (!media.length) return;
    lastFocus = document.activeElement;
    const box = Object.assign(document.createElement("div"), { className: "lightbox" });
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    const label = fig.querySelector(":scope > figcaption .fl")?.textContent ?? "Figure";
    box.setAttribute("aria-label", label);
    const stage = Object.assign(document.createElement("div"), { className: "lb-stage" });
    const canvas = Object.assign(document.createElement("div"), { className: "lb-canvas" });
    const plate = Object.assign(document.createElement("div"), { className: "lb-plate" });
    for (const m of media) {
      const c = m.cloneNode(true);
      c.querySelectorAll?.("[id]").forEach(e => e.removeAttribute("id"));
      c.removeAttribute?.("id");
      // The plate is sized here; the column's fit does not carry over.
      c.style?.removeProperty("zoom");
      plate.append(c);
    }
    plate.querySelectorAll("img").forEach(i => { i.removeAttribute("loading"); i.draggable = false; });
    // A grid of panels keeps the columns it has in the thesis, also on a phone.
    plate.querySelectorAll(".subgrid").forEach(g => g.style.gridTemplateColumns && g.style.setProperty("grid-template-columns", g.style.gridTemplateColumns, "important"));
    const isTable = !!plate.querySelector(":scope > table");
    plate.classList.toggle("is-table", isTable);
    canvas.append(plate);
    stage.append(canvas);
    const close = Object.assign(document.createElement("button"), { type: "button", className: "lb-close" });
    close.setAttribute("aria-label", "Close");
    close.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    box.append(close, stage);
    const cap = fig.querySelector(":scope > figcaption");
    if (withCaption && cap) {
      const c = cap.cloneNode(true);
      c.className = "lb-cap";
      box.append(c);
    }
    // Zoom: the wheel (about the pointer), the buttons, double-click or
    // double-tap (fit ↔ 2×), +/−/0 and pinching. The plate is zoomed with CSS
    // `zoom`, which lays it out again at the new size: vector figures redraw,
    // photos are drawn from their full-resolution source, text stays text.
    // Dragging pans whenever the plate is larger than the stage.
    const MAX = 8, STEP = Math.SQRT2;
    let base = 1, s = 1, sMin = 1;
    const icon = d => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg>`;
    const tool = (label, d) => {
      const b = Object.assign(document.createElement("button"), { type: "button", title: label, innerHTML: icon(d) });
      b.setAttribute("aria-label", label);
      return b;
    };
    const zOut = tool("Zoom out", "M4 8h8"), zIn = tool("Zoom in", "M4 8h8M8 4v8");
    const zFit = tool("Fit to screen", "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10");
    const level = Object.assign(document.createElement("span"), { className: "lb-level" });
    const tools = Object.assign(document.createElement("div"), { className: "lb-tools" });
    tools.setAttribute("role", "toolbar");
    tools.setAttribute("aria-label", "Zoom");
    tools.append(zOut, level, zIn, zFit);
    box.append(tools);
    const centre = () => { const q = stage.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; };
    // Where (x, y) falls on the plate, as fractions of it; and scrolling that point back under (x, y).
    const spot = (x, y) => { const r = plate.getBoundingClientRect(); return [(x - r.left) / r.width, (y - r.top) / r.height]; };
    const place = ([fx, fy], x, y) => {
      const r = plate.getBoundingClientRect();
      stage.scrollLeft += r.left + fx * r.width - x;
      stage.scrollTop += r.top + fy * r.height - y;
    };
    const off = (b, on) => b.setAttribute("aria-disabled", on);
    const apply = () => {
      plate.style.zoom = base * s;
      stage.classList.toggle("is-pannable", stage.scrollWidth > stage.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1);
      level.textContent = (Math.round(s * 10) / 10) + "×";
      off(zOut, s <= sMin + 1e-3); off(zIn, s >= MAX - 1e-3); off(zFit, Math.abs(s - 1) < 1e-3);
    };
    const zoomTo = (n, x, y) => {
      n = Math.min(MAX, Math.max(sMin, n));
      if (Math.abs(n - s) < 1e-3) return;
      if (x === undefined) [x, y] = centre();
      const f = spot(x, y);
      s = n;
      apply();
      place(f, x, y);
    };
    const reset = () => { s = 1; apply(); stage.scrollTo(isTable ? 0 : (stage.scrollWidth - stage.clientWidth) / 2, isTable ? 0 : (stage.scrollHeight - stage.clientHeight) / 2); };
    const toggle = (x, y) => Math.abs(s - 1) > 1e-3 ? reset() : zoomTo(2, x, y);
    zOut.addEventListener("click", () => zoomTo(s / STEP));
    zIn.addEventListener("click", () => zoomTo(s * STEP));
    zFit.addEventListener("click", reset);
    // Wheel steps are gathered per frame, so a fast wheel or a trackpad stays smooth.
    let wheel = 1, wheelAt = null;
    stage.addEventListener("wheel", e => {
      e.preventDefault();
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1);
      if (!wheelAt) requestAnimationFrame(() => { zoomTo(s * wheel, ...wheelAt); wheel = 1; wheelAt = null; });
      wheel *= Math.exp(-px * (e.ctrlKey ? .01 : .002));
      wheelAt = [e.clientX, e.clientY];
    }, { passive: false });
    // Pointers: one drags (pans), two pinch; a drag never ends as a click that closes.
    const pts = new Map();
    let gest = null, moved = false, lastTap = null, tapped = 0;
    const begin = () => {
      const [a, b] = [...pts.values()];
      gest = b ? { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s0: s, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }
        : { x: a[0], y: a[1], sl: stage.scrollLeft, st: stage.scrollTop };
    };
    stage.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.target.closest("a[href]")) return;
      // A press on the stage's own scrollbar scrolls; it is not a drag and not a click on the backdrop.
      if (e.target === stage && (e.offsetX > stage.clientWidth || e.offsetY > stage.clientHeight)) { moved = true; return; }
      if (!pts.size) moved = false;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      begin();
      if (e.pointerType === "mouse" && stage.classList.contains("is-pannable")) e.preventDefault();
    });
    stage.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId) || !gest) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (gest.pinch) {
        const [a, b] = [...pts.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        moved = true;
        zoomTo(gest.s0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / gest.pinch, ...mid);
        stage.scrollLeft -= mid[0] - gest.mid[0];
        stage.scrollTop -= mid[1] - gest.mid[1];
        gest.mid = mid;
        return;
      }
      const dx = e.clientX - gest.x, dy = e.clientY - gest.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; stage.setPointerCapture(e.pointerId); }
      if (!stage.classList.contains("is-pannable")) return;
      stage.classList.add("is-panning");
      stage.scrollLeft = gest.sl - dx;
      stage.scrollTop = gest.st - dy;
    });
    const lift = e => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size) { begin(); return; }
      gest = null;
      stage.classList.remove("is-panning");
      // A double tap toggles between fit and 2× where it lands.
      if (e.type === "pointerup" && e.pointerType === "touch" && !moved && !e.target.closest("a[href]")) {
        const now = performance.now();
        if (lastTap && now - lastTap[0] < 320 && Math.hypot(e.clientX - lastTap[1], e.clientY - lastTap[2]) < 30) {
          toggle(e.clientX, e.clientY);
          tapped = now;
          lastTap = null;
        } else lastTap = [now, e.clientX, e.clientY];
      }
    };
    stage.addEventListener("pointerup", lift);
    stage.addEventListener("pointercancel", lift);
    stage.addEventListener("mousedown", e => { if (e.detail > 1) e.preventDefault(); });
    stage.addEventListener("dblclick", e => {
      if (performance.now() - tapped < 600 || e.target.closest("a[href]") || !plate.contains(e.target)) return;
      toggle(e.clientX, e.clientY);
    });
    const shut = () => {
      box.classList.remove("is-shown");
      document.documentElement.classList.remove("has-lightbox");
      setTimeout(() => box.remove(), 200);
      lastFocus?.focus?.();
      removeEventListener("keydown", key);
      sizer.disconnect();
    };
    const key = e => {
      if (e.key === "Escape") { e.stopPropagation(); shut(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const pan = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (e.key === "+" || e.key === "=") zoomTo(s * STEP);
      else if (e.key === "-" || e.key === "_") zoomTo(s / STEP);
      else if (e.key === "0") reset();
      else if (pan) stage.scrollBy(pan[0] * stage.clientWidth * .15, pan[1] * stage.clientHeight * .15);
      else return;
      e.preventDefault();
    };
    close.addEventListener("click", shut);
    tools.addEventListener("click", e => e.target.closest("[aria-disabled=true]") && e.stopImmediatePropagation(), true);
    box.addEventListener("click", e => {
      // A link in a table leaves the full view for its target.
      if (e.target.closest("a[href]")) shut();
      else if (moved) moved = false;
      else if (e.target === box || e.target === stage || e.target === canvas) shut();
    });
    addEventListener("keydown", key);
    document.body.append(box);
    document.documentElement.classList.add("has-lightbox");
    const fit = () => {
      const r = stage.getBoundingClientRect(), W = Math.floor(r.width), H = Math.floor(r.height);
      if (!W || !H) return;
      plate.style.zoom = 1;
      if (isTable) {
        // Set as in a column as wide as the screen, then frozen at that width.
        plate.style.width = "";
        plate.style.maxWidth = W + "px";
        // A table that cannot narrow that far overflows the plate: take its own width.
        const cs = getComputedStyle(plate), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const tw = Math.ceil(Math.max(plate.getBoundingClientRect().width, plate.querySelector(":scope > table").getBoundingClientRect().width + pad));
        plate.style.width = tw + "px";
        plate.style.maxWidth = "none";
        const all = Math.min((W - 1) / tw, (H - 1) / plate.getBoundingClientRect().height);
        base = Math.min(TABLE_UP, Math.max(1, all));
        // A table larger than the screen can also be zoomed out to see it whole.
        sMin = Math.min(1, all / base);
        // Zoomed text does not shrink exactly in proportion: measure and correct.
        for (let i = 0; i < 3 && sMin < 1; i++) {
          plate.style.zoom = base * sMin;
          const z = plate.getBoundingClientRect(), k = Math.min((W - 1) / z.width, (H - 1) / z.height);
          if (k >= 1) break;
          sMin *= k;
        }
      } else {
        // Fit (1×): a photo or a grid of panels as large as fits the screen;
        // a lone vector figure at the size Typst gives it (the print size),
        // in a box at least 70% of the screen tall, as before the view zoomed.
        base = 1; sMin = 1;
        const svg = plate.childElementCount === 1 && plate.querySelector(":scope > svg");
        if (svg) {
          plate.style.removeProperty("width");
          plate.style.maxWidth = W + "px";
          const cs = getComputedStyle(plate);
          const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
          for (const [k, v] of [["width", svg.style.width || "auto"], ["height", svg.style.height || "auto"], ["max-width", W - padX + "px"],
            ["max-height", H - padY + "px"], ["min-height", Math.min(innerHeight * .7, H - padY) + "px"]]) svg.style.setProperty(k, v, "important");
        } else fitWidth(plate, W, H);
      }
      s = Math.min(MAX, Math.max(sMin, s));
      apply();
    };
    fit();
    // A new stage size refits, keeping the point at its centre where it was.
    const sizer = new ResizeObserver(() => requestAnimationFrame(() => {
      const f = spot(...centre());
      fit();
      place(f, ...centre());
    }));
    sizer.observe(stage, { box: "border-box" });
    requestAnimationFrame(() => box.classList.add("is-shown"));
    close.focus();
  }

  // A click that ends a selection of a figure's text selects; it does not open.
  const selecting = fig => { const s = getSelection(); return !!s && !s.isCollapsed && s.rangeCount > 0 && s.getRangeAt(0).intersectsNode(fig); };
  document.addEventListener("click", e => {
    if (e.target.closest("a, button, .lightbox")) return;
    const inText = e.target.closest(".body figure, .xp-section figure");
    const inPop = !inText && e.target.closest(".xref-pop figure");
    if (!(inText || inPop) || selecting(inText || inPop)) return;
    const table = e.target.closest("figure > table");
    if (inPop && table) {
      const w = inPop.closest(".xref-pop");
      if (!w.classList.contains("is-pinned")) pinWindow(w);
      fullView(table.parentElement, true);
      return;
    }
    if (inPop && e.target.closest("img, svg")) {
      const w = inPop.closest(".xref-pop");
      if (!w.classList.contains("is-pinned")) pinWindow(w);
      if (!w.classList.contains("is-figure-only")) w.style.height = w.offsetHeight + "px";
      w.classList.toggle("is-figure-only");
      fitPinned(w);
      const r = w.getBoundingClientRect();
      w.style.left = Math.max(8, Math.min(r.left, innerWidth - r.width - 8)) + "px";
      w.style.top = Math.max(8, Math.min(r.top, innerHeight - r.height - 8)) + "px";
      return;
    }
    if (inText && e.target.closest("img, svg, .subgrid, figure > table")) fullView(inText.closest(".body > figure, .xp-section > figure") ?? inText, true);
  });

  const refOf = e => e.target.closest?.('.body a[href*="#"]:not([role="doc-backlink"])');
  if (matchMedia("(hover: hover)").matches) {
    document.addEventListener("pointerover", e => {
      const a = refOf(e);
      if (!a) return;
      clearTimeout(hideT); clearTimeout(showT);
      showT = setTimeout(() => show(a), 220);
    });
    document.addEventListener("pointerout", e => {
      if (!refOf(e)) return;
      clearTimeout(showT);
      hideT = setTimeout(hide, 220);
    });
  }
  // Keyboard focus shows a preview too; a tap, which also focuses, follows the link.
  // (The focusout that came before it must not hide the preview it opens.)
  document.addEventListener("focusin", e => { const a = refOf(e); if (a?.matches(":focus-visible")) { clearTimeout(hideT); show(a); } });
  document.addEventListener("focusout", () => { hideT = setTimeout(hide, 150); });
  // Homepage citation: copy the BibTeX entry; if the browser refuses, open the entry selected for a manual copy.
  document.addEventListener("click", async e => {
    const b = e.target.closest?.(".bib-copy");
    if (!b) return;
    const label = b.textContent;
    const bib = b.parentElement.querySelector(".bib");
    const text = bib.querySelector("pre").textContent;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      // No async clipboard (insecure origin, permission denied): copy from a hidden field.
      const t = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
      t.style.cssText = "position: fixed; opacity: 0;";
      document.body.append(t);
      t.select();
      ok = document.execCommand("copy");
      t.remove();
    }
    if (!ok) {
      bib.open = true;
      getSelection().selectAllChildren(bib.querySelector("pre"));
    }
    b.textContent = ok ? "Copied" : "Selected: press Ctrl+C";
    setTimeout(() => { b.textContent = label; }, ok ? 1600 : 4000);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !document.querySelector(".lightbox")) hide();
    if (e.key.toLowerCase() === "p" && pop && !e.target.closest?.("input, textarea")) pinWindow(pop);
  });
})();
