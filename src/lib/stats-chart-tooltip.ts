// One popup shared by all days. Values are already formatted by the same renderer as the table.
export function initStatsChartTooltip() {
  const chart = document.querySelector<HTMLElement>(".stats-bars");
  const popup = document.querySelector<HTMLElement>("#stats-day-tooltip");
  if (!chart || !popup) return;
  const targets = [...chart.querySelectorAll<HTMLButtonElement>(".stats-day-target")];
  const date = popup.querySelector("time")!;
  const visitors = popup.querySelector<HTMLElement>("[data-tooltip-visitors]")!;
  const requests = popup.querySelector<HTMLElement>("[data-tooltip-requests]")!;
  let active: HTMLButtonElement | null = null;
  let hovered: HTMLButtonElement | null = null;
  let focused: HTMLButtonElement | null = null;
  let pinned: HTMLButtonElement | null = null;
  let overPopup = false;
  let touch = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function dismiss() {
    clearTimeout(closeTimer);
    active?.removeAttribute("aria-describedby");
    active = hovered = focused = pinned = null;
    overPopup = false;
    popup!.hidden = true;
  }
  function position() {
    if (!active) return;
    const rect = active.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    if (rect.bottom <= 0 || rect.top >= height) { dismiss(); return; }
    const box = popup!.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - box.width / 2, width - box.width - 8));
    const above = rect.top - box.height - 8;
    const top = above >= 8 ? above : rect.bottom + 8;
    popup!.style.left = `${left}px`;
    popup!.style.top = `${Math.max(8, Math.min(top, height - box.height - 8))}px`;
  }
  function show(target: HTMLButtonElement) {
    clearTimeout(closeTimer);
    active?.removeAttribute("aria-describedby");
    active = target;
    date.textContent = target.dataset.label!;
    date.dateTime = target.dataset.date!;
    visitors.textContent = target.dataset.visitors!;
    requests.textContent = target.dataset.requests!;
    popup!.hidden = false;
    target.setAttribute("aria-describedby", popup!.id);
    position();
  }
  function scheduleClose() {
    clearTimeout(closeTimer);
    // A small bridge lets the pointer cross the gap into the popup without flicker.
    closeTimer = setTimeout(() => {
      if (overPopup) return;
      const retained = pinned ?? hovered ?? focused;
      if (retained) show(retained); else dismiss();
    }, 160);
  }
  function tabStop(target: HTMLButtonElement) {
    for (const day of targets) day.tabIndex = day === target ? 0 : -1;
  }
  for (const [index, target] of targets.entries()) {
    target.addEventListener("pointerenter", event => {
      if (event.pointerType === "touch") return;
      hovered = target;
      pinned = null;
      show(target);
    });
    target.addEventListener("pointerleave", event => {
      if (event.pointerType === "touch") return;
      hovered = null;
      scheduleClose();
    });
    target.addEventListener("focus", () => {
      tabStop(target);
      if (touch) return; // Touch is opened/toggled by click, not its preceding focus event.
      focused = target;
      pinned = null;
      show(target);
    });
    target.addEventListener("blur", event => {
      focused = null;
      if (event.relatedTarget instanceof Node && !popup.contains(event.relatedTarget)) pinned = null;
      scheduleClose();
    });
    target.addEventListener("click", event => {
      if (event.pointerType === "touch") {
        if (pinned === target) dismiss();
        else { pinned = target; show(target); }
      } else show(target);
    });
    target.addEventListener("keydown", event => {
      const next = { ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(targets.length - 1, index + 1), Home: 0, End: targets.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      targets[next].focus();
    });
  }
  popup.addEventListener("pointerenter", event => {
    if (event.pointerType === "touch") return;
    overPopup = true;
    clearTimeout(closeTimer);
  });
  popup.addEventListener("pointerleave", event => {
    if (event.pointerType === "touch") return;
    overPopup = false;
    scheduleClose();
  });
  document.addEventListener("pointerdown", event => {
    touch = event.pointerType === "touch";
    const node = event.target as Node;
    if (!chart.contains(node) && !popup.contains(node)) dismiss();
  });
  document.addEventListener("keydown", event => {
    touch = false;
    if (event.key === "Tab") pinned = null;
    if (event.key === "Escape") dismiss();
  }, true);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
  window.addEventListener("blur", dismiss);
}
