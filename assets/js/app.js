// AERA One — page behaviour.
//
// Lifted verbatim from the authored component, minus the three seams that
// belonged to the editor runtime: refs now come from data-ref attributes,
// componentDidMount is mount(), and this.props is the PROPS constant below.
//
// Load order: gsap, ScrollTrigger and lenis are deferred ahead of this file;
// three.js is async, so initFlow waits for window.THREE the same way it always
// did and the particle field simply starts whenever the bundle lands.

// The <x-dc> element carried no overrides, so every prop is its declared default.
const PROPS = {
  motionLevel: "cinematic", // restrained | balanced | cinematic
  flowDensity: 1,           // 0.3 - 1.6
  accent: "#ffffff",
  grain: true
};

class Aera {
  // Was renderVals(): the runtime called each ref callback with its element.
  // The markup now carries data-ref instead, so one pass over the document
  // produces the same this.<name> fields.
  bindRefs() {
    document.querySelectorAll("[data-ref]").forEach((el) => { this[el.dataset.ref] = el; });
  }

  mount() {
    this.bindRefs();
    this.initLoader();
    // Deliberately outside boot(): the menu is the one thing that has to work
    // whether or not the GSAP/Lenis bundle ever arrives.
    this.initMenu();
    this.waitFor(() => window.gsap && window.ScrollTrigger, () => this.boot());
  }

  // Mobile menu. The panel markup ships in the DOM and CSS owns every visual
  // state; this only flips data-open, locks the page behind it, and keeps
  // focus inside while it's up.
  initMenu() {
    const btn = this.menuBtn, panel = this.menu, inner = this.menuInner;
    if (!btn || !panel) return;
    this.menuOpen = false;

    const focusables = () => Array.prototype.filter.call(
      panel.querySelectorAll('a[href], button:not([disabled])'),
      (el) => el.offsetParent !== null || el.getClientRects().length
    );

    const setOpen = (open) => {
      if (this.menuOpen === open) return;
      this.menuOpen = open;
      panel.setAttribute("data-open", open ? "true" : "false");
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) panel.removeAttribute("inert"); else panel.setAttribute("inert", "");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (this.nav) this.nav.setAttribute("data-menu", open ? "open" : "closed");
      // Lenis owns wheel/touch when it's running; the raw blockers below cover
      // the reduced-motion path where the page scrolls natively.
      if (this.lenis) { if (open) this.lenis.stop(); else this.lenis.start(); }
      clearTimeout(this.menuSnapTimer);
      if (open) {
        // Transitions freeze when the tab stops painting, which would leave an
        // invisible panel holding focus. setTimeout still fires there, so if the
        // fade hasn't landed by the time it should have, snap to the open state.
        panel.classList.remove("is-instant");
        this.menuSnapTimer = setTimeout(() => {
          if (this.menuOpen && parseFloat(getComputedStyle(panel).opacity) < 0.9) panel.classList.add("is-instant");
        }, 700);
        const first = focusables()[0];
        if (first) first.focus({ preventScroll: true });
      } else if (panel.contains(document.activeElement)) {
        btn.focus({ preventScroll: true });
      }
    };
    this.setMenuOpen = setOpen;

    this.onMenuToggle = () => setOpen(!this.menuOpen);
    btn.addEventListener("click", this.onMenuToggle);

    // A link tap closes first, so Lenis is running again by the time the
    // document-level anchor handler starts its scrollTo.
    this.onMenuLink = (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a) setOpen(false);
    };
    panel.addEventListener("click", this.onMenuLink);

    this.onMenuScrollBlock = (e) => {
      if (!this.menuOpen) return;
      if (inner && inner.contains(e.target)) return;
      if (e.cancelable) e.preventDefault();
    };
    window.addEventListener("wheel", this.onMenuScrollBlock, { passive: false });
    window.addEventListener("touchmove", this.onMenuScrollBlock, { passive: false });

    const SCROLL_KEYS = [" ", "Spacebar", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"];
    this.onMenuKey = (e) => {
      if (!this.menuOpen) return;
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        // The burger is outside the panel but is the close control, so it
        // stays in the loop rather than being trapped out of reach.
        const ring = [btn].concat(items);
        const i = ring.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); btn.focus(); }
        else if (i === -1) { e.preventDefault(); first.focus(); }
        return;
      }
      if (SCROLL_KEYS.indexOf(e.key) !== -1 && !panel.contains(document.activeElement)) e.preventDefault();
    };
    document.addEventListener("keydown", this.onMenuKey);

    // Resizing past the breakpoint hides the burger; leaving the panel open
    // would strand it with no visible way out.
    this.onMenuResize = () => { if (window.innerWidth >= 900) setOpen(false); };
    window.addEventListener("resize", this.onMenuResize);
  }

  initLoader() {
    if (!this.loader || !this.loaderLogo) return;
    const panel = this.loader, logo = this.loaderLogo;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const FADE = reduced ? 0 : 600;
    const MIN_VISIBLE = 600;  // below this the wordmark reads as a flicker
    const MAX_WAIT = 4000;    // the loader must never be what keeps the page hidden
    const t0 = performance.now();

    // rAF never fires in a background tab, so pair it with a timer. The fade-in
    // is cosmetic; the dismissal below runs on promises and timers only, so a
    // tab that loads unfocused still reveals the page.
    logo.style.transition = reduced ? "none" : "opacity 0.6s ease";
    let shown = false;
    const show = () => { if (shown) return; shown = true; logo.style.opacity = "1"; };
    requestAnimationFrame(show);
    setTimeout(show, 50);

    const hide = () => {
      if (this.loaderHidden) return;
      this.loaderHidden = true;
      panel.style.transition = reduced ? "none" : "opacity 0.6s ease";
      panel.style.opacity = "0";
      setTimeout(() => { panel.style.display = "none"; }, FADE + 50);
    };

    const heroImg = this.heroImg ? this.heroImg.querySelector("img") : null;
    const heroReady = heroImg && heroImg.decode
      ? heroImg.decode().catch(() => {})
      : new Promise((r) => {
          if (!heroImg || heroImg.complete) return r();
          heroImg.onload = heroImg.onerror = r;
        });
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

    Promise.all([heroReady, fontsReady]).then(() => {
      setTimeout(hide, Math.max(0, MIN_VISIBLE - (performance.now() - t0)));
    });
    setTimeout(hide, MAX_WAIT);
  }

  teardown() {
    this.dead = true;
    const gsap = this.gsap || window.gsap;
    if (gsap && this.rafFn) gsap.ticker.remove(this.rafFn);
    this.rafFn = null;
    if (this.st) this.st.forEach((t) => { try { t.kill(); } catch (e) {} });
    this.st = [];
    if (this.lenis) { try { this.lenis.destroy(); } catch (e) {} this.lenis = null; }
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.renderer) { try { this.renderer.dispose(); } catch (e) {} this.renderer = null; }
    if (this.onResize) window.removeEventListener("resize", this.onResize);
    if (this.onPointer) window.removeEventListener("pointermove", this.onPointer);
    if (this.onHeroResize) window.removeEventListener("resize", this.onHeroResize);
    if (this.onTechResize) window.removeEventListener("resize", this.onTechResize);
    if (this.onAnchor) document.removeEventListener("click", this.onAnchor);
    if (this.menuBtn && this.onMenuToggle) this.menuBtn.removeEventListener("click", this.onMenuToggle);
    if (this.menu && this.onMenuLink) this.menu.removeEventListener("click", this.onMenuLink);
    if (this.onMenuScrollBlock) {
      window.removeEventListener("wheel", this.onMenuScrollBlock, { passive: false });
      window.removeEventListener("touchmove", this.onMenuScrollBlock, { passive: false });
    }
    if (this.onMenuKey) document.removeEventListener("keydown", this.onMenuKey);
    if (this.onMenuResize) window.removeEventListener("resize", this.onMenuResize);
    if (this.readTimer) clearInterval(this.readTimer);
    if (this.menuSnapTimer) clearTimeout(this.menuSnapTimer);
    if (this.heroSettleTimer) clearTimeout(this.heroSettleTimer);
    if (window.__aera === this) { window.__aera = null; window.__aeraBooted = false; }
  }

  waitFor(test, done, tries) {
    tries = tries || 0;
    if (this.dead) return;
    if (test()) return done();
    if (tries > 140) return;
    setTimeout(() => this.waitFor(test, done, tries + 1), 60);
  }

  get motion() {
    const m = PROPS.motionLevel || "cinematic";
    if (m === "restrained") return { d: 0.6, stagger: 0.05, travel: 16 };
    if (m === "balanced") return { d: 0.9, stagger: 0.08, travel: 26 };
    return { d: 1.25, stagger: 0.11, travel: 38 };
  }

  boot() {
    if (window.__aeraBooted && window.__aera && window.__aera !== this) window.__aera.teardown();
    if (window.__aeraBooted) return;
    // One captured reference for the whole lifetime: re-reading window.ScrollTrigger can
    // hand back a second library copy and kill the wrong instance's pins.
    const gsap = window.gsap, ST = window.ScrollTrigger;
    this.gsap = gsap;
    this.ST = ST;
    gsap.registerPlugin(ST);
    ST.getAll().forEach((t) => { try { t.kill(); } catch (e) {} });
    gsap.ticker.wake();
    window.__aera = this;
    window.__aeraBooted = true;
    this.dead = false;
    this.st = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const M = this.motion;

    if (this.grain) this.grain.style.display = PROPS.grain === false ? "none" : "block";
    const accent = PROPS.accent;
    if (accent) document.documentElement.style.setProperty("--accent", accent);

    this.initSmoothScroll(gsap, ST, reduced);
    this.initReveals(gsap, ST, M, reduced);
    this.initHero(gsap, ST, M, reduced);
    this.initInvisible(gsap, ST, reduced);
    this.initTech(gsap, ST);
    this.initCta(gsap, ST, reduced);
    this.initDisplay();
    this.initHeroLayout();
    this.initTechLayout();
    this.waitFor(() => window.THREE, () => this.initFlow());
    ST.refresh();
    // Both pins exist now; pin-spacer geometry needs one more pass after layout/fonts settle.
    setTimeout(() => { if (!this.dead) ST.refresh(); }, 400);
    setTimeout(() => { if (!this.dead) ST.refresh(); }, 1600);
  }

  initSmoothScroll(gsap, ST, reduced) {
    if (window.Lenis && !reduced) {
      this.lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
      this.lenis.on("scroll", ST.update);
      this.rafFn = (t) => {
        if (this.dead || !this.lenis) return;
        try { this.lenis.raf(t * 1000); } catch (e) { this.lenis = null; }
      };
      gsap.ticker.add(this.rafFn);
      gsap.ticker.lagSmoothing(0);
      // Lenis arrives after the menu wires itself up; if the panel is already
      // open, it must not start scrolling the page behind it.
      if (this.menuOpen) this.lenis.stop();
    }
    this.onAnchor = (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute("href");
      if (href === "#top") {
        e.preventDefault();
        if (this.lenis) this.lenis.scrollTo(0, { duration: 1.4 });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      if (this.lenis) this.lenis.scrollTo(el, { offset: 0, duration: 1.4 });
      else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
    };
    document.addEventListener("click", this.onAnchor);
  }

  initReveals(gsap, ST, M, reduced) {
    const root = this.nav && this.nav.parentNode ? this.nav.parentNode : document;
    const lines = root.querySelectorAll("[data-line]");
    const fades = root.querySelectorAll("[data-fade]");
    const cards = root.querySelectorAll("[data-card]");
    const feats = root.querySelectorAll("[data-feat]");
    const slides = root.querySelectorAll("[data-slide-in]");

    if (reduced) {
      gsap.set([].concat(Array.from(lines), Array.from(fades), Array.from(cards), Array.from(feats), Array.from(slides)), { clearProps: "all" });
      return;
    }

    // Elements already inside the viewport at load play immediately; the rest wait for a trigger.
    const arm = (el, from, to, delay) => {
      gsap.set(el, from);
      const play = () => gsap.to(el, Object.assign({}, to, { delay: delay || 0, overwrite: "auto" }));
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9) { play(); return; }
      this.st.push(ST.create({ trigger: el, start: "top 90%", once: true, onEnter: play }));
    };

    lines.forEach((el, i) => arm(el, { yPercent: 108 }, { yPercent: 0, duration: M.d, ease: "expo.out" }, 0.08 + i * 0.02));
    fades.forEach((el) => arm(el, { opacity: 0, y: M.travel * 0.6 }, { opacity: 1, y: 0, duration: M.d * 0.85, ease: "power3.out" }, 0.18));
    feats.forEach((el) => arm(el, { opacity: 0, y: M.travel * 0.5 }, { opacity: 1, y: 0, duration: M.d * 0.8, ease: "power3.out" }, 0));
    cards.forEach((el, i) => arm(el, { opacity: 0, y: M.travel }, { opacity: 1, y: 0, duration: M.d, ease: "expo.out" }, i * M.stagger));
    slides.forEach((el) => arm(el, { opacity: 0, xPercent: -6, scale: 1.04 }, { opacity: 1, xPercent: 0, scale: 1, duration: 1.5, ease: "expo.out" }, 0.1));
  }

  initHero(gsap, ST, M, reduced) {
    if (!this.nav) return;
    this.st.push(ST.create({
      start: 40, end: 99999,
      onUpdate: (self) => {
        const on = self.scroll() > 40;
        this.nav.style.background = on ? "rgba(4,4,5,0.72)" : "rgba(4,4,5,0)";
        this.nav.style.backdropFilter = on ? "blur(18px)" : "blur(0px)";
        this.nav.style.borderBottomColor = on ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0)";
      }
    }));

    if (!this.heroInner) return;
    if (reduced) { gsap.set(this.heroInner, { opacity: 0.95 }); return; }
    // The entrance push-in is a desktop move. On mobile the band is framed tight
    // around the device and clips, so scaling from 1.09 would shave the top of
    // the cylinder for the length of the intro. There, the fade carries it alone.
    const heroScaleIn = window.innerWidth < 900 ? 1 : 1.09;
    gsap.fromTo(this.heroInner, { opacity: 0, scale: heroScaleIn }, { opacity: 0.95, scale: 1, duration: 2.4, ease: "expo.out" });
    this.st.push(ST.create({
      trigger: this.hero, start: "top top", end: "bottom top", scrub: true,
      pin: this.hero, pinSpacing: false, pinType: "fixed", anticipatePin: 1,
      onUpdate: (self) => {
        // Hero is pinned: it holds still while the next section slides up over it.
        // The sink (scale + brightness) is what reads as "sliding underneath".
        const p = self.progress, e = p * p;
        const tail = p < 0.86 ? 0 : (p - 0.86) / 0.14;
        gsap.set(this.hero, { scale: 1 - e * 0.07, filter: "brightness(" + (1 - e * 0.45) + ")", opacity: 1 - tail, overwrite: false });
        this.hero.style.visibility = p > 0.995 ? "hidden" : "visible";
        gsap.set(this.heroInner, { yPercent: p * 4, scale: 1 + p * 0.03, opacity: 0.95, overwrite: false });
      }
    }));
  }

  initInvisible(gsap, ST, reduced) {
    if (!this.invisible) return;
    const tl = gsap.timeline({ paused: true });
    const words = this.beat1 ? this.beat1.querySelectorAll("[data-word]") : [];
    if (words.length) {
      tl.fromTo(words,
        { color: "rgba(255,255,255,0.16)" },
        { color: "rgba(255,255,255,1)", duration: 0.22, ease: "none", stagger: { each: 0.085 } }, 0.05);
    }
    tl.to(this.beat1Copy, { opacity: 1, duration: 0.3, ease: "power1.out" }, 0.62)
      .to(this.beat1, { opacity: 0, y: -40, duration: 0.8, ease: "power2.inOut" }, 1.05)
      .fromTo(this.beat2, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" }, 1.3)
      .to(this.beat2, { opacity: 0, y: -40, duration: 0.8, ease: "power2.inOut" }, 2.5)
      .fromTo(this.beat3, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" }, 2.9);

    // ScrollTrigger only populates isActive from its first update, so onToggle
    // alone leaves this undefined through the whole first screen and the guard
    // in initFlow (=== false) never catches. Measure the panel instead: correct
    // at load, on resize, and on a deep-linked entry part-way down.
    const flowOnScreen = () => {
      const el = this.invisiblePin || this.invisible;
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    this.flowActive = flowOnScreen();
    this.st.push(ST.create({
      trigger: this.invisible, start: "top top", end: "bottom bottom",
      pin: this.invisiblePin, pinSpacing: false, scrub: reduced ? true : 0.7,
      // Driven by hand: a timeline from one gsap core handed to a ScrollTrigger bound to
      // another core never scrubs. progress() renders on the timeline's own core.
      onUpdate: (self) => { this.flowProgress = self.progress; tl.progress(self.progress); },
      onRefresh: (self) => { tl.progress(self.progress); this.flowActive = flowOnScreen(); },
      onToggle: (self) => { this.flowActive = self.isActive; }
    }));
  }

  initTech(gsap, ST) {
    if (!this.tech) return;
    const layers = [this.layer1, this.layer2, this.layer3];
    const rings = [this.ringOuter, this.ringMid, this.ringInner];

    const tl = gsap.timeline({ paused: true });
    layers.forEach((el, i) => {
      const ring = rings[i];
      tl.to(el, { opacity: 1, duration: 0.5, ease: "power2.out" }, i * 1.1 + 0.2)
        .to(ring, { borderColor: "rgba(255,255,255,0.85)", scale: 1.04, duration: 0.6, ease: "power2.out" }, i * 1.1 + 0.2);
      if (i < layers.length - 1) {
        tl.to(el, { opacity: 0.55, duration: 0.5, ease: "power2.in" }, i * 1.1 + 0.95)
          .to(ring, { borderColor: "rgba(255,255,255,0.12)", scale: 1, duration: 0.6, ease: "power2.in" }, i * 1.1 + 0.95);
      }
    });
    tl.fromTo(this.core, { scale: 0.6, opacity: 0.5 }, { scale: 1.5, opacity: 1, duration: 1.2, ease: "power2.out" }, 2.2);

    this.st.push(ST.create({
      trigger: this.tech, start: "top top", end: "bottom bottom",
      pin: this.techPin, pinSpacing: false, scrub: 0.7,
      onUpdate: (self) => { tl.progress(self.progress); },
      onRefresh: (self) => tl.progress(self.progress)
    }));
  }

  initCta(gsap, ST, reduced) {
    if (!this.cta || !this.ctaImg) return;
    const tl = gsap.timeline();
    tl.fromTo(this.ctaImg, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 1, ease: "none" });
    this.st.push(ST.create({
      trigger: this.cta, start: "top bottom", end: "center center",
      scrub: reduced ? true : 1, animation: tl
    }));
  }

  // No media queries available (inline styles only), so the hero's two layouts are
  // applied here: desktop = copy pinned left of the centred product; mobile = stacked
  // and centre-aligned with the product below the button.
  initHeroLayout() {
    const sec = this.hero, copy = this.heroCopy, img = this.heroImg, inner = this.heroInner;
    if (!sec || !copy || !img) return;
    // Product silhouette measured off the 1672x941 source frame: the cylinder
    // occupies x 702-971, y 119-828, and its floor glow trails to y 909. The
    // mobile band is framed against these numbers rather than the frame edges,
    // so the device is what gets sized, not the artwork around it.
    const SRC_W = 1672, SRC_H = 941;
    const DEV_TOP = 119, DEV_BOTTOM = 828, DEV_CX = 836.5, DEV_W = 269;
    const FRAME_BOTTOM = 880; // device base plus enough glow to land on, not cut at
    const apply = () => {
      const mobile = window.innerWidth < 900;
      if (mobile) {
        sec.style.flexDirection = "column";
        sec.style.justifyContent = "flex-start";
        sec.style.gap = "clamp(20px, 3vh, 36px)";
        // Padding lives in the stylesheet under the 899px query, not here: the
        // pin rewrites this element's inline padding on every refresh.
        copy.style.maxWidth = "520px";
        copy.style.margin = "0 auto";
        copy.style.alignItems = "center";
        copy.style.textAlign = "center";
        // The band takes everything left under the button, down to the section
        // edge, and clips whatever of the frame doesn't fit.
        img.style.position = "relative";
        img.style.inset = "auto";
        // Full bleed by cancelling the section's own gutters, not by 100vw: that
        // unit counts the scrollbar while the sibling percentage resolves against
        // the padded box, which left the band a few pixels off the visible centre.
        // Stretch is required because the section centres items on the cross axis.
        img.style.alignSelf = "stretch";
        img.style.width = "auto";
        img.style.marginLeft = "calc(-1 * clamp(20px, 5vw, 40px))";
        img.style.marginRight = "calc(-1 * clamp(20px, 5vw, 40px))";
        img.style.height = "auto";
        img.style.flex = "1 1 auto";
        img.style.minHeight = "0";
        img.style.overflow = "hidden";
        img.style.order = "2";
        copy.style.order = "1";
        if (inner) inner.style.height = "100%";
        const el = img.querySelector("img");
        if (el) {
          // Frame the device, not the picture. object-fit can only scale against
          // the frame's own edges, which either shrinks the cylinder to nothing
          // (contain) or slices its top and base off (cover). Placing the image
          // by hand is the only way to promise both halves of the brief: the
          // device whole, and its top edge exactly where the band begins.
          const bw = img.clientWidth, bh = img.clientHeight;
          // Height drives the scale; the width term is a guard so the cylinder
          // can't outgrow a narrow band on a short, wide screen.
          const k = Math.min(bh / (FRAME_BOTTOM - DEV_TOP), (bw * 0.86) / DEV_W);
          el.style.position = "absolute";
          el.style.maxWidth = "none";
          el.style.width = (SRC_W * k) + "px";
          el.style.height = (SRC_H * k) + "px";
          el.style.left = (bw / 2 - DEV_CX * k) + "px";
          el.style.top = (-DEV_TOP * k) + "px";
          el.style.objectFit = "fill";
          el.style.objectPosition = "";
        }
      } else {
        sec.style.flexDirection = "row";
        sec.style.justifyContent = "flex-start";
        sec.style.gap = "0px";
        sec.style.padding = "130px clamp(20px, 4vw, 60px) 80px";
        // The product's left edge is height-driven under object-fit: cover, so cap the
        // copy width against the measured silhouette instead of a fixed vw value.
        const boxW = sec.clientWidth, boxH = sec.clientHeight;
        const scale = Math.max(boxW / 1672, boxH / 941);
        const offX = (boxW - 1672 * scale) / 2;
        const productLeft = 686 * scale + offX;
        const gutter = Math.max(20, Math.min(60, boxW * 0.04));
        const cap = Math.max(300, productLeft - gutter - 56);
        copy.style.maxWidth = Math.min(520, cap) + "px";
        copy.style.margin = "0";
        img.style.order = "";
        copy.style.order = "";
        copy.style.alignItems = "flex-start";
        copy.style.textAlign = "left";
        img.style.position = "absolute";
        img.style.inset = "0";
        img.style.width = "";
        img.style.height = "";
        img.style.marginLeft = "";
        img.style.marginRight = "";
        img.style.alignSelf = "";
        img.style.flex = "";
        img.style.minHeight = "";
        img.style.overflow = "";
        if (inner) inner.style.height = "100%";
        const el = img.querySelector("img");
        if (el) {
          // Undo the hand-placed mobile framing and hand the frame back to
          // object-fit, exactly as the desktop composition was authored.
          el.style.position = "";
          el.style.maxWidth = "";
          el.style.left = "";
          el.style.top = "";
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.objectFit = "cover";
          el.style.objectPosition = "50% 50%";
        }
      }
      if (this.ST) this.ST.refresh();
    };
    apply();
    this.onHeroResize = () => { clearTimeout(this.heroTimer); this.heroTimer = setTimeout(apply, 140); };
    window.addEventListener("resize", this.onHeroResize);
    // The band's height is whatever the copy leaves behind, so the framing has
    // to be recomputed once the webfont has settled the headline's line count.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!this.dead) apply(); });
    this.heroSettleTimer = setTimeout(() => { if (!this.dead) apply(); }, 900);
  }

  // Mobile keeps the desktop pinned scroll-scrub; only the geometry changes — the ring
  // stack is clipped to its lower half so ring + title + all three layers fit one viewport.
  // Mobile is height-driven: the copy is scaled down until the circle has room, and the
  // circle then takes exactly what is left — nothing overflows the pinned block.
  sizeMobileRings() {
    const wrap = this.techRingWrap, grid = this.techGrid;
    const col = this.techTitle ? this.techTitle.parentElement : null;
    const rows = [this.layer1, this.layer2, this.layer3].filter(Boolean);
    if (!wrap || !grid || !col) return;

    const setCopy = (k) => {
      if (this.techTitle) this.techTitle.style.fontSize = Math.round(26 * k) + "px";
      col.style.gap = Math.round(18 * k) + "px";
      if (this.techList) this.techList.style.gap = "0px";
      rows.forEach((row) => {
        row.style.padding = Math.round(13 * k) + "px 0";
        row.style.gap = Math.round(14 * k) + "px";
        const inner = row.querySelector("div");
        const t = row.querySelector("div > div");
        const p = row.querySelector("p");
        if (inner) inner.style.gap = Math.round(8 * k) + "px";
        if (t) t.style.fontSize = Math.max(13, Math.round(18 * k)) + "px";
        if (p) {
          p.style.fontSize = Math.max(10.5, 14 * k).toFixed(1) + "px";
          p.style.lineHeight = (1.5 - (1 - k) * 0.45).toFixed(2);
        }
      });
    };

    const run = () => {
      if (this.dead || window.innerWidth >= 900) return;
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
      const H = grid.clientHeight;
      const want = Math.min(Math.max(H * 0.32, 110), window.innerWidth * 0.82, 360);
      let free = 0;
      for (let k = 1; k >= 0.66; k -= 0.06) {
        setCopy(k);
        free = H - gap - col.offsetHeight;
        if (free >= want) break;
      }
      const d = Math.max(0, Math.min(free, window.innerWidth * 0.82, 360));
      wrap.style.height = Math.round(d) + "px";
      const set = (el, r) => { if (el) el.style.width = Math.round(d * r) + "px"; };
      set(this.ringOuter, 1);
      set(this.ringMid, 0.72);
      set(this.ringInner, 0.46);
      set(this.core, 0.155);
    };
    requestAnimationFrame(run);
    run();
  }

  initTechLayout() {
    const sec = this.tech, pin = this.techPin, grid = this.techGrid;
    if (!sec || !pin || !grid) return;
    const rows = [this.layer1, this.layer2, this.layer3].filter(Boolean);
    const rings = [
      [this.ringOuter, "min(52vw, 16vh, 240px)", "min(46vh, 400px)"],
      [this.ringMid, "min(37.4vw, 11.5vh, 173px)", "min(33vh, 288px)"],
      [this.ringInner, "min(24vw, 7.4vh, 110px)", "min(21vh, 184px)"],
      [this.core, "min(8vw, 2.5vh, 37px)", "min(7vh, 62px)"]
    ];
    const col = this.techTitle ? this.techTitle.parentElement : null;
    const apply = () => {
      const mobile = window.innerWidth < 900;
      if (mobile) {
        // The stack fills the pinned block: rings take whatever height the copy leaves.
        grid.style.margin = "0 auto";
        grid.style.alignSelf = "stretch";
        grid.style.height = "100%";
        grid.style.gridTemplateColumns = "1fr";
        grid.style.gridTemplateRows = "1fr auto";
        grid.style.gap = "clamp(10px, 2vh, 24px)";
        if (col) col.style.gap = "clamp(8px, 1.6vh, 20px)";
        if (this.techRingWrap) {
          this.techRingWrap.style.minHeight = "0";
          this.techRingWrap.style.height = "auto";
          this.techRingWrap.style.overflow = "";
        }
        rings.forEach(([el]) => {
          if (!el) return;
          el.style.top = "";
          el.style.left = "";
          el.style.marginLeft = "";
        });
        if (this.techTitle) this.techTitle.style.fontSize = "clamp(22px, 5.8vw, 32px)";
        if (this.techList) this.techList.style.gap = "0px";
        rows.forEach((row) => {
          row.style.padding = "clamp(5px, 0.9vh, 15px) 0";
          row.style.gap = "12px";
          const t = row.querySelector("div > div");
          const p = row.querySelector("p");
          if (t) t.style.fontSize = "clamp(14.5px, 4vw, 18px)";
          if (p) { p.style.fontSize = "clamp(11px, 3vw, 13px)"; p.style.lineHeight = "1.35"; }
        });
        // The closing note is supplementary; dropping it is what buys the one-viewport fit.
        if (this.techNote) this.techNote.style.display = "none";
        this.sizeMobileRings();
      } else {
        sec.style.height = "340vh";
        grid.style.margin = "0 auto";
        grid.style.alignSelf = "";
        grid.style.height = "";
        grid.style.gridTemplateRows = "";
        grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))";
        grid.style.gap = "clamp(30px, 5vw, 80px)";
        if (col) col.style.gap = "26px";
        if (this.techRingWrap) {
          this.techRingWrap.style.minHeight = "min(52vh, 460px)";
          this.techRingWrap.style.height = "";
          this.techRingWrap.style.overflow = "";
        }
        rings.forEach(([el, m, d]) => {
          if (!el) return;
          el.style.width = d;
          el.style.top = "";
          el.style.left = "";
          el.style.marginLeft = "";
        });
        if (this.techTitle) this.techTitle.style.fontSize = "clamp(30px, 3.6vw, 56px)";
        if (this.techList) this.techList.style.gap = "4px";
        rows.forEach((row) => {
          row.style.padding = "22px 0";
          row.style.gap = "20px";
          const t = row.querySelector("div > div");
          const p = row.querySelector("p");
          if (t) t.style.fontSize = "clamp(18px, 1.7vw, 24px)";
          if (p) { p.style.fontSize = "15px"; p.style.lineHeight = "1.62"; }
        });
        if (this.techNote) { this.techNote.style.display = ""; this.techNote.style.fontSize = "14px"; this.techNote.style.lineHeight = "1.6"; }
      }
      if (this.ST) this.ST.refresh();
    };
    apply();
    this.onTechResize = () => { clearTimeout(this.techTimer); this.techTimer = setTimeout(apply, 140); };
    window.addEventListener("resize", this.onTechResize);
  }

  initDisplay() {
    if (!this.reading) return;
    const verdicts = [[12, "Excellent"], [26, "Good"], [40, "Fair"]];
    let v = 23;
    this.readTimer = setInterval(() => {
      if (this.dead) return;
      v = Math.max(8, Math.min(38, v + Math.round((Math.random() - 0.5) * 7)));
      this.reading.textContent = String(v);
      const hit = verdicts.find((x) => v <= x[0]) || verdicts[2];
      if (this.verdict) this.verdict.textContent = hit[1];
    }, 2600);
  }

  initFlow() {
    const THREE = window.THREE, canvas = this.canvas;
    if (!canvas || !THREE) return;

    const density = PROPS.flowDensity != null ? PROPS.flowDensity : 1;
    const mobile = window.innerWidth < 760;
    const COUNT = Math.round((mobile ? 9000 : 26000) * density);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const scale = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const band = Math.floor(Math.random() * 9);
      pos[i * 3] = (Math.random() * 2 - 1) * 7.5;
      pos[i * 3 + 1] = (band - 4) * 0.34 + (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
      seed[i] = band / 9 + Math.random() * 0.05;
      scale[i] = 0.35 + Math.pow(Math.random(), 3) * 2.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));

    const col = new THREE.Color(PROPS.accent || "#a8d8f0");
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uProg: { value: 0 },
        uSize: { value: mobile ? 34 : 46 },
        uColor: { value: new THREE.Vector3(col.r, col.g, col.b) }
      },
      vertexShader: [
        "attribute float aSeed;",
        "attribute float aScale;",
        "uniform float uTime; uniform float uProg; uniform float uSize;",
        "varying float vA;",
        "void main(){",
        "  float t = uTime;",
        "  float ph = aSeed * 24.0;",
        "  float sp = 0.5 + uProg * 1.5;",
        "  float x = mod(position.x + t * sp + 7.5, 15.0) - 7.5;",
        "  float w = 0.55 + uProg * 0.85;",
        "  float y = position.y * (1.0 + uProg * 0.55)",
        "    + sin(x * 0.42 + ph + t * 0.22) * (0.7 * w)",
        "    + sin(x * 1.15 - ph * 0.6 - t * 0.34) * (0.22 * w);",
        "  float z = position.z + cos(x * 0.36 - ph + t * 0.18) * 0.9;",
        "  vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "  gl_PointSize = uSize * aScale * (1.0 / max(0.001, -mv.z));",
        "  float edge = smoothstep(7.5, 4.6, abs(x));",
        "  vA = edge * (0.06 + uProg * 0.5) * (0.35 + aScale * 0.4);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "precision mediump float;",
        "uniform vec3 uColor;",
        "varying float vA;",
        "void main(){",
        "  vec2 d = gl_PointCoord - 0.5;",
        "  float r = dot(d, d);",
        "  float a = smoothstep(0.25, 0.0, r) * vA;",
        "  if (a < 0.002) discard;",
        "  vec3 c = mix(vec3(1.0), uColor, 0.8);",
        "  gl_FragColor = vec4(c * 0.85, a * 0.55);",
        "}"
      ].join("\n")
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    this.onResize = resize;
    window.addEventListener("resize", resize);
    resize();

    const clock = new THREE.Clock();
    let smooth = 0;
    const loop = () => {
      if (this.dead) return;
      this.frame = requestAnimationFrame(loop);
      if (this.flowActive === false) return;
      const target = this.flowProgress || 0;
      smooth += (target - smooth) * 0.022;
      mat.uniforms.uTime.value = clock.getElapsedTime() * 0.45;
      mat.uniforms.uProg.value = smooth;
      points.rotation.z = -0.04 + smooth * 0.06;
      camera.position.z = 8 - smooth * 1.6;
      renderer.render(scene, camera);
    };
    loop();
  }
}

// The runtime used to mount the component; a DOM-ready hook does it now.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new Aera().mount());
} else {
  new Aera().mount();
}

// Kept from componentWillUnmount: a bfcache restore re-runs this file, and the
// boot guard needs the previous instance to have let go of its pins first.
window.addEventListener("pagehide", () => {
  if (window.__aera) window.__aera.teardown();
});
