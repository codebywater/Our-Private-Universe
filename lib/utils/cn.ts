/** Минимальная замена clsx: склеивает truthy-классы. */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
