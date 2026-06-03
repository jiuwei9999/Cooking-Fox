/** 备菜状态：服务端 prep_state / prep_flags ↔ 前端 _prepState / _prepFlags */

export function prepFlagsToServer(flags) {
  if (!flags) return null;
  return {
    with_skin: flags.withSkin,
    with_bone: flags.withBone,
    marinated: !!flags.marinated,
    marinate_minutes: flags.marinateMinutes ?? null,
    set_aside: !!flags.setAside,
    marinade_ids: flags.marinadeIds || [],
    marinate_strength: flags.marinateStrength ?? null,
  };
}

export function prepFlagsFromServer(pf) {
  if (!pf) return null;
  return {
    withSkin: pf.with_skin,
    withBone: pf.with_bone,
    marinated: !!pf.marinated,
    marinateMinutes: pf.marinate_minutes,
    setAside: !!pf.set_aside,
    marinadeIds: pf.marinade_ids || [],
    marinateStrength: pf.marinate_strength,
  };
}

export function hydratePortion(p) {
  if (!p) return;
  if (p.prep_state != null && p.prep_state !== "") {
    p._prepState = p.prep_state;
  }
  if (p.prep_flags) {
    p._prepFlags = prepFlagsFromServer(p.prep_flags);
  }
}

export function hydrateSession(session) {
  if (!session) return;
  (session.pot || []).forEach(hydratePortion);
  (session.reserve || []).forEach(hydratePortion);
}

/** 写入服务端字段，便于持久化 */
export function syncPortionToServer(p) {
  if (!p) return;
  if (p._prepState != null) p.prep_state = p._prepState;
  if (p._prepFlags) p.prep_flags = prepFlagsToServer(p._prepFlags);
}

export function prepExtrasFromItem(it) {
  const extras = {};
  const prepState = it.prepState || it._prepState;
  const prepFlags = it.prepFlags || it._prepFlags;
  if (prepState) extras.prep_state = prepState;
  const pf = prepFlagsToServer(prepFlags);
  if (pf) extras.prep_flags = pf;
  return extras;
}

export function extractPortionMeta(p) {
  if (!p) return null;
  hydratePortion(p);
  return {
    prepState: p._prepState || p.prep_state,
    cut: p.cut,
    prepFlags: p._prepFlags ? Object.assign({}, p._prepFlags) : prepFlagsFromServer(p.prep_flags),
    doneness: p.doneness,
    burn: p.burn,
    added_at_temp_c: p.added_at_temp_c,
  };
}

/**
 * @param {object} p
 * @param {object} meta
 * @param {{ toReserve?: boolean, toPot?: boolean }} opts
 */
export function applyPortionMeta(p, meta, opts = {}) {
  if (!p || !meta) return;
  if (meta.prepState) {
    p._prepState = meta.prepState;
    p.prep_state = meta.prepState;
  }
  if (meta.cut) p.cut = meta.cut;
  if (meta.prepFlags) {
    const flags = Object.assign({}, meta.prepFlags);
    if (opts.toPot) flags.setAside = false;
    else if (opts.toReserve) flags.setAside = true;
    p._prepFlags = flags;
    p.prep_flags = prepFlagsToServer(flags);
  } else if (opts.toReserve) {
    p._prepFlags = { setAside: true };
    p.prep_flags = { set_aside: true };
  }
  /* 熟度/锅温由服务端计算，勿在加热后用旧快照覆盖 */
  if (opts.includeCookState) {
    if (meta.doneness != null) p.doneness = meta.doneness;
    if (meta.burn != null) p.burn = meta.burn;
    if (meta.added_at_temp_c != null) p.added_at_temp_c = meta.added_at_temp_c;
  }
}

/** 仅恢复备菜外观状态（削皮/切片等），不碰熟度 */
export function restorePrepStateOnly(p, saved) {
  if (!p || !saved) return;
  applyPortionMeta(p, {
    prepState: saved.prepState,
    cut: saved.cut,
    prepFlags: saved.prepFlags,
  }, { toPot: true });
}

export function adoptSession(prev, next) {
  if (!next) return next;
  hydrateSession(next);
  if (!prev) return next;
  const backupPot = (prev.pot || []).map(extractPortionMeta);
  const backupReserve = (prev.reserve || []).map(extractPortionMeta);
  (next.pot || []).forEach((p, i) => {
    if (!p.prep_state && !p.prep_flags && backupPot[i]) {
      applyPortionMeta(p, backupPot[i], { toPot: true });
    }
  });
  (next.reserve || []).forEach((p, i) => {
    if (!p.prep_state && !p.prep_flags && backupReserve[i]) {
      applyPortionMeta(p, backupReserve[i], { toReserve: true });
    }
  });
  return next;
}
