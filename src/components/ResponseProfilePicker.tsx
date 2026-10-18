import {
  responseProfiles,
  type ResponseProfile,
} from "../core/response-profiles";

export function ResponseProfilePicker({
  value,
  onChange,
  disabled,
  label = "Response profile",
  describe = true,
}: {
  value: ResponseProfile;
  onChange: (value: ResponseProfile) => void;
  disabled?: boolean;
  label?: string;
  describe?: boolean;
}) {
  return (
    <div className="response-profile">
      <label>
        {label}
        <select
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as ResponseProfile)}
        >
          {Object.entries(responseProfiles).map(([id, profile]) => (
            <option key={id} value={id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>
      {describe && (
        <p className="muted small">{responseProfiles[value].description}</p>
      )}
    </div>
  );
}
