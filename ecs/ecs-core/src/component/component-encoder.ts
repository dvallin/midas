export interface ComponentEncoder<T, E> {
  encode(value: T | null): E | null
  decode(value: E | null): T | null
}
