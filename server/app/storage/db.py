from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..sim.models import SimSession


@dataclass
class Storage:
    conn: sqlite3.Connection
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

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
        cur.execute(
            """
            create table if not exists user_recipes (
              id text primary key,
              json text not null,
              created_at integer not null
            )
            """
        )
        self.conn.commit()

    def _seed_examples(self) -> None:
        from ..recipes.examples_seed import EXAMPLE_RECIPES

        examples = EXAMPLE_RECIPES
        with self._lock:
            cur = self.conn.cursor()
            for ex in examples:
                cur.execute(
                    "insert or replace into example_recipes (id, json) values (?, ?)",
                    (ex["id"], json.dumps(ex, ensure_ascii=False)),
                )
            self.conn.commit()

    def save_session(self, session: SimSession | dict[str, Any]) -> None:
        data = session if isinstance(session, dict) else session.model_dump()
        sid = data.get("id")
        if not isinstance(sid, str):
            return
        with self._lock:
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

    def save_user_recipe(self, recipe: dict[str, Any]) -> None:
        rid = recipe.get("id")
        if not isinstance(rid, str) or not rid:
            return
        with self._lock:
            cur = self.conn.cursor()
            cur.execute(
                "insert into user_recipes (id, json, created_at) values (?, ?, strftime('%s','now')) "
                "on conflict(id) do update set json=excluded.json",
                (rid, json.dumps(recipe, ensure_ascii=False)),
            )
            self.conn.commit()

    def list_user_recipes(self) -> list[dict[str, Any]]:
        cur = self.conn.cursor()
        rows = cur.execute("select json from user_recipes order by created_at desc").fetchall()
        return [json.loads(r["json"]) for r in rows]

