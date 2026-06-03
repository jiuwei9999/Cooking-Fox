from __future__ import annotations

import base64
import copy
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .calorie_calc import calc_daily_calories
from .meal_plan_pools import (
    build_scientific_meal_plan,
    expand_plan_with_local_catalog,
    scientific_tips,
)

ING_EN = {
    "egg": "egg", "tomato": "tomato", "cucumber": "cucumber", "potato": "potato",
    "carrot": "carrot", "onion": "onion", "pork": "pork belly", "beef": "beef",
    "chicken": "chicken", "shrimp": "shrimp", "mushroom": "mushroom",
    "rice": "rice", "noodle": "noodles", "flour": "wheat flour",
    "tofu": "tofu", "cabbage": "napa cabbage", "bok_choy": "bok choy",
    "broccoli": "broccoli", "bell_pepper": "bell pepper", "eggplant": "eggplant",
    "corn": "corn", "green_bean": "green beans", "spinach": "spinach", "celery": "celery",
    "fish": "fish fillet", "lamb": "lamb", "duck": "duck meat", "squid": "squid", "clam": "clams",
    "water": "water", "oil": "cooking oil", "vinegar": "rice vinegar",
    "soy_sauce": "light soy sauce", "dark_soy_sauce": "dark soy sauce", "sesame_oil": "sesame oil",
    "cooking_wine": "Shaoxing wine", "oyster_sauce": "oyster sauce", "chili_oil": "chili oil",
    "salt": "salt", "sugar": "sugar", "pepper": "ground pepper", "five_spice": "five-spice powder",
    "garlic": "garlic", "ginger": "ginger", "chili": "red chili", "scallion": "scallion",
    "butter": "butter", "starch": "cornstarch", "chicken_powder": "chicken bouillon",
    "sesame": "sesame seeds", "bean_paste": "fermented bean paste",
}

SEASONINGS = {
    "salt", "sugar", "pepper", "five_spice", "soy_sauce", "dark_soy_sauce", "vinegar",
    "sesame_oil", "oyster_sauce", "bean_paste", "chicken_powder", "sesame", "starch",
    "cooking_wine", "chili_oil", "oil", "water",
}


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_dotenv()


def _api_base() -> str:
    return os.getenv("AI_API_BASE", "https://ipv4-beta.kxcym.top:3001/v1").rstrip("/")


def _api_key() -> str:
    return os.getenv("AI_API_KEY", "")


def _image_model() -> str:
    return os.getenv("AI_IMAGE_MODEL", "gpt-image-2")


def _chat_model() -> str:
    return os.getenv("AI_CHAT_MODEL", "deepseek-v4-pro")


def _env_truthy(name: str, default: bool = True) -> bool:
    raw = os.getenv(name, "")
    if raw == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on", "enabled")


def _chat_fast_mode() -> bool:
    """默认开启：用非推理模型 + 限制 token，缩短「思考」等待。"""
    return _env_truthy("AI_CHAT_FAST_MODE", True)


def _effective_chat_model() -> str:
    main = _chat_model()
    if not _chat_fast_mode():
        return main
    fast = os.getenv("AI_CHAT_FAST_MODEL", "").strip()
    # 网关常无 deepseek-chat；快速模式 = 同一模型 + 关长思考，不强行换模型名
    if not fast or fast.lower() in ("deepseek-chat", "chat"):
        return main
    return fast


def _post_chat(payload: dict, *, timeout: int, retries: int = 2, max_tokens: int | None = None) -> dict:
    """统一聊天请求：快速模式下降温、限长，并尝试关闭 extended thinking。"""
    body = dict(payload)
    body["model"] = _effective_chat_model()
    if _chat_fast_mode():
        body["temperature"] = min(float(body.get("temperature", 0.7)), 0.65)
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        body.setdefault("reasoning_effort", "low")
        body["extra_body"] = {**(body.get("extra_body") or {}), "thinking": {"type": "disabled"}}

    try:
        return _post_json("chat/completions", body, timeout=timeout, retries=retries)
    except RuntimeError as first_err:
        if not _chat_fast_mode():
            raise
        slim = {k: v for k, v in body.items() if k not in ("extra_body", "reasoning_effort")}
        if max_tokens is not None:
            slim["max_tokens"] = max_tokens
        try:
            return _post_json("chat/completions", slim, timeout=timeout, retries=retries)
        except RuntimeError:
            raise first_err from first_err


def _post_json(path: str, payload: dict, timeout: int = 120, retries: int = 1) -> dict:
    key = _api_key()
    if not key:
        raise RuntimeError("未配置 AI_API_KEY（请在 server/.env 中设置）")

    url = f"{_api_base()}/{path.lstrip('/')}"
    body = json.dumps(payload).encode("utf-8")
    last_err: Exception | None = None

    for attempt in range(max(1, retries)):
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            last_err = RuntimeError(f"AI API HTTP {e.code}: {detail[:500]}")
            if e.code in (502, 503, 504) and attempt + 1 < retries:
                continue
            raise last_err from e
        except urllib.error.URLError as e:
            reason = str(getattr(e, "reason", e))
            if "timed out" in reason.lower():
                last_err = RuntimeError(
                    "AI 接口响应超时（生成内容过多或网络较慢），请选「一周」重试，或关闭 AI 使用本地模板"
                )
            else:
                last_err = RuntimeError(f"AI API 网络错误: {reason}")
            if attempt + 1 < retries:
                continue
            raise last_err from e
        except TimeoutError as e:
            last_err = RuntimeError(
                "AI 接口响应超时（生成内容过多或网络较慢），请选「一周」重试，或关闭 AI 使用本地模板"
            )
            if attempt + 1 < retries:
                continue
            raise last_err from e

    if last_err:
        raise last_err
    raise RuntimeError("AI API 请求失败")


def build_dish_image_prompt(session: dict) -> str:
    pot = session.get("pot") or []
    metrics = session.get("metrics") or {}
    taste = metrics.get("taste") or {}

    counts: dict[str, float] = {}
    for p in pot:
        iid = p.get("ingredient_id", "")
        counts[iid] = counts.get(iid, 0) + float(p.get("amount_g") or 0)

    mains: list[str] = []
    aromatics: list[str] = []
    for iid, _amt in sorted(counts.items(), key=lambda x: -x[1]):
        if iid in SEASONINGS:
            continue
        en = ING_EN.get(iid, iid.replace("_", " "))
        if iid in ("garlic", "ginger", "chili", "scallion"):
            aromatics.append(en)
        else:
            mains.append(en)
        if len(mains) >= 5:
            break

    sauce_hints: list[str] = []
    if "soy_sauce" in counts or "dark_soy_sauce" in counts:
        sauce_hints.append("glossy soy-based sauce")
    if "vinegar" in counts:
        sauce_hints.append("tangy vinegar glaze")
    if float(metrics.get("oil_g") or 0) > 30:
        sauce_hints.append("rich oil sheen")

    taste_desc: list[str] = []
    if float(taste.get("salty") or 0) > 0.25:
        taste_desc.append("savory")
    if float(taste.get("sweet") or 0) > 0.2:
        taste_desc.append("slightly sweet")
    if float(taste.get("sour") or 0) > 0.2:
        taste_desc.append("tangy")
    if float(taste.get("spicy") or 0) > 0.25:
        taste_desc.append("spicy")
    if float(taste.get("umami") or 0) > 0.35:
        taste_desc.append("umami-rich")

    doneness = round(float(metrics.get("doneness") or 0) * 100)
    browning = round(float(metrics.get("browning") or 0) * 100)
    burn = float(metrics.get("burn_risk") or 0)

    parts = [
        "Top-down food photography of a homemade Chinese dish",
        f"featuring {', '.join(mains)}" if mains else "",
        f"garnished with {' and '.join(aromatics)}" if aromatics else "",
        f"coated in {', '.join(sauce_hints)}" if sauce_hints else "",
        f"{', '.join(taste_desc)} flavor profile" if taste_desc else "",
        "cooked thoroughly" if doneness > 40 else "",
        (
            "deeply caramelized golden-brown sear"
            if browning > 60
            else ("light golden browning" if browning > 25 else "")
        ),
        "with slightly charred edges" if burn > 0.5 else "",
        "served on a rustic ceramic plate, warm natural lighting, shallow depth of field, "
        "soft steam rising, appetizing, sharp focus, high resolution, photorealistic",
    ]
    return ", ".join(p for p in parts if p)


def generate_dish_image(session: dict) -> dict[str, Any]:
    prompt = build_dish_image_prompt(session)
    data = _post_json(
        "images/generations",
        {
            "model": _image_model(),
            "prompt": prompt,
            "n": 1,
            "size": "768x768",
        },
        timeout=180,
        retries=3,
    )

    items = data.get("data") or []
    if not items:
        raise RuntimeError("图片 API 未返回 data")

    item = items[0]
    if item.get("url"):
        return {"url": item["url"], "prompt": prompt}
    b64 = item.get("b64_json") or item.get("b64")
    if b64:
        return {"b64": b64, "mime": "image/png", "prompt": prompt}

    raise RuntimeError("图片 API 响应缺少 url 或 b64_json")


def _strip_markdown_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text)
    return text.strip()


def _flatten_message_content(content: Any) -> str:
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                parts.append(str(part.get("text") or ""))
        return "".join(parts)
    return str(content or "")


def _message_text(message: dict) -> str:
    content = _flatten_message_content(message.get("content"))
    if content.strip():
        return _strip_markdown_fence(content)
    reasoning = _flatten_message_content(message.get("reasoning_content"))
    if reasoning.strip() and "{" in reasoning:
        return _strip_markdown_fence(reasoning)
    return ""


def _meal_plan_message_text(message: dict) -> str:
    """食谱专用：优先取含 days 的 JSON 字段，避免误用推理过程文字。"""
    if not isinstance(message, dict):
        return ""
    content = _flatten_message_content(message.get("content"))
    reasoning = _flatten_message_content(message.get("reasoning_content"))

    for cand in (content, reasoning):
        if cand and '"days"' in cand:
            block = _find_balanced_json(cand) or cand
            return _strip_markdown_fence(block)

    if content.strip().startswith("{"):
        return _strip_markdown_fence(content)
    if reasoning.strip():
        block = _find_balanced_json(reasoning)
        if block:
            return _strip_markdown_fence(block)
    return _strip_markdown_fence(content or reasoning or "")


def _find_balanced_json(text: str) -> str | None:
    """从混杂文本中提取第一个完整 {...} 对象（支持嵌套）。"""
    start = text.find("{")
    while start >= 0:
        depth = 0
        in_string = False
        quote = ""
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == quote:
                    in_string = False
                continue
            if ch in ('"', "'"):
                in_string = True
                quote = ch
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
        start = text.find("{", start + 1)
    return None


def _repair_json_text(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r",\s*}", "}", raw)
    raw = re.sub(r",\s*]", "]", raw)
    return raw


def _extract_json(text: str) -> dict:
    return _extract_json_robust(text)


def _extract_json_robust(text: str) -> dict:
    text = _strip_markdown_fence(text)
    candidates: list[str] = []
    if text:
        candidates.append(text)
    block = _find_balanced_json(text)
    if block and block not in candidates:
        candidates.insert(0, block)

    last_err: json.JSONDecodeError | None = None
    for raw in candidates:
        for attempt in (raw, _repair_json_text(raw)):
            try:
                if attempt.startswith("{"):
                    return json.loads(attempt)
            except json.JSONDecodeError as e:
                last_err = e
                continue

    if last_err:
        raise ValueError(f"无法解析 AI 返回的 JSON: {last_err}") from last_err
    raise ValueError("无法解析 AI 返回的 JSON")


def generate_serve_report(session: dict) -> dict[str, Any]:
    metrics = session.get("metrics") or {}
    taste = metrics.get("taste") or {}
    pot = session.get("pot") or []
    ingredients = session.get("ingredients") or {}

    pot_summary = []
    for p in pot[:20]:
        iid = p.get("ingredient_id", "")
        name = ingredients.get(iid, {}).get("name", iid) if isinstance(ingredients.get(iid), dict) else iid
        pot_summary.append(
            {
                "name": name,
                "amount_g": p.get("amount_g"),
                "cut": p.get("cut"),
            }
        )

    user_payload = {
        "dish_context": {
            "equipment": session.get("equipment_id"),
            "pot": pot_summary,
            "metrics": {
                "temp_c": metrics.get("temp_c"),
                "doneness": metrics.get("doneness"),
                "browning": metrics.get("browning"),
                "burn_risk": metrics.get("burn_risk"),
                "water_g": metrics.get("water_g"),
                "oil_g": metrics.get("oil_g"),
                "solids_g": metrics.get("solids_g"),
                "taste": taste,
            },
            "timeline_len": len(session.get("timeline") or []),
        }
    }

    chat_payload: dict[str, Any] = {
        "temperature": 0.85,
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是严厉但风趣的中餐主厨评委。根据模拟烹饪数据写出锅报告文案。"
                    "必须用简体中文。只输出 JSON，不要 markdown，不要代码块。"
                    "字段: intro, body, suggestText, pairing, scene, touch。"
                    "suggestText 以「如果说有什么可以提升的——」开头，用换行分隔 2-4 条建议。"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=False),
            },
        ],
    }
    chat_payload["response_format"] = {"type": "json_object"}

    timeout = 90 if _chat_fast_mode() else 120
    try:
        data = _post_chat(chat_payload, timeout=timeout, retries=2, max_tokens=900)
    except RuntimeError:
        chat_payload.pop("response_format", None)
        data = _post_chat(chat_payload, timeout=timeout, retries=2, max_tokens=900)

    message = data.get("choices", [{}])[0].get("message", {})
    content = _message_text(message if isinstance(message, dict) else {})
    if not content:
        raise RuntimeError("文案 API 未返回 content")

    narrative = _extract_json(content)
    for key in ("intro", "body", "suggestText", "pairing", "scene", "touch"):
        narrative.setdefault(key, "")

    return {"narrative": narrative, "model": _effective_chat_model(), "fast_mode": _chat_fast_mode()}


CONDITION_LABELS = {
    "weight_loss": "减脂/体重管理",
    "diabetes": "糖尿病",
    "hypertension": "高血压",
    "kidney": "慢性肾病/肾衰竭",
    "heart": "心血管保护",
    "general": "均衡健康",
}


def _meal_plan_full_ai(profile: dict) -> bool:
    """勾选 AI 时默认全量 AI 定制（不用本地菜谱库补天）。"""
    if profile.get("full_ai") is False:
        return False
    return bool(profile.get("use_ai", profile.get("useAi", True)))


def _meal_plan_ai_days(total_days: int, profile: dict) -> int:
    """全 AI：一周 7 天全由模型写；一月分两次各 7 天（共 14 天 AI），再组合延展。"""
    if _meal_plan_full_ai(profile):
        return 7 if total_days > 7 else total_days
    if _chat_fast_mode():
        return min(2, total_days)
    if total_days > 7:
        return 7
    return total_days


def _expand_ai_days_only(base_days: list[dict], day_count: int, lang: str) -> list[dict]:
    """仅用 AI 已生成的天数做交叉延展，不插入本地菜谱库。"""
    weekdays_zh = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    weekdays_en = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekdays = weekdays_en if lang == "en" else weekdays_zh
    n = max(1, len(base_days))
    slots = ["breakfast", "lunch", "dinner"]
    expanded: list[dict] = []

    for d in range(day_count):
        week = d // 7 + 1
        wd = weekdays[d % 7]
        label = f"第{week}周 {wd}" if day_count > 7 else wd

        if d < n:
            src = base_days[d]
            expanded.append({
                "day": d + 1,
                "label": src.get("label") or label,
                "meals": copy.deepcopy(src.get("meals") or []),
            })
            continue

        meals: list[dict] = []
        for si, slot in enumerate(slots):
            src_day = base_days[(d + si) % n]
            by_type = _meals_indexed_by_type(src_day)
            if slot in by_type:
                meals.append(copy.deepcopy(by_type[slot]))
            else:
                fallback = src_day.get("meals") or []
                if fallback:
                    meals.append(copy.deepcopy(fallback[si % len(fallback)]))
        expanded.append({"day": d + 1, "label": label, "meals": meals})

    return expanded


def _meals_indexed_by_type(day: dict) -> dict[str, dict]:
    indexed: dict[str, dict] = {}
    for meal in day.get("meals") or []:
        if isinstance(meal, dict):
            indexed[meal.get("type") or "meal"] = meal
    return indexed


def _collect_meal_names(days: list[dict]) -> set[str]:
    names: set[str] = set()
    for day in days:
        for meal in day.get("meals") or []:
            if isinstance(meal, dict) and meal.get("name"):
                names.add(str(meal["name"]))
    return names


def _call_ai_meal_plan_json(
    profile: dict,
    *,
    ai_day_count: int,
    cond_text: str,
    calorie_plan: dict | None,
    lang: str,
    week_label: str = "",
    avoid_dish_names: set[str] | None = None,
) -> dict[str, Any]:
    """单次 AI 请求并解析为 plan 对象。"""
    conditions = profile.get("conditions") or ["general"]
    lang_hint = "简体中文" if lang != "en" else "English"
    full_ai = _meal_plan_full_ai(profile)

    user_payload: dict[str, Any] = {
        "duration_days": ai_day_count,
        "conditions": conditions,
        "condition_labels": cond_text,
        "age": profile.get("age"),
        "sex": profile.get("sex"),
        "activity": profile.get("activity"),
        "height_cm": profile.get("height_cm"),
        "weight_current_kg": profile.get("weight_current_kg"),
        "weight_target_kg": profile.get("weight_target_kg"),
        "weeks_for_goal": profile.get("weeks_for_goal"),
        "allergies": profile.get("allergies") or "",
        "dislikes": profile.get("dislikes") or "",
        "notes": profile.get("notes") or "",
        "calorie_target": profile.get("calorie_target"),
    }
    if calorie_plan:
        user_payload["calorie_plan"] = calorie_plan
    if week_label:
        user_payload["week_label"] = week_label
    if avoid_dish_names:
        user_payload["avoid_dish_names"] = sorted(avoid_dish_names)[:40]

    schema_hint = (
        '{"title":"标题","summary":"概述","disclaimer":"免责声明",'
        '"days":[{"day":1,"label":"周一","meals":[{"type":"breakfast","name":"菜名",'
        '"items":["食材1"],"note":"营养要点","calories_estimate":400}]}],"tips":["提示"]}'
    )
    science_rules = (
        "依据中国居民膳食指南：多样、均衡、少油少盐。"
        "三餐能量约30:40:30；病种饮食原则严格遵守。"
        "有 calorie_plan 时每日热量接近 daily_kcal（±15%），填写 calories_estimate。"
    )
    unique_rule = "每天三餐菜名尽量不重复，同类食材可换做法。"
    if avoid_dish_names:
        unique_rule += "不要重复使用下列菜名：" + "、".join(sorted(avoid_dish_names)[:25]) + "。"

    if full_ai:
        system_content = (
            f"你是注册营养师。{lang_hint}。{week_label}"
            "只输出一个合法 JSON 对象，不要 markdown、不要解释、不要 reasoning。"
            f"结构：{schema_hint}"
            f"days 数组长度必须等于 {ai_day_count}，覆盖 day 1 到 {ai_day_count}。"
            "每餐 type 为 breakfast/lunch/dinner；items 2-4 条字符串。"
            f"{science_rules}{unique_rule}"
        )
    else:
        system_content = (
            f"注册营养师，{ai_day_count}天食谱，{lang_hint}。只输出 JSON。"
            f"days 长度={ai_day_count}。{science_rules}"
        )

    chat_payload: dict[str, Any] = {
        "temperature": 0.6,
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
    }
    timeout = 240 if full_ai else (100 if _chat_fast_mode() else 240)
    max_tok = 12000 if full_ai and ai_day_count >= 7 else (4096 if _chat_fast_mode() else 8000)

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            try:
                data = _post_chat(chat_payload, timeout=timeout, retries=2, max_tokens=max_tok)
            except RuntimeError:
                chat_payload.pop("response_format", None)
                data = _post_chat(chat_payload, timeout=timeout, retries=2, max_tokens=max_tok)
            message = data.get("choices", [{}])[0].get("message", {})
            content = _meal_plan_message_text(message if isinstance(message, dict) else {})
            if not content:
                raise ValueError("食谱 API 未返回可用 JSON")
            return _extract_json_robust(content)
        except (ValueError, RuntimeError, json.JSONDecodeError) as e:
            last_err = e
            chat_payload["messages"].append({
                "role": "user",
                "content": "上次输出无效。请仅输出一个 JSON 对象，包含完整 days 数组，不要任何其他文字。",
            })
    raise ValueError(str(last_err or "AI 食谱生成失败"))


def generate_meal_plan(profile: dict) -> dict[str, Any]:
    duration = profile.get("duration") or "week"
    day_count = 30 if duration == "month" else 7
    full_ai = _meal_plan_full_ai(profile)
    ai_day_count = _meal_plan_ai_days(day_count, profile)
    conditions = profile.get("conditions") or []
    if not conditions:
        conditions = ["general"]

    cond_text = "、".join(CONDITION_LABELS.get(c, c) for c in conditions)

    wants_weight_loss = "weight_loss" in conditions
    calorie_plan = profile.get("calorie_plan") if wants_weight_loss else None
    if wants_weight_loss and not calorie_plan and profile.get("weight_current_kg") and profile.get("weight_target_kg"):
        calc_profile = {**profile, "weight_loss_only": True}
        calorie_plan = calc_daily_calories(calc_profile)
    if wants_weight_loss and isinstance(calorie_plan, dict) and calorie_plan.get("daily_kcal"):
        profile["calorie_target"] = calorie_plan["daily_kcal"]
    elif not wants_weight_loss:
        profile.pop("calorie_target", None)
        calorie_plan = None

    lang = profile.get("lang") or "zh"
    cp = calorie_plan if isinstance(calorie_plan, dict) else None
    ai_warning: str | None = None

    try:
        if full_ai and day_count > 7:
            w1 = _call_ai_meal_plan_json(
                profile, ai_day_count=7, cond_text=cond_text, calorie_plan=cp, lang=lang,
                week_label="第1周（7天）：",
            )
            names1 = _collect_meal_names(w1.get("days") or [])
            w2 = _call_ai_meal_plan_json(
                profile, ai_day_count=7, cond_text=cond_text, calorie_plan=cp, lang=lang,
                week_label="第2周（7天）：",
                avoid_dish_names=names1,
            )
            plan = w1
            days1 = w1.get("days") or []
            days2 = w2.get("days") or []
            for i, d in enumerate(days2):
                d = dict(d)
                d["day"] = len(days1) + i + 1
                days1.append(d)
            plan["days"] = days1
            tips2 = w2.get("tips") or []
            plan["tips"] = list(dict.fromkeys([*(plan.get("tips") or []), *tips2]))
        else:
            plan = _call_ai_meal_plan_json(
                profile, ai_day_count=ai_day_count, cond_text=cond_text,
                calorie_plan=cp, lang=lang,
            )
    except (ValueError, RuntimeError, json.JSONDecodeError) as e:
        if full_ai:
            raise ValueError(f"全 AI 定制失败：{e}") from e
        ai_warning = str(e)
        plan = build_scientific_meal_plan(
            day_count=day_count,
            conditions=conditions,
            lang=lang,
            cond_text=cond_text,
            calorie_plan=cp,
            allergies=profile.get("allergies") or "",
            dislikes=profile.get("dislikes") or "",
        )

    plan.setdefault("title", f"{day_count}天{cond_text}食谱")
    plan.setdefault("summary", "")
    plan.setdefault("disclaimer", "本食谱仅供参考，不能替代专业医疗建议。")
    merged_tips = list(plan.get("tips") or []) + scientific_tips(conditions, lang, cp)
    seen: set[str] = set()
    deduped: list[str] = []
    for tip in merged_tips:
        if tip and tip not in seen:
            seen.add(tip)
            deduped.append(tip)
    plan["tips"] = deduped[:8]
    if cp and cp.get("daily_kcal"):
        plan["calorie_plan"] = cp

    days = plan.get("days") or []
    if not isinstance(days, list) or len(days) < 1:
        raise RuntimeError("食谱 JSON 缺少 days 数组")

    if day_count > len(days):
        base = days[: max(len(days), ai_day_count)]
        if full_ai:
            plan["days"] = _expand_ai_days_only(base, day_count, lang)
            if day_count > 14:
                extra = "（第1-2周共14天由 AI 逐日定制，第3-4周在 AI 菜单基础上组合延展）"
            else:
                extra = "（全部由 AI 菜单组合延展，无本地模板）"
            plan["summary"] = (plan.get("summary") or "") + extra
        else:
            plan["days"] = expand_plan_with_local_catalog(base, day_count, conditions, lang)
            plan["summary"] = (plan.get("summary") or "") + "（部分天数来自菜谱库）"

    if full_ai and not ai_warning:
        plan["summary"] = (
            (plan.get("summary") or "")
            + ("（全 AI 定制）" if lang != "en" else " (Full AI customization)")
        )

    result: dict[str, Any] = {
        "plan": plan,
        "model": _effective_chat_model(),
        "fast_mode": _chat_fast_mode(),
        "full_ai": full_ai,
        "ai_template_days": len(plan.get("days") or []),
        "duration": duration,
    }
    if ai_warning:
        result["warning"] = ai_warning
        result["ai_fallback"] = True
        plan["summary"] = (
            "（AI 异常，已用菜谱库方案）" + (plan.get("summary") or "")
            if lang != "en"
            else "(AI failed; catalog fallback) " + (plan.get("summary") or "")
        )
    return result


def get_ai_status(probe: bool = False) -> dict[str, Any]:
    """检查 AI 配置与网关连通性（供前端展示，与出锅报告共用同一套 .env）。"""
    key = _api_key()
    fast = _chat_fast_mode()
    model = _effective_chat_model()
    result: dict[str, Any] = {
        "configured": bool(key),
        "api_base": _api_base(),
        "chat_model": model,
        "chat_model_full": _chat_model(),
        "fast_mode": fast,
        "image_model": _image_model(),
        "features": {
            "serve_report": bool(key),
            "dish_image": bool(key),
            "meal_plan": bool(key),
        },
    }
    if not key:
        result["ok"] = False
        result["error"] = "未配置 AI_API_KEY（请在 server/.env 中设置）"
        return result

    if not probe:
        result["ok"] = True
        mode_hint = f"快速模式 · {model}" if fast else _chat_model()
        result["message"] = f"AI 密钥已配置（{mode_hint}，点击「检测连接」验证）"
        return result

    try:
        t0 = time.time()
        data = _post_chat(
            {
                "temperature": 0,
                "messages": [{"role": "user", "content": "只回复：OK"}],
            },
            timeout=35 if fast else 45,
            retries=1,
            max_tokens=16,
        )
        elapsed = round(time.time() - t0, 1)
        message = data.get("choices", [{}])[0].get("message", {})
        reply = _message_text(message if isinstance(message, dict) else {})
        result["ok"] = True
        result["probe_ms"] = int(elapsed * 1000)
        result["probe_reply"] = (reply or "").strip()[:80]
        mode_label = "快速模式" if fast else "标准模式"
        result["message"] = f"AI 连通正常（{mode_label} · {elapsed}s · {model}）"
    except Exception as e:
        result["ok"] = False
        result["error"] = str(e)

    return result
