/**
 * Validation timing shared by every form in the product.
 *
 * `onTouched` means a field is not validated while it is being filled in for
 * the first time — only once the user leaves it, and live from then on while
 * they correct it. Validating on every keystroke from the start puts an error
 * under a half-typed email, which reads as the form arguing with you.
 *
 * Spread this into `useForm` alongside `resolver: zodResolver(schema)`. It is
 * a plain object rather than a wrapper hook so react-hook-form can still infer
 * field types from the schema.
 */
export const VALIDATION_MODE = {
  mode: 'onTouched',
  reValidateMode: 'onChange',
} as const;
