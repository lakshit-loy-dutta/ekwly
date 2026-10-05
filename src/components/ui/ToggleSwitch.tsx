interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function ToggleSwitch({ checked, onChange }: Props) {
  return (
    <div className="toggle-switch shrink-0">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider"></span>
    </div>
  );
}
