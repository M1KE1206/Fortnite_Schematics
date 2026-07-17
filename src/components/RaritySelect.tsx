import { RARITIES, RARITY_LABELS, type Rarity } from '../types';
import { RARITY_COLORS } from '../data/rarity';

export default function RaritySelect({ value, onChange }: { value: Rarity; onChange: (r: Rarity) => void }) {
  return (
    <div className="flex gap-1">
      {RARITIES.map((r) => (
        <button
          key={r}
          type="button"
          title={RARITY_LABELS[r]}
          onClick={() => onChange(r)}
          className={`h-5 w-5 rounded-full ${RARITY_COLORS[r]} ${
            value === r ? 'ring-2 ring-white' : 'opacity-40 hover:opacity-80'
          }`}
        />
      ))}
    </div>
  );
}
