import { boolean, InferType, object, string } from '@spaceteams/zap'

export const TodoSchema = object({
  id: string(),
  name: string(),
  done: boolean(),
})
export type Todo = InferType<typeof TodoSchema>
