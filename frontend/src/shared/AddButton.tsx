import { Plus } from "lucide-react";

type Props = { noun: string; onClick: () => void };

/** A page's main action, "Add contact"; a phone shows only "Add", since the title says what. */
export function AddButton({ noun, onClick }: Props) {
  return (
    <button type="button" className="btn" aria-label={`Add ${noun}`} onClick={onClick}>
      <Plus size={16} aria-hidden="true" />
      Add<span className="add-noun"> {noun}</span>
    </button>
  );
}
