(() => {
  "use strict";

  /* ------------------------------------------------------------------ *
   * DOM references
   * ------------------------------------------------------------------ */
  const resultEl = document.getElementById("result");
  const expressionEl = document.getElementById("expression");
  const memIndicatorEl = document.getElementById("memIndicator");
  const keysEl = document.getElementById("keys");
  const sciKeysEl = document.getElementById("sciKeys");

  const themeToggle = document.getElementById("themeToggle");
  const modeToggle = document.getElementById("modeToggle");
  const modeLabel = document.getElementById("modeLabel");
  const angleToggle = document.getElementById("angleToggle");
  const angleLabel = document.getElementById("angleLabel");

  const historyToggle = document.getElementById("historyToggle");
  const historyDrawer = document.getElementById("historyDrawer");
  const historyBackdrop = document.getElementById("historyBackdrop");
  const historyList = document.getElementById("historyList");
  const historyEmpty = document.getElementById("historyEmpty");
  const historyClear = document.getElementById("historyClear");

  const OPERATOR_SYMBOLS = {
    add: "+",
    subtract: "−",
    multiply: "×",
    divide: "÷",
    power: "^",
  };

  const SCI_LABELS = {
    sin: "sin", cos: "cos", tan: "tan", sqrt: "√",
    square: "sqr", ln: "ln", log: "log", inv: "1/x", fact: "!",
  };

  /* ------------------------------------------------------------------ *
   * Persisted state
   * ------------------------------------------------------------------ */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable — fail silently, app still works in-session */
      }
    },
  };

  const state = {
    display: "0",
    prev: null,
    operator: null,
    waitingForOperand: false,
    freshStart: true,
    error: false,
    memory: store.get("calc-memory", 0),
    angle: store.get("calc-angle", "deg"),
    mode: store.get("calc-mode", "basic"),
    history: store.get("calc-history", []),
  };

  /* ------------------------------------------------------------------ *
   * Formatting
   * ------------------------------------------------------------------ */
  function formatNumber(num) {
    if (!isFinite(num)) return "Error";
    let rounded = Math.round((num + Number.EPSILON) * 1e10) / 1e10;
    let str = rounded.toString();
    if (str.replace("-", "").replace(".", "").length > 14) {
      str = rounded.toExponential(6);
    }
    return str;
  }

  function withThousands(str) {
    if (str === "Error") return str;
    let sign = "";
    let s = str;
    if (s.startsWith("-")) { sign = "-"; s = s.slice(1); }
    if (s.includes("e")) return sign + s;
    let [intPart, decPart] = s.split(".");
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + intPart + (decPart !== undefined ? "." + decPart : "");
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  let lastRenderedDisplay = state.display;

  function render() {
    const formatted = withThousands(state.display);
    resultEl.textContent = formatted;
    resultEl.classList.toggle("is-error", state.error);

    if (state.display !== lastRenderedDisplay) {
      resultEl.classList.remove("is-updated");
      void resultEl.offsetWidth; // restart animation
      resultEl.classList.add("is-updated");
      lastRenderedDisplay = state.display;
    }

    if (state.operator && state.prev !== null) {
      expressionEl.textContent = `${withThousands(formatNumber(state.prev))} ${OPERATOR_SYMBOLS[state.operator]}`;
    } else {
      expressionEl.textContent = "";
    }

    memIndicatorEl.classList.toggle("is-active", state.memory !== 0);

    document.querySelectorAll(".key--op").forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        btn.dataset.action === state.operator && state.waitingForOperand
      );
    });

    store.set("calc-memory", state.memory);
  }

  /* ------------------------------------------------------------------ *
   * Core calculator actions
   * ------------------------------------------------------------------ */
  function inputDigit(digit) {
    if (state.error) resetSoft();

    if (state.waitingForOperand) {
      if (state.freshStart) expressionEl.textContent = "";
      state.display = digit === "." ? "0." : digit;
      state.waitingForOperand = false;
      state.freshStart = false;
    } else if (digit === ".") {
      if (!state.display.includes(".")) state.display += ".";
    } else {
      state.display = state.display === "0" ? digit : state.display + digit;
    }
    render();
  }

  function calculate(a, b, operator) {
    switch (operator) {
      case "add": return a + b;
      case "subtract": return a - b;
      case "multiply": return a * b;
      case "divide": return b === 0 ? null : a / b;
      case "power": return Math.pow(a, b);
      default: return b;
    }
  }

  function chooseOperator(nextOperator) {
    if (state.error) return;
    const inputValue = parseFloat(state.display);

    if (state.operator && state.waitingForOperand) {
      state.operator = nextOperator;
      render();
      return;
    }

    if (state.prev === null) {
      state.prev = inputValue;
    } else if (state.operator) {
      const result = calculate(state.prev, inputValue, state.operator);
      if (result === null || !isFinite(result)) { showError(); return; }
      state.prev = result;
      state.display = formatNumber(result);
    }

    state.operator = nextOperator;
    state.waitingForOperand = true;
    state.freshStart = false;
    render();
  }

  function handleEquals() {
    if (state.error || state.operator === null || state.waitingForOperand) return;
    const inputValue = parseFloat(state.display);
    const result = calculate(state.prev, inputValue, state.operator);
    if (result === null || !isFinite(result)) { showError(); return; }

    pushHistory(
      `${withThousands(formatNumber(state.prev))} ${OPERATOR_SYMBOLS[state.operator]} ${withThousands(formatNumber(inputValue))}`,
      formatNumber(result)
    );

    state.display = formatNumber(result);
    state.prev = null;
    state.operator = null;
    state.waitingForOperand = true;
    state.freshStart = true;
    render();
  }

  function clearAll() {
    state.display = "0";
    state.prev = null;
    state.operator = null;
    state.waitingForOperand = false;
    state.freshStart = true;
    state.error = false;
    render();
  }

  function resetSoft() {
    state.display = "0";
    state.prev = null;
    state.operator = null;
    state.waitingForOperand = false;
    state.freshStart = true;
    state.error = false;
  }

  function backspace() {
    if (state.error) { clearAll(); return; }
    if (state.waitingForOperand) return;
    state.display = state.display.length > 1 ? state.display.slice(0, -1) : "0";
    if (state.display === "-") state.display = "0";
    render();
  }

  function toggleSign() {
    if (state.error || state.display === "0") return;
    state.display = state.display.startsWith("-") ? state.display.slice(1) : "-" + state.display;
    render();
  }

  function percent() {
    if (state.error) return;
    state.display = formatNumber(parseFloat(state.display) / 100);
    state.waitingForOperand = false;
    render();
  }

  function showError() {
    state.error = true;
    state.display = "Error";
    state.prev = null;
    state.operator = null;
    state.waitingForOperand = false;
    render();
  }

  function insertConstant(value) {
    if (state.error) resetSoft();
    state.display = formatNumber(value);
    state.waitingForOperand = false;
    state.freshStart = false;
    render();
  }

  /* ------------------------------------------------------------------ *
   * Scientific functions
   * ------------------------------------------------------------------ */
  function toRadians(deg) { return state.angle === "deg" ? (deg * Math.PI) / 180 : deg; }

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n) || n > 170) return null;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  const SCI_FN = {
    sin: (v) => Math.sin(toRadians(v)),
    cos: (v) => Math.cos(toRadians(v)),
    tan: (v) => Math.tan(toRadians(v)),
    sqrt: (v) => (v < 0 ? null : Math.sqrt(v)),
    square: (v) => v * v,
    ln: (v) => (v <= 0 ? null : Math.log(v)),
    log: (v) => (v <= 0 ? null : Math.log10(v)),
    inv: (v) => (v === 0 ? null : 1 / v),
    fact: (v) => factorial(v),
  };

  function handleSci(key) {
    if (key === "pi") { insertConstant(Math.PI); return; }
    if (key === "e") { insertConstant(Math.E); return; }

    if (state.error) return;
    const fn = SCI_FN[key];
    if (!fn) return;

    const value = parseFloat(state.display);
    const result = fn(value);
    if (result === null || !isFinite(result)) { showError(); return; }

    pushHistory(`${SCI_LABELS[key]}(${withThousands(formatNumber(value))})`, formatNumber(result));

    state.display = formatNumber(result);
    state.prev = null;
    state.operator = null;
    state.waitingForOperand = true;
    state.freshStart = true;
    render();
  }

  /* ------------------------------------------------------------------ *
   * Memory
   * ------------------------------------------------------------------ */
  function memoryClear() { state.memory = 0; render(); }
  function memoryRecall() {
    if (state.error) resetSoft();
    state.display = formatNumber(state.memory);
    state.waitingForOperand = false;
    state.freshStart = false;
    render();
  }
  function memoryAdd() { if (!state.error) { state.memory += parseFloat(state.display); render(); } }
  function memorySubtract() { if (!state.error) { state.memory -= parseFloat(state.display); render(); } }

  /* ------------------------------------------------------------------ *
   * History
   * ------------------------------------------------------------------ */
  function pushHistory(expr, resultStr) {
    state.history.unshift({ expr, result: resultStr });
    if (state.history.length > 20) state.history.length = 20;
    store.set("calc-history", state.history);
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = "";
    historyEmpty.hidden = state.history.length > 0;

    state.history.forEach((item) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.innerHTML = `<span class="hist-expr">${item.expr} =</span>${withThousands(item.result)}`;
      btn.addEventListener("click", () => {
        if (state.error) resetSoft();
        state.display = item.result;
        state.prev = null;
        state.operator = null;
        state.waitingForOperand = false;
        state.freshStart = false;
        render();
        closeHistory();
      });
      li.appendChild(btn);
      historyList.appendChild(li);
    });
  }

  function openHistory() {
    historyDrawer.classList.add("is-open");
    historyBackdrop.classList.add("is-open");
    historyDrawer.setAttribute("aria-hidden", "false");
    historyToggle.setAttribute("aria-expanded", "true");
    historyToggle.classList.add("is-active");
  }
  function closeHistory() {
    historyDrawer.classList.remove("is-open");
    historyBackdrop.classList.remove("is-open");
    historyDrawer.setAttribute("aria-hidden", "true");
    historyToggle.setAttribute("aria-expanded", "false");
    historyToggle.classList.remove("is-active");
  }

  historyToggle.addEventListener("click", () => {
    historyDrawer.classList.contains("is-open") ? closeHistory() : openHistory();
  });
  historyBackdrop.addEventListener("click", closeHistory);
  historyClear.addEventListener("click", () => {
    state.history = [];
    store.set("calc-history", state.history);
    renderHistory();
  });

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').setAttribute(
      "content",
      theme === "light" ? "#e9e5da" : "#1a1c20"
    );
    store.set("calc-theme", theme);
  }
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next);
  });

  /* ------------------------------------------------------------------ *
   * Mode (basic / scientific) + angle unit
   * ------------------------------------------------------------------ */
  function applyMode(mode) {
    state.mode = mode;
    sciKeysEl.hidden = mode !== "scientific";
    angleToggle.hidden = mode !== "scientific";
    modeToggle.classList.toggle("is-active", mode === "scientific");
    modeLabel.textContent = mode === "scientific" ? "BASIC" : "SCI";
    store.set("calc-mode", mode);
  }
  modeToggle.addEventListener("click", () => {
    applyMode(state.mode === "scientific" ? "basic" : "scientific");
  });

  function applyAngle(angle) {
    state.angle = angle;
    angleLabel.textContent = angle.toUpperCase();
    angleToggle.classList.toggle("is-active", angle === "rad");
    store.set("calc-angle", angle);
  }
  angleToggle.addEventListener("click", () => {
    applyAngle(state.angle === "deg" ? "rad" : "deg");
  });

  /* ------------------------------------------------------------------ *
   * Action dispatch
   * ------------------------------------------------------------------ */
  const ACTIONS = {
    clear: clearAll,
    backspace: backspace,
    sign: toggleSign,
    percent: percent,
    decimal: () => inputDigit("."),
    add: () => chooseOperator("add"),
    subtract: () => chooseOperator("subtract"),
    multiply: () => chooseOperator("multiply"),
    divide: () => chooseOperator("divide"),
    power: () => chooseOperator("power"),
    equals: handleEquals,
    mc: memoryClear,
    mr: memoryRecall,
    "m-plus": memoryAdd,
    "m-minus": memorySubtract,
  };

  function flashKey(button) {
    if (!button) return;
    button.classList.add("is-pressed");
    window.setTimeout(() => button.classList.remove("is-pressed"), 160);
  }

  function handleKeypadClick(event) {
    const button = event.target.closest(".key");
    if (!button) return;

    if (button.dataset.num !== undefined) {
      inputDigit(button.dataset.num);
    } else if (button.dataset.sci) {
      handleSci(button.dataset.sci);
    } else if (button.dataset.action) {
      const fn = ACTIONS[button.dataset.action];
      if (fn) fn();
    }
    flashKey(button);
  }

  keysEl.addEventListener("click", handleKeypadClick);
  sciKeysEl.addEventListener("click", handleKeypadClick);

  /* ------------------------------------------------------------------ *
   * Keyboard support
   * ------------------------------------------------------------------ */
  const KEY_TO_ACTION = {
    "+": "add", "-": "subtract", "*": "multiply", "/": "divide", "%": "percent",
    "Enter": "equals", "=": "equals", "Escape": "clear",
  };

  function findButtonForKey(e) {
    if (/^[0-9]$/.test(e.key)) return keysEl.querySelector(`[data-num="${e.key}"]`);
    if (e.key === ".") return keysEl.querySelector('[data-action="decimal"]');
    const action = KEY_TO_ACTION[e.key];
    if (action) return keysEl.querySelector(`[data-action="${action}"]`);
    return null;
  }

  window.addEventListener("keydown", (e) => {
    if (/^[0-9]$/.test(e.key)) {
      inputDigit(e.key);
    } else if (e.key === ".") {
      inputDigit(".");
    } else if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
    } else if (KEY_TO_ACTION[e.key]) {
      e.preventDefault();
      ACTIONS[KEY_TO_ACTION[e.key]]();
    } else {
      return;
    }
    flashKey(findButtonForKey(e));
  });

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  applyTheme(store.get("calc-theme", "dark"));
  applyMode(state.mode);
  applyAngle(state.angle);
  renderHistory();
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline support is a bonus — ignore registration failures */
      });
    });
  }
})();