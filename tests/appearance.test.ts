import { expect, it } from "vitest";
import { defaultAppearance, defaults, SettingsSchema } from "../src/core/model";

it("opens older settings with appearance defaults and retains provider configuration", () => {
  const { appearance: _appearance, ...legacy } = defaults;
  const saved = { ...legacy, provider: "ollama", model: "local-model" };
  expect(SettingsSchema.parse(saved)).toEqual({
    ...saved,
    appearance: defaultAppearance,
  });
});

it("rejects invalid appearance settings at the persistence boundary", () => {
  for (const appearance of [
    { theme: "unknown" },
    { textSize: 1000 },
    { accent: "url(https://example.com)" },
    { showGrid: "false" },
  ]) {
    expect(() => SettingsSchema.parse({ ...defaults, appearance })).toThrow();
  }
});
