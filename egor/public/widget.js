(() => {
  "use strict";
  const onlyTestResource = [...document.querySelectorAll("link[href],script[src]")]
    .some(el => /\/themes\/onlytest\//i.test(el.href || el.src || ""));
  const forcedOnlyTest = new URLSearchParams(location.search).get("set_force_theme") === "onlytest";
  if ((!onlyTestResource && !forcedOnlyTest) || document.getElementById("onlyflora-egor-preview")) return;
  const script = document.currentScript;
  if (!script?.src) return;
  const endpoint = new URL("./", script.src);
  const host = document.createElement("div");
  host.id = "onlyflora-egor-preview";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial}*{box-sizing:border-box}
    #launcher{position:fixed;right:22px;bottom:88px;z-index:2147482000;display:flex;align-items:center;gap:10px;padding:7px 15px 7px 7px;border:0;border-radius:34px;background:#fff;color:#183526;font:750 14px/20px Arial,sans-serif;box-shadow:0 8px 30px #102b1d38;cursor:pointer}
    #launcher svg{width:46px;height:46px;border-radius:50%;background:#dff2e6}
    #backdrop{position:fixed;inset:0;z-index:2147482500;background:rgba(10,25,18,.38);opacity:0;pointer-events:none;transition:opacity .2s ease}
    #panel{position:fixed;z-index:2147482600;top:0;right:0;width:min(620px,43vw);height:100dvh;background:#fff;box-shadow:-15px 0 45px rgba(11,32,21,.18);transform:translateX(102%);transition:transform .24s ease;overflow:hidden}
    #backdrop.open{opacity:1;pointer-events:auto}#panel.open{transform:translateX(0)}
    #close{position:absolute;right:17px;top:16px;z-index:2;display:grid;place-items:center;width:38px;height:38px;padding:0;border:0;border-radius:50%;background:#fff;color:#24342d;font:300 30px/30px Arial,sans-serif;cursor:pointer;box-shadow:0 2px 12px #0000000f}
    iframe{width:100%;height:100%;border:0;background:#fff}
    button:focus-visible{outline:3px solid #68c58a;outline-offset:3px}
    @media(max-width:1099px){#panel{width:min(680px,88vw)}body{} }
    @media(max-width:650px){#launcher{right:12px;bottom:78px;padding-right:12px;font-size:12px}#launcher svg{width:40px;height:40px}#panel{width:100vw}#close{top:10px;right:10px}#backdrop{background:rgba(10,25,18,.2)}}`;

  const avatar = `<svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="48" fill="#dff2e6"/><path d="M12 80c8-20 21-28 36-28s29 8 36 28v16H12Z" fill="#6b442b"/><circle cx="48" cy="39" r="25" fill="#efb27f"/><path d="M24 36C25 18 36 8 49 8c14 0 24 10 25 26-7-7-15-12-24-13-8 8-17 12-26 15Z" fill="#d6d9d8"/><path d="M30 50c7 2 12 7 18 14 7-7 12-12 19-14-2 14-9 22-19 22S32 64 30 50Z" fill="#eef2ef"/><circle cx="37" cy="39" r="3" fill="#28342e"/><circle cx="59" cy="39" r="3" fill="#28342e"/><path d="M41 50c5 3 10 3 15 0" fill="none" stroke="#7d3427" stroke-width="2.5" stroke-linecap="round"/><g fill="none" stroke="#38423d" stroke-width="2"><circle cx="36" cy="39" r="8"/><circle cx="60" cy="39" r="8"/><path d="M44 39h8"/></g><path d="M77 22c10 3 15 10 13 21-9-1-15-6-18-14Z" fill="#1ca85a"/></svg>`;
  const launcher = document.createElement("button");
  launcher.id = "launcher"; launcher.type = "button"; launcher.setAttribute("aria-haspopup", "dialog"); launcher.innerHTML = `${avatar}<span>Подобрать растения</span>`;
  const backdrop = document.createElement("div"); backdrop.id = "backdrop";
  const panel = document.createElement("section"); panel.id = "panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", "Егор Григорьевич S — подбор растений");
  const close = document.createElement("button"); close.id = "close"; close.type = "button"; close.setAttribute("aria-label", "Закрыть помощника"); close.textContent = "×";
  const frame = document.createElement("iframe"); frame.title = "Егор Григорьевич S"; frame.referrerPolicy = "no-referrer"; frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads");

  function openPanel() {
    if (!frame.src) frame.src = endpoint.href;
    panel.classList.add("open"); backdrop.classList.add("open"); launcher.hidden = true;
    document.body.classList.add("of-egor-open"); close.focus();
  }
  function closePanel() {
    panel.classList.remove("open"); backdrop.classList.remove("open"); launcher.hidden = false;
    document.body.classList.remove("of-egor-open"); launcher.focus();
  }
  launcher.addEventListener("click", openPanel); close.addEventListener("click", closePanel); backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && panel.classList.contains("open")) closePanel(); });
  panel.append(close, frame); root.append(style, launcher, backdrop, panel); document.body.append(host);
  if (new URLSearchParams(location.search).get("egor_open") === "1") requestAnimationFrame(openPanel);
})();
