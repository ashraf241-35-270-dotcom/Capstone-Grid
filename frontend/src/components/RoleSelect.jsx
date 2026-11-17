const ROLE_OPTIONS = ['Student', 'Teacher'];

export default function RoleSelect({ value, onChange, label = 'I am a' }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="role-select" role="radiogroup" aria-label={label}>
        {ROLE_OPTIONS.map((role) => (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={value === role}
            className={value === role ? 'role-option active' : 'role-option'}
            onClick={() => onChange(role)}
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );
}
