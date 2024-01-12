import { Middleware } from '../../src/middleware'
import { Todo } from '../model/todo'
import { TodosFilter } from '../model/todo-filter'
import { TodoListViewContext } from './todo-list-context'

type Renderer<C, ViewModel> = Middleware<
  unknown,
  string,
  C & TodoListViewContext & ViewModel
>

type UpdatedTodoItemViewModel = { todo: Todo; itemsLeft: number }
export const renderUpdatedTodoItem = <C>(): Renderer<
  C,
  UpdatedTodoItemViewModel
> => {
  return (_, { views, todo, itemsLeft }) =>
    views.todoList.todoItemTemplate({ todo }) +
    views.todoList.itemCountTemplate({ itemsLeft })
}

type UpdatedTodoListViewModel = { todos: Todo[]; itemsLeft: number }
export const renderUpdatedTodoList = <C>(): Renderer<
  C,
  UpdatedTodoListViewModel
> => {
  return (_, { views, todos, itemsLeft }) =>
    views.todoList.todoListTemplate({ todos }) +
    views.todoList.itemCountTemplate({ itemsLeft })
}

type TodoItemEditViewModel = { todo: Todo }
export const renderTodoItemEditMode = <C>(): Renderer<
  C,
  TodoItemEditViewModel
> => {
  return (_, { views, todo }) => views.todoList.editItemTemplate({ todo })
}

type TodoListViewModel = {
  todos: Todo[]
  itemsLeft: number
  filter: TodosFilter
}
export const renderTodoListIndex = <C>(): Renderer<C, TodoListViewModel> => {
  return (_, { todos, filter, itemsLeft, views }) =>
    views.todoList.indexTemplate({
      todos,
      filter,
      itemsLeft,
    })
}
