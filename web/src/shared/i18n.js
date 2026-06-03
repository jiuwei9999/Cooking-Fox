import { el } from "./dom.js";
import zh from "./locales/zh.js";
import en from "./locales/en.js";

export const LANG_KEY = "cookingsim.lang";
const DICTS = { zh, en };

export function getLang() {
  const stored = localStorage.getItem(LANG_KEY);
  return stored === "en" ? "en" : "zh";
}

export function setLang(lang) {
  const next = lang === "en" ? "en" : "zh";
  localStorage.setItem(LANG_KEY, next);
  document.documentElement.lang = next === "en" ? "en" : "zh-CN";
  document.documentElement.dataset.lang = next;
  document.title = t("app.title");
  updateLangToggleButtons();
  window.dispatchEvent(new CustomEvent("cookingsim:langchange", { detail: { lang: next } }));
}

export function toggleLang() {
  setLang(getLang() === "zh" ? "en" : "zh");
}

function dict() {
  return DICTS[getLang()] || DICTS.zh;
}

function lookup(key) {
  const parts = key.split(".");
  let v = dict();
  for (const p of parts) {
    v = v?.[p];
    if (v == null) break;
  }
  if (v == null) {
    let fb = DICTS.zh;
    for (const p of parts) fb = fb?.[p];
    v = fb;
  }
  return v;
}

function applyParams(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

/** @returns {unknown} */
export function tr(key) {
  return lookup(key);
}

/** @param {string} key dot path @param {Record<string,string|number>} [params] */
export function t(key, params) {
  const v = lookup(key);
  if (typeof v !== "string") return key;
  return applyParams(v, params);
}

/** Pick random string from a locale string array */
export function tPick(key, params) {
  const v = lookup(key);
  if (Array.isArray(v) && v.length) {
    const item = v[Math.floor(Math.random() * v.length)];
    return typeof item === "string" ? applyParams(item, params) : String(item);
  }
  if (typeof v === "string") return applyParams(v, params);
  return key;
}

export function getLangToggleLabel() {
  return getLang() === "zh" ? "EN" : "中文";
}

export function updateLangToggleButtons() {
  const label = getLangToggleLabel();
  const title = t("lang.toggleTitle");
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.textContent = label;
    btn.title = title;
  });
}

export function createLangToggle(extraAttrs = {}) {
  const baseClass = "btn guideLangBtn";
  const attrs = {
    type: "button",
    "data-lang-btn": "1",
    title: t("lang.toggleTitle"),
    onclick: toggleLang,
    ...extraAttrs,
  };
  attrs.class = extraAttrs.class ? extraAttrs.class + " " + baseClass : baseClass;
  return el("button", attrs, [getLangToggleLabel()]);
}

export function initI18n() {
  const lang = getLang();
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.documentElement.dataset.lang = lang;
  document.title = t("app.title");
}
