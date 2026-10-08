import { ACTORS } from "@mtm/shared";
import { useState, type FormEvent } from "react";

type Props = {
  busy: boolean;
  onCreate: (input: { title: string; description?: string; actor: string }) => Promise<void>;
};

export function TaskForm({ busy, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actor, setActor] = useState<string>(ACTORS[0]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onCreate({
        title,
        description: description.trim() ? description : undefined,
        actor,
      });
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  return (
    <form className="panel" onSubmit={(e) => void handleSubmit(e)}>
      <h2>Create task</h2>
      <label>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Prepare Invoice"
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional"
        />
      </label>
      <label>
        Actor
        <select value={actor} onChange={(e) => setActor(e.target.value)}>
          {ACTORS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={busy || title.trim().length === 0}>
        Create
      </button>
    </form>
  );
}
