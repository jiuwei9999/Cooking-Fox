from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..sim.models import SimSession


@dataclass
class Storage:
    conn: sqlite3.Connection

    @staticmethod
    def create(path: str) -> "Storage":
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        # FastAPI endpoints may run in a threadpool; allow cross-thread access.
        conn = sqlite3.connect(str(p), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        s = Storage(conn=conn)
        s._init()
        s._seed_examples()
        return s

    def _init(self) -> None:
        cur = self.conn.cursor()
        cur.execute(
            """
            create table if not exists sim_sessions (
              id text primary key,
              json text not null,
              updated_at integer not null
            )
            """
        )
        cur.execute(
            """
            create table if not exists example_recipes (
              id text primary key,
              json text not null
            )
            """
        )
        self.conn.commit()

    def _seed_examples(self) -> None:
        examples = [
            {
                "id": "practice_fried_egg",
                "title": "煎蛋（练习）",
                "ingredients": [
                    {"name": "鸡蛋", "ingredient_id": "egg", "amount_g": 55},
                    {"name": "食用油", "ingredient_id": "oil", "amount_g": 8},
                    {"name": "食盐", "ingredient_id": "salt", "amount_g": 0.8},
                ],
                "steps": ["热锅下油", "打入鸡蛋，小火定型", "撒盐，出锅"],
            },
            {
                "id": "practice_tomato_egg",
                "title": "番茄炒蛋（练习）",
                "ingredients": [
                    {"name": "鸡蛋", "ingredient_id": "egg", "amount_g": 110},
                    {"name": "番茄", "ingredient_id": "tomato", "amount_g": 220},
                    {"name": "食用油", "ingredient_id": "oil", "amount_g": 12},
                    {"name": "食盐", "ingredient_id": "salt", "amount_g": 1.2},
                    {"name": "白砂糖", "ingredient_id": "sugar", "amount_g": 3},
                ],
                "steps": ["鸡蛋炒散盛出", "下番茄炒出汁", "回锅鸡蛋，调味出锅"],
            },
            {
                "id": "practice_rice",
                "title": "蒸米饭（练习）",
                "ingredients": [
                    {"name": "大米(生)", "ingredient_id": "rice", "amount_g": 150},
                    {"name": "水", "ingredient_id": "water", "amount_g": 210},
                ],
                "steps": ["淘洗", "加水", "加热沸腾后转小火焖熟", "静置回蒸"],
            },
        ]
        cur = self.conn.cursor()
        for ex in examples:
            cur.execute(
                "insert or ignore into example_recipes (id, json) values (?, ?)",
                (ex["id"], json.dumps(ex, ensure_ascii=False)),
            )
        self.conn.commit()

    def save_session(self, session: SimSession | dict[str, Any]) -> None:
        data = session if isinstance(session, dict) else session.model_dump()
        sid = data.get("id")
        if not isinstance(sid, str):
            return
        cur = self.conn.cursor()
        cur.execute(
            "insert into sim_sessions (id, json, updated_at) values (?, ?, strftime('%s','now')) "
            "on conflict(id) do update set json=excluded.json, updated_at=excluded.updated_at",
            (sid, json.dumps(data, ensure_ascii=False)),
        )
        self.conn.commit()

    def get_session(self, session_id: str) -> SimSession | None:
        cur = self.conn.cursor()
        row = cur.execute("select json from sim_sessions where id=?", (session_id,)).fetchone()
        if row is None:
            return None
        payload = json.loads(row["json"])
        return SimSession.model_validate(payload)

    def list_example_recipes(self) -> list[dict[str, Any]]:
        cur = self.conn.cursor()
        rows = cur.execute("select json from example_recipes").fetchall()
        return [json.loads(r["json"]) for r in rows]

