/** Uppercases and removes the spaces and hyphens people type into plates. */
export function normaliseRegistration(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/** e.g. "KA01AB1234" → "KA 01 AB 1234", the way it is painted on the plate. */
export function formatRegistration(input: string): string {
  const value = normaliseRegistration(input);
  const parts = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/.exec(value);
  return parts ? `${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}` : value;
}
