"use strict";

// Dependency-free simulated logic checks. These do not replace browser, visual,
// real keyboard/focus, touchscreen, or assistive-technology testing.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 1, "The project should have one inline script");
const source = scripts[0][1];

function createExperience() {
  let now = 0;
  let nextTaskId = 1;
  const tasks = new Map();
  const schedule = (callback, delay, frame = false) => {
    const id = nextTaskId++;
    tasks.set(id, { at: now + Math.max(0, Number(delay) || 0), callback, frame });
    return id;
  };
  const cancel = (id) => tasks.delete(id);

  class EventTarget {
    constructor() {
      this.listeners = new Map();
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(callback);
    }
    removeEventListener(type, callback) {
      this.listeners.get(type)?.delete(callback);
    }
    dispatch(type, properties = {}) {
      const event = {
        type,
        target: this,
        currentTarget: this,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() {},
        ...properties
      };
      for (const callback of this.listeners.get(type) || []) callback(event);
      return event;
    }
  }

  class Element extends EventTarget {
    constructor(id) {
      super();
      this.id = id;
      this.textContent = "";
      this.dataset = {};
      this.attributes = new Map();
      this.captured = new Set();
      this.offsetWidth = 100;
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle(name, force) {
          const present = force === undefined ? !classes.has(name) : Boolean(force);
          if (present) classes.add(name); else classes.delete(name);
          return present;
        }
      };
      const styles = new Map();
      this.style = {
        setProperty: (name, value) => styles.set(name, String(value)),
        getPropertyValue: (name) => styles.get(name) || "",
        removeProperty: (name) => styles.delete(name)
      };
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 600 }; }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) {
      if (!this.captured.delete(id)) return;
      schedule(() => this.dispatch("lostpointercapture", { pointerId: id }), 0);
    }
  }

  const elements = new Map();
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    elements.set(match[1], new Element(match[1]));
  }
  const document = new EventTarget();
  document.hidden = false;
  document.visibilityState = "visible";
  document.getElementById = (id) => {
    assert.ok(elements.has(id), `Unknown element requested: ${id}`);
    return elements.get(id);
  };
  const window = new EventTarget();
  Object.assign(window, {
    setTimeout: (callback, delay, ...args) => schedule(() => callback(...args), delay),
    clearTimeout: cancel,
    requestAnimationFrame: (callback) => schedule(callback, 16, true),
    cancelAnimationFrame: cancel,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  });
  vm.runInNewContext(source, {
    window,
    document,
    performance: { now: () => now },
    console,
    setTimeout: window.setTimeout,
    clearTimeout: cancel,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: cancel
  }, { filename: "find-the-light/inline-script.js" });

  const element = (id) => document.getElementById(id);
  function advance(milliseconds) {
    const end = now + milliseconds;
    let iterations = 0;
    while (true) {
      const pending = [...tasks].filter(([, task]) => task.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!pending) break;
      assert.ok(++iterations < 100000, "Timer loop did not settle");
      const [id, task] = pending;
      tasks.delete(id);
      now = task.at;
      task.callback(task.frame ? now : undefined);
    }
    now = end;
  }
  function pointer(id, type, properties = {}) {
    const target = element(id);
    const event = target.dispatch(type, {
      pointerId: 1, pointerType: "mouse", isPrimary: true,
      button: 0, clientX: 100, clientY: 100, ...properties
    });
    // Real pointerup/cancel implicitly releases capture after dispatch.
    if (type === "pointerup" || type === "pointercancel") {
      target.releasePointerCapture(event.pointerId);
    }
    advance(0);
    return event;
  }
  function key(id, type, value = " ", properties = {}) {
    return element(id).dispatch(type, { key: value, repeat: false, ...properties });
  }
  function click(id) { element(id).dispatch("click"); }
  function hold(duration = 1200) {
    pointer("ceilingLamp", "pointerdown");
    advance(duration);
    pointer("ceilingLamp", "pointerup");
  }
  function pull(distance, ending = "pointerup") {
    pointer("pullCord", "pointerdown");
    pointer("pullCord", "pointermove", { clientY: 100 + distance });
    pointer("pullCord", ending, { clientY: 100 + distance });
  }
  function assertMode(expected) {
    assert.equal(element("room").dataset.mode, expected);
    for (const [index, lamp] of ["desk", "ceiling", "floor"].entries()) {
      const enabled = expected[index] === "1";
      const id = lamp === "floor" ? "pullCord" : `${lamp}Lamp`;
      assert.equal(element("room").classList.contains(`light-${lamp}`), enabled);
      assert.equal(element(id).getAttribute("aria-pressed"), String(enabled));
    }
  }
  function allOn() { hold(); pull(90); click("deskLamp"); }
  return { element, window, document, advance, pointer, key, click, hold, pull, assertMode, allOn };
}

test("initial darkness and desk click keep classes, mode and aria state synchronized", () => {
  const app = createExperience();
  app.assertMode("000");
  app.click("deskLamp");
  app.assertMode("100");
  app.click("deskLamp");
  app.assertMode("000");
});

test("ceiling cancels a short hold and toggles exactly once per completed hold", () => {
  const app = createExperience();
  app.hold(400);
  app.assertMode("000");
  assert.equal(app.element("ceilingLamp").classList.contains("is-charging"), false);
  app.pointer("ceilingLamp", "pointerdown");
  app.advance(1200);
  app.assertMode("010");
  app.advance(2400);
  app.assertMode("010");
  app.pointer("ceilingLamp", "pointerup");
  app.hold();
  app.assertMode("000");
});

for (const interruption of ["element blur", "window blur", "document hidden"]) {
  test(`ceiling keyboard hold cancels on ${interruption} and can be retried`, () => {
    const app = createExperience();
    app.key("ceilingLamp", "keydown");
    app.advance(400);
    if (interruption === "element blur") app.element("ceilingLamp").dispatch("blur");
    if (interruption === "window blur") app.window.dispatch("blur");
    if (interruption === "document hidden") {
      app.document.hidden = true;
      app.document.visibilityState = "hidden";
      app.document.dispatch("visibilitychange");
    }
    app.advance(1500);
    app.assertMode("000");
    assert.equal(app.element("ceilingLamp").classList.contains("is-charging"), false);
    app.document.hidden = false;
    app.document.visibilityState = "visible";
    app.document.dispatch("visibilitychange");
    app.key("ceilingLamp", "keydown");
    app.advance(1200);
    app.key("ceilingLamp", "keyup");
    app.assertMode("010");
  });
}

test("ceiling prevents default scrolling on repeated Space keydown", () => {
  const app = createExperience();
  assert.equal(app.key("ceilingLamp", "keydown").defaultPrevented, true);
  app.advance(200);
  assert.equal(app.key("ceilingLamp", "keydown", " ", { repeat: true }).defaultPrevented, true);
  app.key("ceilingLamp", "keyup");
  app.advance(1400);
  app.assertMode("000");
});

test("floor ignores a short pull, toggles on a full pull, and cancels pointercancel", () => {
  const app = createExperience();
  app.pull(40);
  app.assertMode("000");
  app.pull(90);
  app.assertMode("001");
  app.pull(90, "pointercancel");
  app.assertMode("001");
  assert.equal(app.element("pullCord").style.getPropertyValue("--pull-offset"), "0px");
  assert.equal(app.element("pullCord").classList.contains("is-pulling"), false);
});

test("unexpected pull capture loss cancels instead of toggling", () => {
  const app = createExperience();
  app.pointer("pullCord", "pointerdown");
  app.pointer("pullCord", "pointermove", { clientY: 200 });
  app.element("pullCord").releasePointerCapture(1);
  app.advance(0);
  app.assertMode("000");
  assert.equal(app.element("pullCord").style.getPropertyValue("--pull-offset"), "0px");
});

test("all eight combinations are reachable using the three gestures", () => {
  const app = createExperience();
  const steps = [
    ["000", () => {}],
    ["100", () => app.click("deskLamp")],
    ["110", () => app.hold()],
    ["010", () => app.click("deskLamp")],
    ["011", () => app.pull(90)],
    ["111", () => app.click("deskLamp")],
    ["101", () => app.hold()],
    ["001", () => app.click("deskLamp")],
    ["000", () => app.pull(90)]
  ];
  for (const [mode, interact] of steps) {
    interact();
    app.assertMode(mode);
  }
});

test("reset cancels active ceiling hold, pointer pull and pending keyboard pull", () => {
  for (const start of [
    (app) => { app.pointer("ceilingLamp", "pointerdown"); app.advance(400); },
    (app) => { app.pointer("pullCord", "pointerdown"); app.pointer("pullCord", "pointermove", { clientY: 200 }); },
    (app) => { app.key("pullCord", "keydown", "Enter"); app.advance(100); }
  ]) {
    const app = createExperience();
    start(app);
    app.click("resetRoom");
    app.pointer("ceilingLamp", "pointerup");
    app.pointer("pullCord", "pointerup");
    app.advance(2500);
    app.assertMode("000");
    assert.equal(app.element("ceilingLamp").classList.contains("is-charging"), false);
    assert.equal(app.element("pullCord").classList.contains("is-pulling"), false);
    assert.equal(app.element("modeToast").classList.contains("show"), false);
  }
});

test("reset cancels pending Too bright toast and permits later rediscovery", () => {
  const app = createExperience();
  app.allOn();
  app.advance(500);
  app.click("resetRoom");
  app.advance(2200);
  app.assertMode("000");
  assert.equal(app.element("modeToast").classList.contains("show"), false);
  app.allOn();
  app.advance(1900);
  assert.equal(app.element("modeToast").textContent, "Too bright?");
  assert.equal(app.element("modeToast").classList.contains("show"), true);
});

test("Too bright appears once when all-on persists", () => {
  const app = createExperience();
  app.allOn();
  app.advance(1900);
  app.assertMode("111");
  assert.equal(app.element("modeToast").textContent, "Too bright?");
  assert.equal(app.element("modeToast").classList.contains("show"), true);
  app.advance(2500);
  app.click("deskLamp");
  app.click("deskLamp");
  app.advance(2000);
  assert.equal(app.element("modeToast").classList.contains("show"), false);
});

test("leaving all-on cancels stale Too bright and allows it on a later sustained entry", () => {
  const app = createExperience();
  app.allOn();
  app.advance(500);
  app.click("deskLamp");
  app.advance(1500);
  app.assertMode("011");
  assert.notEqual(app.element("modeToast").textContent, "Too bright?");
  assert.notEqual(app.element("liveRegion").textContent, "All three lights are on. Too bright?");
  app.click("deskLamp");
  app.advance(1900);
  app.assertMode("111");
  assert.equal(app.element("modeToast").textContent, "Too bright?");
  assert.equal(app.element("modeToast").classList.contains("show"), true);
});
