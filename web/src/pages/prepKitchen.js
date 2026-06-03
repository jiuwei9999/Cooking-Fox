import { el } from "../shared/dom.js";
import { t, createLangToggle } from "../shared/i18n.js";
import { displayIngredientName, prepOpLabel } from "../shared/ingredientMeta.js";
import {
  initPrep3D,
  showIngredientOnBoard,
  showMarinateBowl,
  lockMarinateBowlBodies,
  showSeasoningBowl,
  animateSliceMotion,
  animateCrack,
  animatePeel,
  disposePrep3D,
  updatePrepTheme,
} from "../3d/prepScene.js";
import {
  EMOJI,
  getDefaultAmountG,
  canPrepOnBoard,
  canMarinateIngredient,
  canMarinateSeasoning,
  canSeasoningPrep,
  getInitialPrepFlags,
  getBoardPrepOps,
  formatPrepStateLabel,
  getMarinateItemProgress,
  marinateStrengthFromMinutes,
  MARINATE_DURATIONS,
  LIQUID_IDS,
  LIQUID_SEASONING_IDS,
} from "../shared/ingredientMeta.js";
import { liquidColorCss, LIQUID_LABELS } from "../3d/prepBowlModels.js";
import { mountIngredientPicker } from "../shared/ingredientPicker.js";
import { mountTargetRecipeGuide } from "../shared/targetRecipeGuide.js";

const LIQUID_ID_SET = new Set([...LIQUID_IDS, ...LIQUID_SEASONING_IDS, "bean_paste"]);

export function showPrepKitchen(ingredients, preSelectedId, onCommitStaged) {
  const existing = document.querySelector(".prepOverlay");
  if (existing) existing.remove();

  const staged = [];
  /** 捞出备用：从腌制碗/调料碗取出，待送入暂存或入锅 */
  const reserveTray = [];
  let station = "board";
  let selectedId = preSelectedId || null;
  let selectedPrepState = "whole";
  let selectedCut = "chop";
  let prepFlags = selectedId ? getInitialPrepFlags(selectedId) : getInitialPrepFlags("");
  const seasoningBowl = [];
  /** 腌制碗：多种主料 + 自选腌料 + 计时 */
  const marinateBowl = [];
  const marinateBrine = [];
  let marinateUid = 0;
  let defaultMarinateMin = 15;
  let marinateTick = null;
  /** 砧板上处理进度，可送入腌制碗 */
  let boardWork = null;

  const getMarinateAvgProgress = () => {
    if (marinateBowl.length === 0) return 0;
    return marinateBowl.reduce((a, it) => a + getMarinateItemProgress(it), 0) / marinateBowl.length;
  };

  const refreshMarinateView = (opts = {}) => {
    const anyRunning = marinateBowl.some((it) => it.startedAt && !it.done);
    showMarinateBowl({
      items: marinateBowl,
      brine: marinateBrine,
      avgSoakProgress: getMarinateAvgProgress(),
      lockBodies: opts.lockBodies ?? anyRunning,
    });
  };

  const stopMarinateTick = () => {
    if (marinateTick) {
      clearInterval(marinateTick);
      marinateTick = null;
    }
  };

  const startMarinateTick = () => {
    if (marinateTick) return;
    marinateTick = setInterval(() => {
      let anyRunning = false;
      marinateBowl.forEach((item) => {
        if (item.startedAt && !item.done) {
          const p = getMarinateItemProgress(item);
          if (p >= 1) {
            item.done = true;
            item.prepFlags = { ...item.prepFlags, marinated: true, marinateMinutes: item.durationMin };
            item.prepState = "marinated";
          } else {
            anyRunning = true;
          }
        }
      });
      if (station === "marinate") {
        const opsHost = document.getElementById("prepOpsHost");
        const stagedHost = document.getElementById("prepStagedHost");
        if (opsHost) renderOps(opsHost, stagedHost);
      }
      if (!anyRunning) stopMarinateTick();
    }, 400);
  };

  const addMarinateItem = (payload) => {
    const id = payload.id;
    if (!canMarinateIngredient(id)) return;
    marinateBowl.push({
      uid: ++marinateUid,
      id,
      prepState: payload.prepState || "whole",
      cut: payload.cut || "chop",
      prepFlags: { ...(payload.prepFlags || getInitialPrepFlags(id)), marinated: false },
      durationMin: payload.durationMin ?? defaultMarinateMin,
      startedAt: null,
      done: false,
    });
    if (station === "marinate") refreshMarinateView();
  };

  const syncBoardWork = () => {
    if (!selectedId || station !== "board") return;
    boardWork = {
      id: selectedId,
      prepState: selectedPrepState,
      cut: selectedCut,
      prepFlags: { ...prepFlags },
    };
  };

  const applyBoardWorkToMarinate = (opsHost, stagedHost) => {
    if (station === "board") syncBoardWork();
    if (!boardWork || !canMarinateIngredient(boardWork.id)) {
      alert(t("prep.alertNeedBoard"));
      return;
    }
    addMarinateItem({
      id: boardWork.id,
      prepState: boardWork.prepState,
      cut: boardWork.cut,
      prepFlags: boardWork.prepFlags,
    });
    station = "marinate";
    refreshMarinateView();
    renderOps(opsHost, stagedHost);
    updateHint();
  };

  const updateHint = () => {
    const hint = document.getElementById("prep3dHint");
    if (!hint) return;
    if (station === "board") {
      hint.textContent = boardWork && canMarinateIngredient(boardWork.id)
        ? t("prep.hintBoardReady")
        : t("prep.hintBoard");
    }
    else if (station === "marinate") {
      const n = marinateBowl.length;
      const br = marinateBrine.length;
      hint.textContent = n
        ? t("prep.hintMarinate", { n, br: br ? t("prep.brineKinds", { n: br }) : "" })
        : t("prep.hintMarinateEmpty");
    }
    else hint.textContent = t("prep.hintSeasoning");
  };

  const updateView = () => {
    if (station === "board") {
      showIngredientOnBoard(selectedId, selectedPrepState, selectedCut, 8, prepFlags);
    } else if (station === "marinate") {
      refreshMarinateView();
    } else {
      showSeasoningBowl(seasoningBowl);
    }
    updateHint();
  };

  const selectIngredient = (id, opts = {}) => {
    const isNew = id !== selectedId;
    selectedId = id;
    if (station === "board" || isNew) {
      selectedPrepState = "whole";
      selectedCut = "chop";
      prepFlags = getInitialPrepFlags(id);
      boardWork = null;
    }
    updateView();
    if (station === "board") syncBoardWork();
  };

  const buildReserveFromMarinateItem = (item) => {
    const brineIds = marinateBrine.map((s) => s.id);
    const done = item.done || getMarinateItemProgress(item) >= 1;
    const prepFlags = done
      ? {
        ...item.prepFlags,
        marinated: true,
        marinateMinutes: item.durationMin,
        marinadeIds: brineIds,
        marinateStrength: marinateStrengthFromMinutes(item.durationMin),
        setAside: true,
      }
      : { ...item.prepFlags, setAside: true };
    return {
      id: item.id,
      prepState: done ? "marinated" : item.prepState,
      cut: item.cut || "none",
      amountG: getDefaultAmountG(item.id),
      prepFlags,
      source: "marinate",
    };
  };

  const scoopMarinateItemToReserve = (idx, opsHost, stagedHost, reserveHost) => {
    const item = marinateBowl[idx];
    if (!item) return;
    if (item.startedAt && !item.done) {
      const ok = confirm(t("prep.confirmEarlyScoop"));
      if (!ok) return;
    }
    reserveTray.push(buildReserveFromMarinateItem(item));
    marinateBowl.splice(idx, 1);
    if (!marinateBowl.some((it) => it.startedAt && !it.done)) stopMarinateTick();
    refreshMarinateView();
    renderReserve(reserveHost);
    notifyReserveAdded();
    if (opsHost) renderOps(opsHost, stagedHost);
  };

  const scoopAllDoneToReserve = (opsHost, stagedHost, reserveHost) => {
    const doneIdx = marinateBowl.map((it, i) => (it.done ? i : -1)).filter((i) => i >= 0);
    if (doneIdx.length === 0) {
      alert(t("prep.alertNoMarinated"));
      return;
    }
    for (let i = doneIdx.length - 1; i >= 0; i--) {
      reserveTray.push(buildReserveFromMarinateItem(marinateBowl[doneIdx[i]]));
      marinateBowl.splice(doneIdx[i], 1);
    }
    if (!marinateBowl.some((it) => it.startedAt && !it.done)) stopMarinateTick();
    refreshMarinateView();
    renderReserve(reserveHost);
    notifyReserveAdded();
    if (opsHost) renderOps(opsHost, stagedHost);
  };

  const moveReserveToStaged = (idx, stagedHost, reserveHost) => {
    const item = reserveTray[idx];
    if (!item) return;
    staged.push({
      id: item.id,
      prepState: item.prepState,
      cut: item.cut,
      amountG: item.amountG || getDefaultAmountG(item.id),
      prepFlags: { ...item.prepFlags, setAside: false },
    });
    reserveTray.splice(idx, 1);
    renderStaged(stagedHost);
    renderReserve(reserveHost);
  };

  const moveAllReserveToStaged = (stagedHost, reserveHost) => {
    if (reserveTray.length === 0) return;
    reserveTray.forEach((item) => {
      staged.push({
        id: item.id,
        prepState: item.prepState,
        cut: item.cut,
        amountG: item.amountG || getDefaultAmountG(item.id),
        prepFlags: { ...item.prepFlags, setAside: false },
      });
    });
    reserveTray.length = 0;
    renderStaged(stagedHost);
    renderReserve(reserveHost);
  };

  const updateReserveChrome = () => {
    const badge = document.getElementById("prepReserveBadge");
    const panel = document.querySelector(".prepReservePanel");
    const moveAll = document.getElementById("prepReserveMoveAll");
    const n = reserveTray.length;
    if (badge) {
      badge.textContent = String(n);
      badge.classList.toggle("prepReserveBadgeEmpty", n === 0);
    }
    if (panel) panel.classList.toggle("prepReservePanelActive", n > 0);
    if (moveAll) moveAll.disabled = n === 0;
  };

  const notifyReserveAdded = () => {
    updateReserveChrome();
    const panel = document.querySelector(".prepReservePanel");
    if (panel) {
      panel.classList.add("prepReservePanelPulse");
      setTimeout(() => panel.classList.remove("prepReservePanelPulse"), 700);
    }
  };

  const btnScoopReserve = (label, onclick, opts = {}) =>
    el("button", {
      type: "button",
      class: "btn btnScoopReserve" + (opts.subtle ? " btnScoopReserveSubtle" : ""),
      style: opts.fullWidth !== false ? "width:100%" : "",
      disabled: !!opts.disabled,
      onclick,
    }, [label]);

  const renderReserve = (host) => {
    if (!host) return;
    host.innerHTML = "";
    updateReserveChrome();
    if (reserveTray.length === 0) {
      host.appendChild(
        el("div", { class: "prepReserveEmpty" }, [
          el("div", { class: "prepReserveEmptyIcon" }, ["🥢"]),
          el("div", { class: "prepReserveEmptyTitle" }, [t("prep.reserveEmptyTitle")]),
          el("div", { class: "prepReserveEmptyDesc" }, [t("prep.reserveEmptyHint")]),
        ])
      );
      return;
    }
    reserveTray.forEach((item, idx) => {
      const emoji = EMOJI[item.id] || "🍽️";
      const name = displayIngredientName(ingredients[item.id] || { id: item.id, name: item.id });
      const stateLabel = formatPrepStateLabel(item.prepState, item.cut, item.prepFlags);
      const sourceLabel = item.source === "marinate" ? t("prep.fromMarinate")
        : item.source === "seasoning" ? t("prep.fromSeasoning") : t("prep.fromBoard");
      host.appendChild(
        el("div", { class: "prepReserveCard" }, [
          el("div", { class: "prepReserveCardMain" }, [
            el("span", { class: "prepReserveCardEmoji" }, [emoji]),
            el("div", { class: "prepReserveCardText" }, [
              el("div", { class: "prepReserveCardName" }, [name]),
              el("div", { class: "prepReserveCardState" }, [stateLabel]),
              el("div", { class: "prepReserveCardSource" }, [sourceLabel]),
            ]),
          ]),
          el("div", { class: "prepReserveCardActions" }, [
            el("div", { class: "prepReserveAmount" }, [
              el("input", {
                class: "input prepReserveAmountInput",
                type: "number",
                min: "1",
                value: String(item.amountG || 50),
                oninput: (e) => { reserveTray[idx].amountG = Number(e.target.value || 10); },
              }),
              el("span", { class: "prepReserveAmountUnit" }, ["g"]),
            ]),
            el("button", {
              type: "button",
              class: "btn btnPrimary prepReserveToStagedBtn",
              onclick: () => {
                const stagedHost = document.getElementById("prepStagedHost");
                moveReserveToStaged(idx, stagedHost, host);
                updateReserveChrome();
              },
            }, [t("prep.addToStaged")]),
            el("button", {
              type: "button",
              class: "btn prepReserveRemoveBtn",
              title: t("prep.removeReserve"),
              onclick: () => { reserveTray.splice(idx, 1); renderReserve(host); },
            }, ["✕"]),
          ]),
        ])
      );
    });
  };

  const renderStaged = (host) => {
    host.innerHTML = "";
    if (staged.length === 0) {
      host.appendChild(el("div", { class: "muted", style: "padding:6px" }, [t("prep.stagedEmpty")]));
      return;
    }
    staged.forEach((item, idx) => {
      const emoji = EMOJI[item.id] || "🍽️";
      const name = displayIngredientName(ingredients[item.id] || { id: item.id, name: item.id });
      const stateLabel = formatPrepStateLabel(item.prepState, item.cut, item.prepFlags);
      host.appendChild(
        el("div", { class: "prepStagedItem" }, [
          el("span", {}, [`${emoji} ${name} — ${stateLabel}`]),
          el("span", { style: "display:flex;gap:6px;align-items:center" }, [
            el("input", {
              class: "input",
              type: "number",
              min: "1",
              value: String(item.amountG || 50),
              style: "width:70px;padding:6px",
              oninput: (e) => { staged[idx].amountG = Number(e.target.value || 10); },
            }),
            el("span", { style: "font-size:11px;color:var(--text-dim)" }, ["g"]),
            el("button", {
              class: "btn",
              style: "padding:4px 8px;font-size:11px",
              onclick: () => { staged.splice(idx, 1); renderStaged(host); },
            }, ["✕"]),
          ]),
        ])
      );
    });
  };

  const stageItem = (stagedHost) => {
    if (!selectedId) return;
    staged.push({
      id: selectedId,
      prepState: selectedPrepState,
      cut: selectedCut || "none",
      amountG: getDefaultAmountG(selectedId),
      prepFlags: { ...prepFlags },
    });
    selectedPrepState = "whole";
    selectedCut = "chop";
    if (selectedId) prepFlags = getInitialPrepFlags(selectedId);
    updateView();
    renderStaged(stagedHost);
    const opsHost = document.getElementById("prepOpsHost");
    if (opsHost) renderOps(opsHost, stagedHost);
  };

  const renderStationTabs = (opsHost, stagedHost) => {
    const tabs = el("div", { class: "prepStationTabs" }, []);
    const mk = (id, label) => el("button", {
      class: "btn prepStationTab" + (station === id ? " prepStationTabActive" : ""),
      onclick: () => {
        station = id;
        if (station === "seasoning") {
          selectedId = null;
          showSeasoningBowl(seasoningBowl);
        } else if (station === "marinate") {
          refreshMarinateView();
        } else if (!selectedId && preSelectedId) {
          selectIngredient(preSelectedId);
        } else {
          updateView();
        }
        renderOps(opsHost, stagedHost);
        updateHint();
      },
    }, [label]);
    tabs.appendChild(mk("board", "🔪 " + t("prep.tabBoard")));
    tabs.appendChild(mk("marinate", "🥣 " + t("prep.tabMarinate")));
    tabs.appendChild(mk("seasoning", "🧂 " + t("prep.tabSeasoning")));
    return tabs;
  };

  const renderBoardOps = (opsHost, stagedHost) => {
    if (!selectedId) {
      opsHost.appendChild(el("div", { class: "muted" }, [t("prep.pickIngHint")]));
      return;
    }
    const ing = ingredients[selectedId];
    const name = ing?.name || selectedId;
    const emoji = EMOJI[selectedId] || "🍽️";
    const stateText = formatPrepStateLabel(selectedPrepState, selectedCut, prepFlags);

    opsHost.appendChild(el("div", { class: "selectedName" }, [`${emoji} ${name}`]));
    const statusParts = [];
    if (prepFlags.withSkin) statusParts.push(t("prep.withSkin"));
    if (prepFlags.withBone) statusParts.push(t("prep.withBone"));
    if (statusParts.length) {
      opsHost.appendChild(el("div", { class: "selectedState", style: "color:var(--gold)" }, [statusParts.join(" · ")]));
    }
    opsHost.appendChild(el("div", { class: "selectedState" }, [t("prep.currentState", { state: stateText })]));

    const ops = getBoardPrepOps(selectedId, prepFlags);
    opsHost.appendChild(el("hr", { class: "hr" }));
    opsHost.appendChild(el("div", { class: "muted", style: "margin-bottom:6px" }, [t("prep.processLabel")]));

    ops.forEach((op) => {
      opsHost.appendChild(
        el("button", {
          class: "btn btnPrimary",
          style: "width:100%;margin-bottom:6px",
          onclick: () => {
            if (op.action === "peel") {
              prepFlags = { ...prepFlags, withSkin: false };
              animatePeel(selectedId);
            } else if (op.action === "debone") {
              prepFlags = { ...prepFlags, withBone: false };
              animateSliceMotion();
            } else {
              selectedPrepState = op.state;
              selectedCut = op.cut || selectedCut;
              if (op.id === "crack") animateCrack();
              else if (op.id === "shuck" || (op.cut && op.cut !== "none")) animateSliceMotion();
            }
            syncBoardWork();
            updateView();
            renderOps(opsHost, stagedHost);
          },
        }, [prepOpLabel(op.id) || op.label])
      );
    });

    if (canMarinateIngredient(selectedId)) {
      opsHost.appendChild(el("hr", { class: "hr" }));
      const workLabel = formatPrepStateLabel(
        boardWork?.prepState || selectedPrepState,
        boardWork?.cut || selectedCut,
        boardWork?.prepFlags || prepFlags
      );
      opsHost.appendChild(
        el("button", {
          class: "btn btnWarn",
          style: "width:100%;margin-bottom:8px",
          onclick: () => applyBoardWorkToMarinate(opsHost, stagedHost),
        }, [t("prep.intoMarinateBowl")])
      );
      if (boardWork && boardWork.id === selectedId) {
        opsHost.appendChild(
          el("div", { class: "muted", style: "font-size:11px;margin-bottom:8px" }, [
            t("prep.bringLabel", { label: workLabel }),
          ])
        );
      }
    }

    opsHost.appendChild(
      el("div", { class: "prepScoopActionBox" }, [
        el("div", { class: "prepScoopActionTitle" }, [t("prep.toReserve")]),
        el("div", { class: "prepScoopActionDesc" }, [t("prep.boardScoopHint")]),
        btnScoopReserve(t("prep.scoopCurrent"), () => {
          syncBoardWork();
          reserveTray.push({
            id: selectedId,
            prepState: selectedPrepState,
            cut: selectedCut || "none",
            amountG: getDefaultAmountG(selectedId),
            prepFlags: { ...prepFlags, setAside: true },
            source: "board",
          });
          const reserveHost = document.getElementById("prepReserveHost");
          renderReserve(reserveHost);
          notifyReserveAdded();
        }),
      ])
    );
    opsHost.appendChild(el("hr", { class: "hr" }));
    opsHost.appendChild(
      el("button", {
        class: "btn btnSuccess",
        style: "width:100%",
        onclick: () => {
          syncBoardWork();
          stageItem(stagedHost);
        },
      }, [t("prep.stagePot", { name })])
    );
  };

  const renderMarinateOps = (opsHost, stagedHost) => {
    opsHost.appendChild(el("div", { class: "selectedName" }, [t("prep.marinateBowlTitle")]));
    opsHost.appendChild(el("div", { class: "muted", style: "font-size:12px;margin:6px 0;line-height:1.5" }, [t("prep.marinateHint")]));

    opsHost.appendChild(el("div", { class: "muted", style: "margin:8px 0 4px;font-size:11px" }, [t("prep.brineLabel")]));
    const brineList = el("div", { class: "prepSeasoningList" }, []);
    if (marinateBrine.length === 0) {
      brineList.appendChild(el("div", { class: "muted", style: "padding:4px;font-size:11px" }, [t("prep.brineEmpty")]));
    } else {
      marinateBrine.forEach((s, i) => {
        const isLiq = LIQUID_ID_SET.has(s.id);
        brineList.appendChild(el("div", { class: "prepStagedItem", style: "margin-bottom:3px" }, [
          el("span", {}, [
            isLiq ? el("span", { style: `display:inline-block;width:8px;height:8px;border-radius:2px;background:${liquidColorCss(s.id)};margin-right:4px` }, []) : null,
            `${EMOJI[s.id] || "🧂"} ${ingredients[s.id]?.name || s.id}`,
          ].filter(Boolean)),
          el("button", {
            class: "btn",
            style: "padding:2px 6px;font-size:10px",
            onclick: () => {
              marinateBrine.splice(i, 1);
              refreshMarinateView();
              renderOps(opsHost, stagedHost);
            },
          }, [t("prep.remove")]),
        ]));
      });
    }
    opsHost.appendChild(brineList);

    opsHost.appendChild(el("hr", { class: "hr" }));
    opsHost.appendChild(el("div", { class: "muted", style: "margin:4px 0;font-size:11px" }, [t("prep.defaultDuration")]));
    const durRow = el("div", { class: "prepMarinateDurRow", style: "display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px" }, []);
    MARINATE_DURATIONS.forEach((d) => {
      durRow.appendChild(
        el("button", {
          class: "btn" + (defaultMarinateMin === d.min ? " btnPrimary" : ""),
          style: "padding:4px 8px;font-size:11px;flex:1;min-width:70px",
          onclick: () => {
            defaultMarinateMin = d.min;
            renderOps(opsHost, stagedHost);
          },
        }, [d.label])
      );
    });
    opsHost.appendChild(durRow);

    opsHost.appendChild(el("div", { class: "muted", style: "margin:4px 0;font-size:11px" }, [t("prep.bowlMain")]));
    const itemList = el("div", { class: "prepMarinateItemList" }, []);
    if (marinateBowl.length === 0) {
      itemList.appendChild(el("div", { class: "muted", style: "padding:6px;font-size:11px" }, [
        t("prep.bowlMainEmpty"),
      ]));
    } else {
      marinateBowl.forEach((item, idx) => {
        const prog = getMarinateItemProgress(item);
        const pct = Math.round(prog * 100);
        const stateLabel = formatPrepStateLabel(item.prepState, item.cut, item.prepFlags);
        const durSel = el("select", {
          class: "input",
          style: "font-size:10px;padding:2px 4px;max-width:88px",
          disabled: !!item.startedAt,
          onchange: (e) => { item.durationMin = Number(e.target.value); },
        }, MARINATE_DURATIONS.map((d) =>
          el("option", {
            value: String(d.min),
            ...(item.durationMin === d.min ? { selected: "selected" } : {}),
          }, [d.label])
        ));
        const bar = el("div", {
          class: "prepMarinateBar",
          style: "height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:4px;overflow:hidden",
        }, [
          el("div", {
            style: `height:100%;width:${pct}%;background:${item.done ? "var(--mint)" : "var(--gold)"};transition:width 0.3s`,
          }, []),
        ]);
        itemList.appendChild(
          el("div", {
            class: "prepStagedItem prepMarinateItem",
            style: "flex-direction:column;align-items:stretch;margin-bottom:8px;padding:8px",
          }, [
            el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap" }, [
              el("span", { style: "font-size:12px" }, [
                `${EMOJI[item.id] || "🍽️"} ${ingredients[item.id]?.name || item.id}`,
              ]),
              el("span", { class: "prepMarinateItemActions" }, [
                el("button", {
                  type: "button",
                  class: "btn btnScoopReserve",
                  style: "flex:1;min-width:120px",
                  onclick: () => {
                    const reserveHost = document.getElementById("prepReserveHost");
                    scoopMarinateItemToReserve(idx, opsHost, stagedHost, reserveHost);
                  },
                }, [item.done ? t("prep.scoopToReserveDone") : item.startedAt ? t("prep.scoopToReserveEarly") : t("prep.scoopToReserve")]),
                el("button", {
                  type: "button",
                  class: "btn prepMarinateDiscardBtn",
                  onclick: () => {
                    marinateBowl.splice(idx, 1);
                    if (!marinateBowl.some((it) => it.startedAt && !it.done)) stopMarinateTick();
                    refreshMarinateView();
                    renderOps(opsHost, stagedHost);
                  },
                }, [t("prep.discard")]),
              ]),
            ]),
            el("div", { class: "muted", style: "font-size:10px;margin:2px 0" }, [stateLabel]),
            el("div", { style: "display:flex;align-items:center;gap:6px;margin-top:4px" }, [
              el("span", { style: "font-size:10px;color:var(--text-dim)" }, [t("prep.duration")]),
              durSel,
              el("span", { style: "font-size:10px;margin-left:auto" }, [
                item.done ? t("prep.done") : item.startedAt ? t("prep.pctDone", { pct }) : t("prep.pending"),
              ]),
            ]),
            item.startedAt || item.done ? bar : null,
          ].filter(Boolean))
        );
      });
    }
    opsHost.appendChild(itemList);

    const canStart = marinateBowl.some((it) => !it.done && !it.startedAt);
    const running = marinateBowl.some((it) => it.startedAt && !it.done);
    opsHost.appendChild(
      el("button", {
        class: "btn btnPrimary",
        style: "width:100%;margin:8px 0",
        disabled: !canStart && !running,
        onclick: () => {
          if (marinateBowl.length === 0) {
            alert(t("prep.needMain"));
            return;
          }
          const now = Date.now();
          marinateBowl.forEach((it) => {
            if (!it.done && !it.startedAt) it.startedAt = now;
          });
          lockMarinateBowlBodies();
          startMarinateTick();
          renderOps(opsHost, stagedHost);
        },
      }, [running ? t("prep.marinateRunning") : t("prep.startMarinate")])
    );

    const doneItems = marinateBowl.filter((it) => it.done);
    opsHost.appendChild(
      btnScoopReserve(
        t("prep.scoopAllMarinated", { n: doneItems.length }),
        () => {
          const reserveHost = document.getElementById("prepReserveHost");
          scoopAllDoneToReserve(opsHost, stagedHost, reserveHost);
        },
        { disabled: doneItems.length === 0, subtle: false }
      )
    );

    if (boardWork && canMarinateIngredient(boardWork.id)) {
      opsHost.appendChild(el("hr", { class: "hr" }));
      opsHost.appendChild(
        el("button", {
          class: "btn btnWarn",
          style: "width:100%",
          onclick: () => {
            if (station !== "board") {
              addMarinateItem({
                id: boardWork.id,
                prepState: boardWork.prepState,
                cut: boardWork.cut,
                prepFlags: boardWork.prepFlags,
              });
              refreshMarinateView();
              renderOps(opsHost, stagedHost);
            } else {
              applyBoardWorkToMarinate(opsHost, stagedHost);
            }
          },
        }, [t("prep.fromBoardAdd", { name: displayIngredientName(ingredients[boardWork.id] || { id: boardWork.id }) })])
      );
    }
  };

  const renderSeasoningOps = (opsHost, stagedHost) => {
    opsHost.appendChild(el("div", { class: "selectedName" }, [t("prep.seasoningTitle")]));
    opsHost.appendChild(el("div", { class: "muted", style: "font-size:12px;margin:6px 0" }, [t("prep.seasoningHint")]));
    const liquidInBowl = [...new Set(seasoningBowl.map((s) => s.id).filter((id) => LIQUID_ID_SET.has(id)))];
    if (liquidInBowl.length > 0) {
      const legend = el("div", { class: "prepLiquidLegend", style: "display:flex;flex-wrap:wrap;gap:6px;margin:8px 0" }, []);
      liquidInBowl.forEach((id) => {
        legend.appendChild(
          el("span", {
            style: "font-size:10px;display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.2)",
          }, [
            el("span", {
              style: `width:12px;height:12px;border-radius:2px;background:${liquidColorCss(id)};border:1px solid rgba(255,255,255,0.15)`,
            }, []),
            LIQUID_LABELS[id] || ingredients[id]?.name || id,
          ])
        );
      });
      opsHost.appendChild(legend);
    }
    const list = el("div", { class: "prepSeasoningList" }, []);
    if (seasoningBowl.length === 0) {
      list.appendChild(el("div", { class: "muted", style: "padding:6px" }, [t("prep.bowlEmpty")]));
    } else {
      seasoningBowl.forEach((s, i) => {
        const isLiq = LIQUID_ID_SET.has(s.id);
        const swatch = isLiq
          ? el("span", {
            class: "prepLiquidSwatch",
            style: `display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;background:${liquidColorCss(s.id)};vertical-align:middle`,
          }, [])
          : null;
        const liqTag = isLiq ? (LIQUID_LABELS[s.id] || s.id) : null;
        list.appendChild(el("div", { class: "prepStagedItem", style: "margin-bottom:4px" }, [
          el("span", {}, [
            swatch,
            `${EMOJI[s.id] || "🧂"} ${ingredients[s.id]?.name || s.id}`,
            liqTag ? el("small", { style: "color:var(--text-dim);margin-left:4px" }, [`(${liqTag})`]) : null,
          ].filter(Boolean)),
          el("button", {
            class: "btn",
            style: "padding:2px 8px;font-size:11px",
            onclick: () => {
              seasoningBowl.splice(i, 1);
              showSeasoningBowl(seasoningBowl);
              renderOps(opsHost, stagedHost);
            },
          }, [t("prep.remove")]),
        ]));
      });
    }
    opsHost.appendChild(list);
    opsHost.appendChild(
      el("div", { class: "prepScoopActionBox", style: "margin-top:10px" }, [
        el("div", { class: "prepScoopActionTitle" }, [t("prep.scoopSeasoningTitle")]),
        el("div", { class: "prepScoopActionDesc" }, [t("prep.scoopBowlDesc")]),
        btnScoopReserve(t("prep.scoopSeasoningBtn"), () => {
          const reserveHost = document.getElementById("prepReserveHost");
          seasoningBowl.forEach((s) => {
            reserveTray.push({
              id: s.id,
              prepState: "seasoning_ready",
              cut: "none",
              amountG: getDefaultAmountG(s.id),
              prepFlags: { marinated: false, withSkin: false, withBone: false, setAside: true },
              source: "seasoning",
            });
          });
          seasoningBowl.length = 0;
          showSeasoningBowl(seasoningBowl);
          renderReserve(reserveHost);
          notifyReserveAdded();
          renderOps(opsHost, stagedHost);
        }, { disabled: seasoningBowl.length === 0 }),
      ])
    );
    opsHost.appendChild(
      el("button", {
        class: "btn btnSuccess",
        style: "width:100%;margin-top:6px",
        disabled: seasoningBowl.length === 0,
        onclick: () => {
          seasoningBowl.forEach((s) => {
            staged.push({
              id: s.id,
              prepState: "seasoning_ready",
              cut: "none",
              amountG: getDefaultAmountG(s.id),
              prepFlags: { marinated: false, withSkin: false, withBone: false },
            });
          });
          seasoningBowl.length = 0;
          showSeasoningBowl(seasoningBowl);
          renderStaged(stagedHost);
          renderOps(opsHost, stagedHost);
        },
      }, [t("prep.toStaged")])
    );
  };

  let pickerApi = null;
  let guideApi = null;

  const prepFilterFn = (id) => {
    if (station === "marinate") return canMarinateIngredient(id) || canMarinateSeasoning(id);
    if (station === "seasoning") return canSeasoningPrep(id);
    return canPrepOnBoard(id);
  };

  const handlePrepPick = (ing) => {
    if (station === "marinate") {
      if (canMarinateIngredient(ing.id)) {
        const fromBoard = boardWork && boardWork.id === ing.id;
        addMarinateItem({
          id: ing.id,
          prepState: fromBoard ? boardWork.prepState : "whole",
          cut: fromBoard ? boardWork.cut : "chop",
          prepFlags: fromBoard ? boardWork.prepFlags : getInitialPrepFlags(ing.id),
        });
      } else if (canMarinateSeasoning(ing.id)) {
        marinateBrine.push({ id: ing.id });
        refreshMarinateView();
      }
    } else if (station === "seasoning") {
      seasoningBowl.push({ id: ing.id });
      showSeasoningBowl(seasoningBowl);
    } else {
      selectIngredient(ing.id);
    }
    pickerApi?.setSelectedId(ing.id);
    const opsHost = document.getElementById("prepOpsHost");
    const stagedHost = document.getElementById("prepStagedHost");
    if (opsHost) renderOps(opsHost, stagedHost, { skipPicker: true });
  };

  const refreshPicker = () => {
    const host = document.getElementById("prepIngredientPicker");
    if (!host) return;
    pickerApi = mountIngredientPicker(host, {
      ingredients,
      filterFn: prepFilterFn,
      selectedId,
      onSelect: handlePrepPick,
      compact: true,
      listMaxHeight: "30vh",
    });
  };

  const focusPrepIngredient = (id) => {
    if (canPrepOnBoard(id)) {
      station = "board";
      selectIngredient(id);
    } else if (canMarinateIngredient(id) || canMarinateSeasoning(id)) {
      station = "marinate";
      if (canMarinateIngredient(id)) selectIngredient(id);
    } else if (canSeasoningPrep(id)) {
      station = "seasoning";
      selectedId = null;
      showSeasoningBowl(seasoningBowl);
    }
    const opsHost = document.getElementById("prepOpsHost");
    const stagedHost = document.getElementById("prepStagedHost");
    if (opsHost) renderOps(opsHost, stagedHost);
    pickerApi?.setSelectedId(id);
    pickerApi?.focusSearch?.();
  };

  const renderOps = (opsHost, stagedHost, opts = {}) => {
    if (!opts.skipPicker) refreshPicker();
    opsHost.innerHTML = "";
    opsHost.appendChild(renderStationTabs(opsHost, stagedHost));
    opsHost.appendChild(el("hr", { class: "hr" }));
    if (station === "board") renderBoardOps(opsHost, stagedHost);
    else if (station === "marinate") renderMarinateOps(opsHost, stagedHost);
    else renderSeasoningOps(opsHost, stagedHost);
  };

  const close = () => {
    stopMarinateTick();
    disposePrep3D();
    document.querySelector(".prepOverlay")?.remove();
  };

  const commit = () => {
    if (staged.length === 0) {
      alert(t("prep.stagedEmptyAlert"));
      return;
    }
    onCommitStaged(staged);
    close();
  };

  const overlay = el("div", { class: "prepOverlay", onclick: (e) => { if (e.target === overlay) close(); } }, [
    el("div", { class: "prepHeader" }, [
      el("h2", {}, ["🥬 ", t("prep.title")]),
      el("div", { class: "row" }, [
        createLangToggle({ style: "padding:6px 10px;font-weight:600" }),
        el("button", { class: "btn btnWarn", onclick: commit }, [t("prep.commitAll")]),
        el("button", { class: "btn", onclick: close }, [t("prep.close")]),
      ]),
    ]),
    el("div", { class: "prepBody" }, [
      el("div", { class: "panel prepLeftPanel" }, [
        el("div", { class: "panelHeader" }, [el("h2", {}, [t("prep.ingGuide")])]),
        el("div", { class: "panelBody prepLeftBody" }, [
          el("div", { id: "prepTargetGuide" }, []),
          el("hr", { class: "hr" }),
          el("div", { id: "prepIngredientPicker" }, []),
        ]),
      ]),
      el("div", { class: "prepBoardCol" }, [
        el("div", { class: "prepBoard", id: "prep3dHost" }, []),
        el("div", {
          class: "prep3dHint",
          id: "prep3dHint",
        }, [t("prep.loading")]),
      ]),
      el("div", { class: "panel prepReservePanel" }, [
        el("div", { class: "panelHeader prepReservePanelHeader" }, [
          el("h2", {}, [t("prep.reserve")]),
          el("span", { class: "prepReserveBadge prepReserveBadgeEmpty", id: "prepReserveBadge" }, ["0"]),
        ]),
        el("div", { class: "panelBody prepReservePanelBody" }, [
          el("p", { class: "prepReservePanelHint" }, [
            t("prep.stagedHint"),
          ]),
          el("div", { class: "prepReserve", id: "prepReserveHost" }, []),
          el("button", {
            type: "button",
            class: "btn btnPrimary prepReserveMoveAll",
            id: "prepReserveMoveAll",
            disabled: true,
            onclick: () => {
              const stagedHost = document.getElementById("prepStagedHost");
              const reserveHost = document.getElementById("prepReserveHost");
              moveAllReserveToStaged(stagedHost, reserveHost);
            },
          }, [t("prep.toStagedBtn")]),
        ]),
      ]),
      el("div", { class: "panel prepOpsPanel" }, [
        el("div", { class: "panelHeader" }, [el("h2", {}, [t("prep.ops")])]),
        el("div", { class: "panelBody prepOps" }, [
          el("div", { id: "prepOpsHost" }, []),
          el("hr", { class: "hr" }),
          el("div", { class: "prepStagedTitle" }, [t("prep.stagedTitle")]),
          el("div", { class: "prepStaged", id: "prepStagedHost" }, []),
        ]),
      ]),
    ]),
  ]);

  document.body.appendChild(overlay);

  setTimeout(() => {
    const boardHost = document.getElementById("prep3dHost");
    if (boardHost) {
      initPrep3D(boardHost);
      updatePrepTheme((document.documentElement.dataset.theme || localStorage.getItem("cookingsim.theme")) === "light");
      if (preSelectedId) selectIngredient(preSelectedId);
      else updateView();
    }
  }, 200);

  const onKey = (e) => {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
  };
  document.addEventListener("keydown", onKey);

  const guideHost = document.getElementById("prepTargetGuide");
  if (guideHost) {
    guideApi = mountTargetRecipeGuide(guideHost, {
      context: "prep",
      collapsedDefault: false,
      onClear: () => guideApi?.refresh(),
      onPrepIngredient: focusPrepIngredient,
    });
  }
  const opsHost = document.getElementById("prepOpsHost");
  const stagedHost = document.getElementById("prepStagedHost");
  const reserveHost = document.getElementById("prepReserveHost");
  if (opsHost) renderOps(opsHost, stagedHost);
  if (reserveHost) renderReserve(reserveHost);
  if (stagedHost) renderStaged(stagedHost);
  updateHint();
}
