"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LIMITS } from "../../convex/lib/validators";
import { PhotoPicker, type PhotoItem } from "@/components/photo-picker";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { CATEGORIES, CATEGORY, CONDITION, CONDITIONS, type Category, type Condition } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";

export type ToolDraft = {
  _id?: Id<"tools">;
  name: string;
  category: Category;
  condition: Condition;
  description: string;
  photos: PhotoItem[];
};

const EMPTY: ToolDraft = { name: "", category: "power_tools", condition: "good", description: "", photos: [] };

export function ToolFormDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ToolDraft | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial?._id ? "Edit listing" : "List a tool"}
      description={initial?._id ? undefined : "Neighbors will see the name, category, condition and description."}
    >
      {/* Remount per tool so the form state resets cleanly. */}
      <ToolForm key={initial?._id ?? "new"} initial={initial ?? EMPTY} onDone={onClose} />
    </Dialog>
  );
}

function ToolForm({ initial, onDone }: { initial: ToolDraft; onDone: () => void }) {
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const [draft, setDraft] = useState<ToolDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ToolDraft>(key: K, value: ToolDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const nameLength = draft.name.trim().length;
  const nameError =
    error && (nameLength < LIMITS.toolName.min || nameLength > LIMITS.toolName.max)
      ? `Name must be ${LIMITS.toolName.min}–${LIMITS.toolName.max} characters.`
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nameLength < LIMITS.toolName.min) {
      setError("name");
      return;
    }
    setSaving(true);
    try {
      const fields = {
        name: draft.name,
        category: draft.category,
        condition: draft.condition,
        description: draft.description,
        photos: draft.photos.map((p) => p.id),
      };
      if (draft._id) {
        await update({ toolId: draft._id, ...fields });
        toast.success("Listing updated");
      } else {
        await create(fields);
        toast.success("Your tool is on the board", { description: "Neighbors can request it right away." });
      }
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="What is it?" htmlFor="tool-name" error={nameError} counter={`${draft.name.length}/${LIMITS.toolName.max}`}>
        <Input
          id="tool-name"
          value={draft.name}
          maxLength={LIMITS.toolName.max}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. 18V cordless drill"
          autoFocus
          required
        />
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Photos</p>
        <PhotoPicker photos={draft.photos} onChange={(photos) => set("photos", photos)} onBusyChange={setUploading} />
      </div>

      <Field label="Category" htmlFor="tool-category">
        <Select id="tool-category" value={draft.category} onChange={(e) => set("category", e.target.value as Category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY[c].label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Condition</legend>
        <div className="grid grid-cols-2 gap-2">
          {CONDITIONS.map((c) => (
            <label
              key={c}
              className={cn(
                "cursor-pointer rounded-lg border px-3.5 py-2.5 transition-colors",
                draft.condition === c ? "border-brand bg-brand-soft" : "border-line-strong hover:bg-sunken",
              )}
            >
              <input
                type="radio"
                name="condition"
                value={c}
                checked={draft.condition === c}
                onChange={() => set("condition", c)}
                className="sr-only"
              />
              <span className="block text-sm font-medium text-ink">{CONDITION[c].label}</span>
              <span className="block text-xs text-ink-faint">{CONDITION[c].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Short description"
        htmlFor="tool-description"
        counter={`${draft.description.length}/${LIMITS.description.max}`}
        hint="What's included, any quirks, tips for using it."
      >
        <Textarea
          id="tool-description"
          value={draft.description}
          maxLength={LIMITS.description.max}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Comes with two batteries, a charger and a set of bits. Left battery holds less charge."
        />
      </Field>

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={uploading}>
          {draft._id ? "Save changes" : "List it"}
        </Button>
      </div>
    </form>
  );
}
