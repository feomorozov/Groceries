"use client";

import { FormEvent, useState } from "react";
import { ROOMMATES, type RoommateId, type TodoItem } from "@/lib/types";

function errorMessage(body: unknown) { return typeof body === "object" && body && "error" in body ? String(body.error) : "Something went wrong."; }
const emptyDrafts: Record<RoommateId, string> = { michael: "", kevin: "", feo: "", saketh: "" };

export function TodoLists({ initial }: { initial: TodoItem[] }) {
  const [items, setItems] = useState(initial);
  const [drafts, setDrafts] = useState(emptyDrafts);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const request = async <T,>(url: string, options: RequestInit): Promise<T> => {
    const response = await fetch(url, options);
    if (response.status === 204) return undefined as T;
    const body = await response.json();
    if (!response.ok) throw new Error(errorMessage(body));
    return body as T;
  };
  const add = async (event: FormEvent<HTMLFormElement>, roommateId: RoommateId) => {
    event.preventDefault();
    const text = drafts[roommateId].trim();
    if (!text) return;
    setBusy(`new-${roommateId}`); setError("");
    try {
      const item = await request<TodoItem>("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roommateId, text }) });
      setItems((current) => [...current, item]); setDrafts((current) => ({ ...current, [roommateId]: "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't add this item."); } finally { setBusy(null); }
  };
  const update = async (id: string, change: Partial<Pick<TodoItem, "text" | "completed">>) => {
    setBusy(id); setError("");
    try {
      const item = await request<TodoItem>(`/api/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      setItems((current) => current.map((value) => value.id === item.id ? item : value));
      setEditing(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't update this item."); } finally { setBusy(null); }
  };
  const remove = async (id: string) => {
    setBusy(id); setError("");
    try { await request<void>(`/api/todos/${id}`, { method: "DELETE" }); setItems((current) => current.filter((value) => value.id !== id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't delete this item."); } finally { setBusy(null); }
  };
  return <div className="todo-page">
    {error && <p className="error todo-error" role="alert">{error}</p>}
    <div className="todo-groups">{ROOMMATES.map((roommate) => {
      const personalItems = items.filter((item) => item.roommateId === roommate.id);
      return <section className="todo-group" key={roommate.id} aria-labelledby={`todo-${roommate.id}`}>
        <h2 id={`todo-${roommate.id}`}>{roommate.name}</h2>
        <form className="todo-add" onSubmit={(event) => add(event, roommate.id)}>
          <input aria-label={`Add a grocery item for ${roommate.name}`} placeholder="Add a grocery item" value={drafts[roommate.id]} onChange={(event) => setDrafts((current) => ({ ...current, [roommate.id]: event.target.value }))} />
          <button className="todo-add-button" type="submit" disabled={busy === `new-${roommate.id}`} aria-label={`Add grocery item for ${roommate.name}`}>{busy === `new-${roommate.id}` ? "…" : "+"}</button>
        </form>
        {personalItems.length === 0 ? <p className="todo-empty">Nothing on the list.</p> : <ul className="todo-items">{personalItems.map((item) => <li className={`todo-item${item.completed ? " completed" : ""}`} key={item.id}>
          {editing === item.id ? <form className="todo-edit" onSubmit={(event) => { event.preventDefault(); const text = editText.trim(); if (text) void update(item.id, { text }); }}><input aria-label="Edit grocery item" value={editText} onChange={(event) => setEditText(event.target.value)} autoFocus /><button type="submit" className="todo-action" disabled={busy === item.id}>Save</button><button type="button" className="todo-action" onClick={() => setEditing(null)}>Cancel</button></form> : <>
            <label className="todo-check"><input type="checkbox" checked={item.completed} disabled={busy === item.id} onChange={(event) => void update(item.id, { completed: event.target.checked })} /><span>{item.text}</span></label>
            <div className="todo-item-actions"><button type="button" className="todo-action" disabled={busy === item.id} onClick={() => { setEditing(item.id); setEditText(item.text); }}>Edit</button><button type="button" className="todo-action todo-delete" disabled={busy === item.id} onClick={() => void remove(item.id)}>Delete</button></div>
          </>}
        </li>)}</ul>}
      </section>;
    })}</div>
  </div>;
}
