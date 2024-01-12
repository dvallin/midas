import { InferType, literals } from '@spaceteams/zap'
import { Todo } from './todo'

export const TodosFilterSchema = literals('all', 'active', 'completed')
export type TodosFilter = InferType<typeof TodosFilterSchema>

export function applyFilter(todos: Todo[], filter: TodosFilter) {
  switch (filter) {
    case 'all':
      return todos
    case 'active':
      return todos.filter((t) => !t.done)
    case 'completed':
      return todos.filter((t) => t.done)
  }
}
