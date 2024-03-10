import { ContextMappingMiddleware } from '../../../middleware/middleware-core'
import { Todo } from '../model/todo'
import { TodosFilter } from '../model/todo-filter'
import { TodoListViewContext } from './todo-list-context'

type TodoListRenderer<C, ViewModel> = ContextMappingMiddleware<
  C & ViewModel & TodoListViewContext,
  string
>

type UpdatedTodoItemViewModel = { todo: Todo; itemsLeft: number }
export const renderUpdatedTodoItem = <C>(): TodoListRenderer<
  C,
  UpdatedTodoItemViewModel
> => {
  return ({ views, todo, itemsLeft }) =>
    views.todoList.todoItemTemplate({ todo }) +
    views.todoList.itemCountTemplate({ itemsLeft })
}

type UpdatedTodoListViewModel = { todos: Todo[]; itemsLeft: number }
export const renderUpdatedTodoList = <C>(): TodoListRenderer<
  C,
  UpdatedTodoListViewModel
> => {
  return ({ views, todos, itemsLeft }) =>
    views.todoList.todoListTemplate({ todos }) +
    views.todoList.itemCountTemplate({ itemsLeft })
}

type TodoItemEditViewModel = { todo: Todo }
export const renderTodoItemEditMode = <C>(): TodoListRenderer<
  C,
  TodoItemEditViewModel
> => {
  return ({ views, todo }) => views.todoList.editItemTemplate({ todo })
}

type TodoListViewModel = {
  todos: Todo[]
  itemsLeft: number
  filter: TodosFilter
}
export const renderTodoListIndex = <C>(): TodoListRenderer<
  C,
  TodoListViewModel
> => {
  return ({ todos, filter, itemsLeft, views }) =>
    views.todoList.indexTemplate({
      todos,
      filter,
      itemsLeft,
    })
}
